"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, isBanner } from "@/lib/domain";
import { generateInvoicePdf } from "@/lib/pdf/invoice";
import type { Invoice, Order, OrderItem } from "@/lib/types";

async function nextInvoiceNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const year = new Date().getFullYear();
  const prefix = String(year);
  const { data } = await supabase.from("invoices").select("number").ilike("number", `${prefix}%`);
  let max = 0;
  for (const row of data || []) {
    const seq = parseInt(String(row.number).slice(prefix.length), 10);
    if (seq > max) max = seq;
  }
  return prefix + String(max + 1).padStart(4, "0");
}

// Mirrors buildInvoiceFromOrder() from app.js:4221 — returns the row to insert.
function buildInvoiceRow(order: Order, items: OrderItem[], number: string) {
  const totals = computeOrderTotals(order, items);
  const now = new Date();
  const due = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const b = order.customer?.billing || {};
  const s = order.customer?.shipping || {};
  return {
    number,
    kind: "product" as const,
    order_id: order.id,
    order_number: order.order_number,
    issued: now.toISOString().slice(0, 10),
    tax_date: now.toISOString().slice(0, 10),
    due: due.toISOString().slice(0, 10),
    paid: false,
    currency: order.currency || "CZK",
    foreign: !!order.foreign,
    customer: b,
    shipping_customer: {
      ship_company: s.company,
      ship_name: s.name,
      ship_street: s.street,
      ship_psc: s.psc,
      ship_city: s.city,
      ship_phone: s.phone,
    },
    items: items.map((it) => ({
      desc: isBanner(it)
        ? `PVC banner – ${it.width_cm || 0}×${it.height_cm || 0} cm`
        : `Plážová vlajka – tvar ${it.shape}, velikost ${it.size}`,
      qty: it.qty,
      unitPrice: it.unit_price || 0,
      vatRate: it.vat_rate != null ? it.vat_rate : 0.21,
      thumb: it.design?.thumb || null,
      thumbBounds: it.design?.flagBounds || null,
    })),
    discount_pct: order.discount_pct || 0,
    shipping: order.shipping || 0,
    ship_vat_rate: order.ship_vat_rate != null ? order.ship_vat_rate : 0.21,
    totals,
  };
}

// Reuse the existing invoice for this order if one exists (matches old app
// behaviour: "send invoice" reuses rather than duplicates), else create one.
export async function getOrCreateInvoiceForOrder(orderId: string): Promise<Invoice> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoices")
    .select("*")
    .eq("order_id", orderId)
    .eq("kind", "product")
    .maybeSingle();
  if (existing) return existing as Invoice;

  const [{ data: order, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single(),
    supabase.from("order_items").select("*").eq("order_id", orderId),
  ]);
  if (orderErr || !order) throw new Error(orderErr?.message || "Objednávka nenalezena.");
  if (itemsErr) throw new Error(itemsErr.message);

  const number = await nextInvoiceNumber(supabase);
  const row = buildInvoiceRow(order as Order, (items || []) as OrderItem[], number);
  const { data: inserted, error: insErr } = await supabase.from("invoices").insert(row).select("*").single();
  if (insErr) throw new Error(insErr.message);
  return inserted as Invoice;
}

export async function setInvoicePaid(invoiceId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ paid }).eq("id", invoiceId);
  if (error) throw new Error(error.message);
  revalidatePath("/finance");
}

// Base64 PDF bytes for e-mail attachments (used by SendInvoiceButton) — generating
// server-side here avoids round-tripping the PDF through the browser first.
export async function getInvoicePdfBase64(invoiceId: string): Promise<{ base64: string; number: string }> {
  const supabase = await createClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) throw new Error(error?.message || "Faktura nenalezena.");
  const bytes = await generateInvoicePdf(invoice as Invoice);
  return { base64: Buffer.from(bytes).toString("base64"), number: (invoice as Invoice).number };
}
