import { createServiceClient } from "@/lib/supabase";
import { getLoggedInProfile } from "@/lib/customer-profile";
import { round2 } from "@/lib/money";
import type { CustomerAddress } from "@/lib/types";
import { customerStatusLabel } from "@/lib/order-status";
import type { CustomerOrderDetail, CustomerOrderSummary } from "@/lib/customer-order-types";

export type { CustomerOrderDetail, CustomerOrderLine, CustomerOrderSummary } from "@/lib/customer-order-types";

function orderEmail(customerJson: unknown): string {
  const c = customerJson as { billing?: { email?: string } } | null;
  return (c?.billing?.email || "").trim().toLowerCase();
}

function computeTotals(
  discountPct: number,
  shippingEx: number,
  shipVatRate: number,
  items: { unit_price: number | null; qty: number | null; vat_rate: number | null }[],
) {
  let prodEx = 0;
  let prodVat = 0;
  for (const it of items) {
    const lineEx = (it.unit_price || 0) * (it.qty || 0);
    const vatRate = it.vat_rate != null ? it.vat_rate : 0.21;
    prodEx += lineEx;
    prodVat += lineEx * vatRate;
  }
  const discountEx = prodEx * ((discountPct || 0) / 100);
  const netProdEx = prodEx - discountEx;
  const netProdVat = discountPct ? prodVat * (1 - discountPct / 100) : prodVat;
  const shipEx = shippingEx || 0;
  const shipVat = shipEx * (shipVatRate != null ? shipVatRate : 0.21);
  const totalEx = netProdEx + shipEx;
  const totalVat = netProdVat + shipVat;
  return {
    discountEx: round2(discountEx),
    totalEx: round2(totalEx),
    totalIncVat: round2(totalEx + totalVat),
  };
}

/** Objednávky přihlášeného zákazníka — shoda e-mailu ve fakturačních údajích. */
export async function listOrdersForSession(): Promise<CustomerOrderSummary[] | null> {
  const profile = await getLoggedInProfile();
  if (!profile) return null;

  const email = profile.email.trim().toLowerCase();
  const supabase = createServiceClient();

  // PostgREST filtr na JSON cestu; e-maily ukládáme lower-case, ale filtrujeme case-insensitive.
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, discount_pct, shipping, ship_vat_rate, customer")
    .filter("customer->billing->>email", "ilike", email)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("listOrdersForSession:", error);
    return [];
  }

  const rows = (orders || []).filter((o) => orderEmail(o.customer) === email);
  if (!rows.length) return [];

  const ids = rows.map((o) => o.id);
  const { data: itemRows } = await supabase
    .from("order_items")
    .select("order_id, unit_price, qty, vat_rate")
    .in("order_id", ids);

  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const it of itemRows || []) {
    const list = itemsByOrder.get(it.order_id) || [];
    list.push(it);
    itemsByOrder.set(it.order_id, list);
  }

  return rows.map((o) => {
    const totals = computeTotals(
      Number(o.discount_pct) || 0,
      Number(o.shipping) || 0,
      o.ship_vat_rate != null ? Number(o.ship_vat_rate) : 0.21,
      itemsByOrder.get(o.id) || [],
    );
    return {
      id: o.id,
      orderNumber: o.order_number ? String(o.order_number) : null,
      status: o.status,
      statusLabel: customerStatusLabel(o.status),
      createdAt: o.created_at,
      totalEx: totals.totalEx,
      totalIncVat: totals.totalIncVat,
    };
  });
}

export async function getOrderDetailForSession(orderId: string): Promise<CustomerOrderDetail | null | "unauthorized"> {
  const profile = await getLoggedInProfile();
  if (!profile) return "unauthorized";

  const email = profile.email.trim().toLowerCase();
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, discount_pct, shipping, ship_vat_rate, customer")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || orderEmail(order.customer) !== email) {
    return null;
  }

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("wc_line_name, qty, unit_price, vat_rate, size, shape, width_cm, height_cm")
    .eq("order_id", orderId);

  const itemsRaw = itemRows || [];
  const totals = computeTotals(
    Number(order.discount_pct) || 0,
    Number(order.shipping) || 0,
    order.ship_vat_rate != null ? Number(order.ship_vat_rate) : 0.21,
    itemsRaw,
  );

  const cust = order.customer as { billing?: CustomerAddress; shipping?: CustomerAddress } | null;

  return {
    id: order.id,
    orderNumber: order.order_number ? String(order.order_number) : null,
    status: order.status,
    statusLabel: customerStatusLabel(order.status),
    createdAt: order.created_at,
    totalEx: totals.totalEx,
    totalIncVat: totals.totalIncVat,
    discountPct: Number(order.discount_pct) || 0,
    discountEx: totals.discountEx,
    shippingEx: round2(Number(order.shipping) || 0),
    items: itemsRaw.map((it) => {
      const lineEx = (it.unit_price || 0) * (it.qty || 0);
      const size =
        it.width_cm && it.height_cm ? `${it.width_cm}×${it.height_cm} cm` : it.size || null;
      return {
        name: it.wc_line_name || "Položka",
        qty: it.qty || 0,
        unitPrice: it.unit_price || 0,
        lineEx: round2(lineEx),
        size,
        shape: it.shape || null,
      };
    }),
    billing: cust?.billing ?? null,
    shipping: cust?.shipping ?? null,
  };
}
