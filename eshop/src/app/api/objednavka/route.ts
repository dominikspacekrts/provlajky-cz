import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase";
import { fmtMoney } from "@/lib/money";
import type { CartLine, CustomerAddress, ProductCategory } from "@/lib/types";

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  from?: string;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function orderConfirmationEmailHtml(orderLabel: string, billing: CustomerAddress, lines: CartLine[]): string {
  const rows = lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(l.name)}${
          l.note ? `<br><span style="color:#777;font-size:12px;">${escapeHtml(l.note)}</span>` : ""
        }</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${l.qty}×</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(l.unitPrice * l.qty)}</td>
        </tr>`
    )
    .join("");
  const subtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const vat = lines.reduce((s, l) => s + l.unitPrice * l.qty * l.vatRate, 0);
  const name = billing.name || billing.company || "";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
      <p>Dobrý den${name ? ` ${escapeHtml(name)}` : ""},</p>
      <p>děkujeme, přijali jsme Vaši objednávku <strong>${escapeHtml(orderLabel)}</strong> na provlajky.cz. Ozveme se s pokyny k platbě, případně upřesněním detailů.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #08080a;">Položka</th>
            <th style="text-align:center;padding:6px 10px;border-bottom:2px solid #08080a;">Ks</th>
            <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #08080a;">Cena</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:14px;">
        Mezisoučet bez DPH: <strong>${fmtMoney(subtotalEx)}</strong><br>
        DPH: <strong>${fmtMoney(vat)}</strong><br>
        Celkem: <strong>${fmtMoney(subtotalEx + vat)}</strong>
      </p>
      <p>Máte dotaz? Ozvěte se na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> nebo <a href="tel:+420605981155">+420 605 981 155</a>.</p>
      <p>Tým PROVLAJKY.CZ</p>
    </div>
  `;
}

type Body = {
  billing: CustomerAddress;
  shipping: CustomerAddress;
  note?: string;
  lines: CartLine[];
  discountCode?: string;
};

function isNonEmpty(s: string | undefined) {
  return typeof s === "string" && s.trim().length > 0;
}

