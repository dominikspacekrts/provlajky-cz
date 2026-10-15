"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addPayout(partnerId: string, partnerName: string, amount: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").insert({
    partner_id: partnerId,
    partner_name: partnerName,
    amount,
    date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/platby");
}

export async function deletePayout(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("payouts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/platby");
}

export async function addSupplierInvoice(fields: {
  order_id?: string | null;
  supplier?: string;
  invoice_num?: string;
  date: string;
  /** Částka v EUR. Null, když je náklad zadaný rovnou v Kč. */
  amount: number | null;
  /** Kurz ČNB Kč/€. Null při zadání rovnou v Kč. */
  exchange_rate: number | null;
  /** Povinné při zadání v Kč. Při eurech se dopočte z kurzu. */
  amount_czk?: number | null;
  filename?: string | null;
  file_data?: string | null;
}) {
  const supabase = await createClient();
  const { amount_czk: amountCzkInput, ...rest } = fields;
  const amountCzk =
    fields.amount != null && fields.exchange_rate != null
      ? fields.amount * fields.exchange_rate
      : amountCzkInput ?? null;
  if (amountCzk == null || !Number.isFinite(Number(amountCzk)) || Number(amountCzk) <= 0) {
    throw new Error("Zadej částku větší než 0.");
  }
  const { error } = await supabase.from("supplier_invoices").insert({
    ...rest,
    amount_czk: amountCzk,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/statistika");
  if (fields.order_id) revalidatePath(`/orders/${fields.order_id}`);
}

export async function deleteSupplierInvoice(id: string, orderId?: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/statistika");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}

/** PDF/obrázek faktury se nenačítá do detailu objednávky (base64) — jen na klik. */
export async function getSupplierInvoiceFile(id: string): Promise<{ filename: string; file_data: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supplier_invoices")
    .select("filename, file_data")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.file_data) return null;
  return { filename: data.filename || "faktura", file_data: data.file_data };
}
