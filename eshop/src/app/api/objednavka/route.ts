import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import type { CartLine, CustomerAddress } from "@/lib/types";

type Body = {
  billing: CustomerAddress;
  shipping: CustomerAddress;
  note?: string;
  lines: CartLine[];
};

function isNonEmpty(s: string | undefined) {
  return typeof s === "string" && s.trim().length > 0;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const { billing, shipping, lines, note } = body;

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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      currency: "CZK",
      customer: { billing, shipping: shipping || billing },
      title: note ? `Objednávka z eshopu — ${note}`.slice(0, 200) : "Objednávka z eshopu",
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || "Nepodařilo se založit objednávku." }, { status: 500 });
  }

  const itemsPayload = lines.map((l) => ({
    order_id: order.id,
    type: l.type === "product" ? "flag" : l.type,
    shape: l.shape,
    size: l.size,
    qty: l.qty,
    unit_price: l.unitPrice,
    vat_rate: l.vatRate,
    wc_line_name: [l.name, l.note].filter(Boolean).join(" — "),
    design: l.design ?? null,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id });
}
