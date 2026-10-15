"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { getArtworkDownloadUrl } from "@/lib/actions/orders";
import { buildSupplierBodyText, escapeHtml, wrapEmailHtml } from "@/lib/email-templates";
import { customerLabel, isBanner, isServiceLine, itemVisualDesigns } from "@/lib/domain";
import type { Order, OrderItem, Product, ProductSupplier } from "@/lib/types";

type Att = { filename: string; contentBase64: string; contentType: string };

function dataUrlToAttachment(dataUrl: string, filename: string): Att | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  return { filename, contentBase64: m[2], contentType: m[1] };
}

function extFromMime(mime: string) {
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("jpeg")) return "jpg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("svg")) return "svg";
  return "png";
}

function attBytes(a: Att) {
  return Math.ceil((a.contentBase64.length * 3) / 4);
}

// Malý náhled do mailu (orientace) — ne tiskový originál.
const THUMB_MAX_BYTES = 350_000;

async function thumbAttachment(dataUrl: string, filename: string): Promise<Att | null> {
  const att = dataUrlToAttachment(dataUrl, filename);
  if (!att) return null;
  if (attBytes(att) <= THUMB_MAX_BYTES) {
    att.filename = filename.replace(/\.[^.]+$/, "") + "." + extFromMime(att.contentType);
    return att;
  }
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
    const w = Math.max(1, Math.round((img.width || maxSide) * scale));
    const h = Math.max(1, Math.round((img.height || maxSide / 3) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return att;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const jpg = canvas.toDataURL("image/jpeg", 0.8);
    return dataUrlToAttachment(jpg, filename.replace(/\.[^.]+$/, "") + ".jpg");
  } catch {
    return null;
  }
}

async function bannerSupplierPack(it: OrderItem): Promise<{
  thumbs: Att[];
  links: { label: string; url: string }[];
}> {
  const designs = itemVisualDesigns(it);
  const thumbs: Att[] = [];
  const links: { label: string; url: string }[] = [];
  for (let i = 0; i < designs.length; i++) {
    const d = designs[i];
    const piece = designs.length > 1 ? `_kus${i + 1}` : "";
    const base = `banner_${it.width_cm || 0}x${it.height_cm || 0}${piece}`;

    // Originál (SVG/PDF/…) zůstává v plné kvalitě — jen odkaz, ne příloha.
    // Příloha by Vercel shodila (limit ~4,5 MB) a SVG se stejně nesmí mačkat.
    if (d.artworkPath) {
      try {
        const url = await getArtworkDownloadUrl(d.artworkPath, 60 * 60 * 24 * 7);
        links.push({ label: `Download ${base}`, url });
      } catch {
        /* bez odkazu — aspoň náhled */
      }
    }

    const preview = d.thumb || d.fullArtwork?.src || "";
    if (preview) {
      const thumb = await thumbAttachment(preview, `${base}_nahled.jpg`);
      if (thumb) thumbs.push(thumb);
    }
  }
  return { thumbs, links };
}

// Stany, nafukovací reklamu a brány vyrábí jiný dodavatel než plážové vlajky,
// takže se objednávka rozpadne na skupiny podle adresy z product_suppliers
// (nastavuje se ve formuláři produktu). Položky bez vlastního dodavatele
// spadnou do výchozí skupiny = adresa z Nastavení → Maily.
type SupplierGroup = { key: string; email: string; name: string; items: OrderItem[] };

function groupItemsBySupplier(
  items: OrderItem[],
  products: Product[],
  productSuppliers: Record<string, ProductSupplier>
): SupplierGroup[] {
  const categoryByProduct = new Map(products.map((p) => [p.id, p]));
  const groups = new Map<string, SupplierGroup>();
  for (const it of items) {
    const sup = it.product_id ? productSuppliers[it.product_id] : undefined;
    const email = (sup?.email || "").trim();
    const key = email.toLowerCase();
    const name = sup?.name?.trim() || categoryByProduct.get(it.product_id || "")?.name || "";
    const existing = groups.get(key);
    if (existing) existing.items.push(it);
    else groups.set(key, { key, email, name: email ? name : "", items: [it] });
  }
  return [...groups.values()];
}

export default function SendSupplierButton({
  order,
  items,
  products,
  productSuppliers,
}: {
  order: Order;
  items: OrderItem[];
  products: Product[];
  productSuppliers: Record<string, ProductSupplier>;
}) {
  const { openEmailPreview } = useEmailPreview();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const groups = groupItemsBySupplier(
    items.filter((it) => !isServiceLine(it)),
    products,
    productSuppliers
  );

  async function handleClick(group: SupplierGroup) {
    if (!group.items.length) {
      alert("Objednávka nemá položky.");
      return;
    }
    setBusyKey(group.key);
    try {
      const tpl = await getMailTemplatesForClient();
      const to = group.email || tpl.supplier;
      if (!to) {
        alert(
          "Tyhle položky nemají u produktu nastaveného dodavatele a v Nastavení → Maily není výchozí adresa dodavatele."
        );
        return;
      }
      const subject = `order - ${customerLabel(order)}`;
      const body = buildSupplierBodyText(order, group.items, tpl.signName, tpl.signPhone);

      const attachments: Att[] = [];
      const allLinks: { label: string; url: string }[] = [];
      for (const it of group.items) {
        if (isBanner(it)) {
          const { thumbs, links } = await bannerSupplierPack(it);
          attachments.push(...thumbs);
          allLinks.push(...links);
        } else if (it.design?.thumb) {
          const thumb = await thumbAttachment(it.design.thumb, `navrh_${it.shape || "vlajka"}_${it.size || ""}.jpg`);
          if (thumb) attachments.push(thumb);
        }
      }

      let extraHtml = "";
      if (allLinks.length) {
        extraHtml = `<p style="margin:22px 0 8px;font-size:14px;color:#374151"><strong>Artwork originals</strong> — full print quality, links valid 7 days:</p>
<ul style="margin:0;padding:0;list-style:none">
${allLinks
  .map(
    (l) =>
      `<li style="margin:0 0 10px"><a href="${escapeHtml(l.url)}" style="color:#1d4ed8;font-weight:600;text-decoration:underline">${escapeHtml(l.label)}</a></li>`
  )
  .join("")}
</ul>`;
      } else if (group.items.some(isBanner)) {
        extraHtml =
          `<p style="margin:22px 0 0;font-size:13px;color:#b45309">Note: banner originals are missing in storage — attachment is preview only. Re-upload artwork in the configurator.</p>`;
      }

      const bodyHtml = `<pre style="margin:0;font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;font-size:15px;line-height:1.55">${escapeHtml(body)}</pre>${extraHtml}`;
      const html = wrapEmailHtml(bodyHtml, tpl.signName, tpl.signPhone);

      openEmailPreview({
        kind: "supplier",
        orderId: order.id,
        to,
        subject,
        html,
        attachments,
      });
    } finally {
      setBusyKey(null);
    }
  }

  // Jeden dodavatel na celou objednávku = jedno tlačítko jako dřív.
  if (groups.length <= 1) {
    const group = groups[0] ?? { key: "", email: "", name: "", items: items.filter((it) => !isServiceLine(it)) };
    return (
      <button className="btn" onClick={() => handleClick(group)} disabled={busyKey !== null}>
        {busyKey !== null ? "Připravuji…" : "Odeslat dodavateli"}
      </button>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <button key={g.key} className="btn" onClick={() => handleClick(g)} disabled={busyKey !== null} title={g.email || undefined}>
          {busyKey === g.key
            ? "Připravuji…"
            : `Dodavateli: ${g.name || g.email || "výchozí"} (${g.items.length})`}
        </button>
      ))}
    </>
  );
}
