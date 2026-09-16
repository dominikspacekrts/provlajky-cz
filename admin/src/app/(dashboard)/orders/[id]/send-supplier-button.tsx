"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { buildSupplierBodyText } from "@/lib/email-templates";
import { customerLabel } from "@/lib/domain";
import type { Order, OrderItem, Product, ProductSupplier } from "@/lib/types";

function dataUrlToAttachment(dataUrl: string, filename: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  return { filename, contentBase64: m[2], contentType: m[1] };
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

  const groups = groupItemsBySupplier(items, products, productSuppliers);

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
      const html = `<pre style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap">${body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`;

      const attachments = group.items
        .map((it, i) =>
          it.design?.thumb ? dataUrlToAttachment(it.design.thumb, `navrh_${it.shape || i + 1}_${it.size || ""}.png`) : null
        )
        .filter((a): a is NonNullable<typeof a> => Boolean(a));

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
    const group = groups[0] ?? { key: "", email: "", name: "", items };
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
