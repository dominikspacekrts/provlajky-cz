import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { CartLine, CustomerAddress, ProductCategory } from "@/lib/types";

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
  if (productIds.length) {
    const { data: products } = await supabase.from("products").select("id, category").in("id", productIds);
    for (const p of products || []) categoryById.set(p.id, p.category as ProductCategory);
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
        qty: l.qty,
        unit_price: l.unitPrice,
        vat_rate: l.vatRate,
        wc_line_name: [l.name, l.note].filter(Boolean).join(" — "),
        design,
      };
    })
  );

  const { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsError) {
    console.error("objednavka: order_items insert failed", itemsError);
    return NextResponse.json({ error: "Nepodařilo se uložit položky objednávky, zkuste to prosím znovu." }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id });
}