// Bucket pro nahranou grafiku podle kategorie produktu (buckety založené
// ručně v Supabase Storage — public, bez size limitu).
const CATEGORY_BUCKET: Partial<Record<ProductCategory, string>> = {
  "plazove-vlajky": "grafika_plazove_vlajky",
  "vlajky-na-zakazku": "grafika_vlajky",
  "pvc-bannery": "grafika_bannery",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const ext = EXT_BY_MIME[contentType] || "bin";
  return { buffer: Buffer.from(m[2], "base64"), contentType, ext };
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const { billing, shipping, lines, note, discountCode } = body;

  if (!billing || !isNonEmpty(billing.email) || (!isNonEmpty(billing.name) && !isNonEmpty(billing.company))) {
    return NextResponse.json({ error: "Vyplňte prosím jméno/firmu a e-mail." }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: "Košík je prázdný." }, { status: 400 });
  }
  if (billing.isCompany && !isNonEmpty(billing.ico)) {
    return NextResponse.json({ error: "Nákup na firmu vyžaduje IČO." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Slevový kód se ověřuje a spotřebovává výhradně tady, server-side — nikdy
  // z prohlížeče. Neplatný/použitý kód objednávku odmítne, ať zákazník ví,
  // že sleva neprošla, místo aby se potichu ztratila.
  let discountCustomer: { id: string; discount_pct: number } | null = null;
  const normalizedCode = discountCode?.trim().toUpperCase();
  if (normalizedCode) {
    const { data: customer, error: lookupError } = await supabase
      .from("customers")
      .select("id, discount_pct, used_at")
      .eq("discount_code", normalizedCode)
      .maybeSingle();
    if (lookupError) {
      console.error("objednavka: discount code lookup failed", lookupError);
      return NextResponse.json({ error: "Nepodařilo se ověřit slevový kód, zkuste to prosím znovu." }, { status: 500 });
    }
    if (!customer || customer.used_at) {
      return NextResponse.json({ error: "Slevový kód je neplatný nebo už byl použitý." }, { status: 400 });
    }
    discountCustomer = { id: customer.id, discount_pct: customer.discount_pct };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      currency: "CZK",
      customer: { billing, shipping: shipping || billing },
      title: note ? `Objednávka z eshopu — ${note}`.slice(0, 200) : "Objednávka z eshopu",
      discount_pct: discountCustomer?.discount_pct ?? 0,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    if (orderError) console.error("objednavka: order insert failed", orderError);
    return NextResponse.json({ error: "Nepodařilo se založit objednávku, zkuste to prosím znovu." }, { status: 500 });
  }

  if (discountCustomer) {
    await supabase
      .from("customers")
      .update({ used_at: new Date().toISOString(), used_order_id: order.id })
      .eq("id", discountCustomer.id);
  }

  // Nahraná grafika (logo u vlajek, artwork u banneru/vlajky na zakázku) se
  // navíc uloží do Supabase Storage pod číslem objednávky — base64 v design
  // JSONu se nemaže (pořád ho čte vizualizace/editor v adminu), tohle je jen
  // veřejná URL originálu k výrobě (viz Design.artworkUrl).
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const categoryById = new Map<string, ProductCategory>();
  const partnerIdsByProduct = new Map<string, string[]>();
  if (productIds.length) {
    const { data: products } = await supabase.from("products").select("id, category").in("id", productIds);
    for (const p of products || []) categoryById.set(p.id, p.category as ProductCategory);
    // products.partner_ids je z novější migrace (2026-08-order-item-product-link.sql)
    // — samostatný dotaz, ať nezhroutí i tu předchozí, dokud migrace neproběhla.
    try {
      const { data: withPartners, error } = await supabase.from("products").select("id, partner_ids").in("id", productIds);
      if (error) throw error;
      for (const p of withPartners || []) partnerIdsByProduct.set(p.id, (p.partner_ids as string[]) || []);
    } catch {
      // sloupec ještě neexistuje — položky se prostě založí bez výchozích partnerů
    }
  }

  const itemsPayload = await Promise.all(
    lines.map(async (l, i) => {
      let design = l.design ?? null;
      const bucket = CATEGORY_BUCKET[categoryById.get(l.productId) as ProductCategory];
      const graphicSrc = design?.logo?.src || design?.thumb || null;
      if (bucket && graphicSrc) {
        const decoded = decodeDataUrl(graphicSrc);
        if (decoded) {
          // order_number přiděluje DB trigger (2026-08-order-numbering.sql) —
          // dokud migrace neběžela, order.order_number je null; radši dočasně
          // roztřídit pod ID objednávky, než abychom všechno házeli do jedné
          // společné složky "null".
          const folder = order.order_number || order.id;
          const storagePath = `${folder}/${i + 1}.${decoded.ext}`;
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, decoded.buffer, { contentType: decoded.contentType, upsert: true });
          if (uploadError) {
            console.error("objednavka: storage upload failed", uploadError);
          } else {
            const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
            design = { ...design, artworkUrl: pub.publicUrl };
          }
        }
      }
      return {
        order_id: order.id,
        type: l.type === "product" ? "flag" : l.type,
        shape: l.shape,
        size: l.size,
        width_cm: l.widthCm ?? null,
        height_cm: l.heightCm ?? null,
        qty: l.qty,
        unit_price: l.unitPrice,
        vat_rate: l.vatRate,
        wc_line_name: [l.name, l.note].filter(Boolean).join(" — "),
        design,
        product_id: l.productId || null,
        material: l.material ?? null,
        variant_id: l.variantId ?? null,
        option_id: l.optionId ?? null,
        partner_ids: partnerIdsByProduct.get(l.productId) ?? [],
      };
    })
  );

  let { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsError) {
    // Sloupce product_id/material/variant_id/option_id/partner_ids jsou z
    // novější migrace (2026-08-order-item-product-link.sql) — dokud neproběhla,
    // zkusíme to znovu bez nich, ať objednávka nespadne kvůli chybějícímu sloupci.
    const fallbackPayload = itemsPayload.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tahle pole se schválně zahodí
      ({ product_id, material, variant_id, option_id, partner_ids, ...rest }) => rest
    );
    ({ error: itemsError } = await supabase.from("order_items").insert(fallbackPayload));
  }
  if (itemsError) {
    console.error("objednavka: order_items insert failed", itemsError);
    return NextResponse.json({ error: "Nepodařilo se uložit položky objednávky, zkuste to prosím znovu." }, { status: 500 });
  }

  // Potvrzovací e-mail zákazníkovi — objednávka je v DB hotová bez ohledu na to,
  // jestli se mail povede odeslat, takže selhání tady nesmí shodit odpověď.
  try {
    const { data: settingsRow } = await supabase.from("settings").select("mail").eq("id", 1).single();
    const mail = settingsRow?.mail as MailSettings | undefined;
    if (mail?.host && mail?.user) {
      const orderLabel = order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`;
      const subject = `Potvrzení objednávky ${orderLabel} — provlajky.cz`;
      const html = orderConfirmationEmailHtml(orderLabel, billing, lines);
      const transporter = nodemailer.createTransport({
        host: mail.host,
        port: Number(mail.port) || 587,
        secure: !!mail.secure,
        auth: { user: mail.user, pass: mail.pass },
      });
      const fromName = mail.fromName || "PROVLAJKY";
      const fromAddr = mail.from || mail.user;
      try {
        await transporter.sendMail({ from: `"${fromName}" <${fromAddr}>`, to: billing.email, subject, html });
        await supabase.from("email_history").insert({
          sent_by: mail.user,
          kind: "other",
          to_addr: billing.email,
          cc: [],
          bcc: [],
          subject,
          html_body: html,
          attachments_meta: [],
          status: "sent",
        });
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : "Neznámá chyba odeslání.";
        console.error("objednavka: confirmation email failed", sendError);
        await supabase.from("email_history").insert({
          sent_by: mail.user,
          kind: "other",
          to_addr: billing.email,
          cc: [],
          bcc: [],
          subject,
          html_body: html,
          attachments_meta: [],
          status: "failed",
          error_message: message,
        });
      }
    }
  } catch (e) {
    console.error("objednavka: confirmation email step failed", e);
  }

  return NextResponse.json({ orderId: order.id });
}
