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
  revalidatePath("/finance");
}

export async function addSupplierInvoice(fields: {
  order_id?: string | null;
  supplier?: string;
  invoice_num?: string;
  date: string;
  amount: number; // EUR
  exchange_rate: number;
  filename?: string | null;
  file_data?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_invoices").insert({
    ...fields,
    amount_czk: fields.amount * fields.exchange_rate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/finance");
  if (fields.order_id) revalidatePath(`/orders/${fields.order_id}`);
}

export async function deleteSupplierInvoice(id: string, orderId?: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/finance");
  if (orderId) revalidatePath(`/orders/${orderId}`);
}
