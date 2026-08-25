"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateVisualPdf } from "@/lib/pdf/visual";
import type { Customer, Design, Order, OrderItem } from "@/lib/types";

// Base64 PDF bytes pro přílohu e-mailu "Odeslat vizualizaci" — generuje se
// server-side ze stejných dat, co vidí objednávka v adminu (ne z prohlížeče).
export async function getVisualPdfBase64(orderId: string): Promise<string> {
  const supabase = await createClient();
  const [{ data: order, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", orderId).single(),
    supabase.from("order_items").select("*").eq("order_id", orderId),
  ]);
  if (orderErr || !order) throw new Error(orderErr?.message || "Objednávka nenalezena.");
  if (itemsErr) throw new Error(itemsErr.message);
  const bytes = await generateVisualPdf(order as Order, (items || []) as OrderItem[]);
  return Buffer.from(bytes).toString("base64");
}

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
    wc_line_name: string | null;
  }>
) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update(fields).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

// HS = zákazník chce vlastní barvu tunelu; bez HS je tunel jen odstín
// plachty a sleeveColor se při renderu ignoruje (viz eshop/src/lib/flagShapes.ts).
export async function updateItemHsSleeve(
  itemId: string,
  orderId: string,
  fields: { hs?: boolean; sleeveColor?: "white" | "black" }
) {
  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("order_items")
    .select("design")
    .eq("id", itemId)
    .single();
  if (readErr) throw new Error(readErr.message);
  const design = { ...(current?.design || {}), ...fields };
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

// Ruční přidání položky z reálného katalogu (AddItemButton) — na rozdíl od
// addOrderItem umí libovolný typ produktu (stany, bannery, totemy…), ne jen
// vlajky. wc_line_name nese plný popis (produkt + varianta/rozměr), shape a
// size se nastavují jen u skutečných vlajek (kind: configurable) — pro
// ostatní typy zůstávají null, takže je OrderDetailClient vykreslí bez
// (nesmyslných) tvar/velikost selectů pro vlajky.
export async function addOrderItemFromProduct(
  orderId: string,
  fields: {
    type: "flag" | "banner";
    shape: string | null;
    size: string | null;
    width_cm: number | null;
    height_cm: number | null;
    qty: number;
    unit_price: number;
    vat_rate: number;
    wc_line_name: string;
    product_id?: string | null;
    material?: string | null;
    variant_id?: string | null;
    option_id?: string | null;
    partner_ids?: string[];
  }
) {
  const supabase = await createClient();
  let { error } = await supabase.from("order_items").insert({ order_id: orderId, ...fields });
  if (error) {
    // product_id/material/variant_id/option_id/partner_ids jsou z novější
    // migrace (2026-08-order-item-product-link.sql) — dokud neproběhla,
    // zkusíme to bez nich, ať jde položku přidat i tak.
    ({ error } = await supabase.from("order_items").insert({
      order_id: orderId,
      type: fields.type,
      shape: fields.shape,
      size: fields.size,
      width_cm: fields.width_cm,
      height_cm: fields.height_cm,
      qty: fields.qty,
      unit_price: fields.unit_price,
      vat_rate: fields.vat_rate,
      wc_line_name: fields.wc_line_name,
    }));
  }
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}

// Ruční přiřazení/přepsání partnerů, kteří se dělí o zisk konkrétní položky
// (rovným dílem) — u nové položky se přednastaví podle products.partner_ids,
// tady jde přepsat.
export async function updateOrderItemPartners(itemId: string, orderId: string, partnerIds: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update({ partner_ids: partnerIds }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}

export async function deleteOrderItem(itemId: string, orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
}

export async function setSupplierPaid(orderId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ supplier_paid: paid }).eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function createOrder(customer: Customer) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert({
      status: "pending",
      currency: "CZK",
      customer,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  redirect(`/orders/${data.id}`);
}

export async function saveItemDesign(itemId: string, orderId: string, design: Design) {
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update({ design }).eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/design/${itemId}`);
}

// Smaže objednávku i její položky (order_items má on delete cascade).
// Faktura, faktury dodavatele a historie mailů zůstávají (order_id se jim
// jen nastaví na null, viz schema.sql) — jde o samostatné doklady, které
// se ruší zvlášť (viz deleteInvoice v lib/actions/invoices.ts).
export async function deleteOrder(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/orders");
  redirect("/orders");
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
