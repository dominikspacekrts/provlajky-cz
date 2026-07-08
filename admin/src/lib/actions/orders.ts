"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateOrderStatus(orderId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function updateOrderMoney(
  orderId: string,
  fields: { discount_pct?: number; shipping?: number; ship_vat_rate?: number }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function updateOrderItem(
  itemId: string,
  orderId: string,
  fields: Partial<{
    shape: string | null;
    size: string | null;
    qty: number;
    unit_price: number;
    vat_rate: number;
    width_cm: number | null;
    height_cm: number | null;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update(fields).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function updateItemSleeveColor(itemId: string, orderId: string, sleeveColor: "white" | "black") {
  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("order_items")
    .select("design")
    .eq("id", itemId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const design = { ...(current?.design || {}), sleeveColor };
  const { error } = await supabase.from("order_items").update({ design }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}

export async function addOrderItem(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").insert({
    order_id: orderId,
    type: "flag",
    shape: "A",
    size: "M",
    qty: 1,
    unit_price: 0,
    vat_rate: 0.21,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}

export async function deleteOrderItem(itemId: string, orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}

export async function updateOrderCustomer(
  orderId: string,
  customer: unknown
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ customer, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}
