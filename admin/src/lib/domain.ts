// Pure domain helpers, ported 1:1 from the old app's app.js so behaviour
// (rounding, discount math, status labels) stays identical after the rebuild.
import type { Order, OrderItem, OrderTotals } from "./types";

export const WC_STATUSES: Record<string, string> = {
  pending: "Čeká na platbu",
  processing: "Zpracovává se",
  "on-hold": "Pozdržena",
  completed: "Dokončena",
  cancelled: "Zrušena",
  refunded: "Vrácena",
  failed: "Neúspěšná",
};

export const LOCAL_STATUSES: Record<string, string> = {
  "paid-awaiting": "Zaplaceno – čeká na dodání",
  "paid-delivering": "Zaplaceno – odesláno",
};

export const ALL_STATUSES: Record<string, string> = { ...WC_STATUSES, ...LOCAL_STATUSES };

export function isLocalStatus(s: string) {
  return Object.prototype.hasOwnProperty.call(LOCAL_STATUSES, s);
}

// An order counts toward finance/earnings once it's paid: either completed in
// WooCommerce terms, or one of our own local "zaplaceno" statuses.
export function isRealizedOrder(o: Pick<Order, "status">) {
  return o.status === "completed" || isLocalStatus(o.status);
}

export function statusLabel(s: string) {
  return ALL_STATUSES[s] || s || "—";
}

export function statusClass(s: string) {
  if (s === "processing") return "status-processing";
  if (s === "completed") return "status-completed";
  if (s === "pending" || s === "on-hold") return "status-pending";
  if (s === "cancelled" || s === "failed" || s === "refunded") return "status-cancelled";
  if (isLocalStatus(s)) return "status-paid-awaiting";
  return "status-local";
}

export function computeOrderTotals(
  o: Pick<Order, "discount_pct" | "shipping" | "ship_vat_rate">,
  items: Pick<OrderItem, "unit_price" | "qty" | "vat_rate">[]
): OrderTotals {
  const discountPct = o.discount_pct || 0;
  const f = (x: number) => (discountPct ? x * (1 - discountPct / 100) : x);
  let prodEx = 0;
  let prodVat = 0;
  for (const it of items) {
    const lineEx = (it.unit_price || 0) * (it.qty || 0);
    prodEx += lineEx;
    prodVat += lineEx * (it.vat_rate != null ? it.vat_rate : 0.21);
  }
  const discountEx = prodEx * (discountPct / 100);
  const netProdEx = prodEx - discountEx;
  const netProdVat = f(prodVat);
  const shipEx = o.shipping || 0;
  const shipVat = shipEx * (o.ship_vat_rate != null ? o.ship_vat_rate : 0.21);
  const totalEx = netProdEx + shipEx;
  const totalVat = netProdVat + shipVat;
  return {
    prodEx,
    discountEx,
    netProdEx,
    netProdVat,
    shipEx,
    shipVat,
    totalEx,
    totalVat,
    grand: totalEx + totalVat,
  };
}

export function fmtMoney(value: number, currency: "CZK" | "EUR" = "CZK") {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export function customerLabel(order: Pick<Order, "customer">) {
  const b = order.customer?.billing;
  if (!b) return "—";
  return b.company || b.name || "—";
}

export function customerEmail(order: Pick<Order, "customer">) {
  return order.customer?.billing?.email || "";
}

export const SUPPLIER = {
  name: "ACTUAL PRO s.r.o.",
  street: "nábřeží Míru 1055/82",
  city: "737 01 Český Těšín",
  ico: "25882201",
  dic: "CZ25882201",
  bank: "3512506359/0800",
  bic: "GIBACZPX",
};

export function isBanner(it: Pick<OrderItem, "type">) {
  return it.type === "banner";
}

export function itemLineTotal(it: Pick<OrderItem, "unit_price" | "qty">) {
  return (it.unit_price || 0) * (it.qty || 0);
}
