// Pure domain helpers, ported 1:1 from the old app's app.js so behaviour
// (rounding, discount math, status labels) stays identical after the rebuild.
import type { Order, OrderItem, OrderTotals, Settings, SupplierInvoice } from "./types";

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

// --- Náklady a zisk (1:1 port ze starého app.js — computeOrderCost/computeOrderProfit) ---

// Součet faktur od dodavatele přepočtených na Kč — přesný náklad, pokud existuje.
export function supplierActualCostCzk(invoices: Pick<SupplierInvoice, "amount_czk">[]) {
  return invoices.reduce((s, inv) => s + (inv.amount_czk || 0), 0);
}
export function hasActualCost(invoices: Pick<SupplierInvoice, "amount_czk">[]) {
  return supplierActualCostCzk(invoices) > 0;
}

// Odhadovaný náklad jedné položky podle nastavení Kč/vlajku dle velikosti
// (settings.cost_per_size) — jen vlajky mají velikost, u ostatních typů
// položek (bannery, stany…) obdobná nákladová tabulka není, marže se u
// nich proto nezobrazuje (ne 0, ale "neznámá").
export function itemCost(item: Pick<OrderItem, "size">, costPerSize: Settings["cost_per_size"]) {
  if (!item.size) return null;
  return costPerSize[item.size as keyof Settings["cost_per_size"]] ?? null;
}

// Marže položky (prodejní cena − náklad) × počet kusů, nebo null, když
// náklad není známý (viz itemCost výš).
export function itemMargin(item: Pick<OrderItem, "size" | "unit_price" | "qty">, costPerSize: Settings["cost_per_size"]) {
  const cost = itemCost(item, costPerSize);
  if (cost == null) return null;
  return ((item.unit_price || 0) - cost) * (item.qty || 0);
}

// Náklad celé objednávky — přednostně přesný (faktury od dodavatele v Kč),
// jinak odhad součtem itemCost × qty přes položky, kde je náklad známý.
export function computeOrderCost(
  items: Pick<OrderItem, "size" | "qty">[],
  invoices: Pick<SupplierInvoice, "amount_czk">[],
  costPerSize: Settings["cost_per_size"]
) {
  const actual = supplierActualCostCzk(invoices);
  if (actual > 0) return actual;
  let cost = 0;
  for (const it of items) {
    const c = itemCost(it, costPerSize);
    if (c != null) cost += c * (it.qty || 0);
  }
  return cost;
}

// Zisk = základ daně celkem (produkty po slevě + doprava, bez DPH) − náklad.
// "exact" = máme fakturu od dodavatele (přesný zisk), jinak jde o
// předběžný odhad z nastavení marže.
export function computeOrderProfit(
  order: Pick<Order, "discount_pct" | "shipping" | "ship_vat_rate">,
  items: Pick<OrderItem, "unit_price" | "qty" | "vat_rate" | "size">[],
  invoices: Pick<SupplierInvoice, "amount_czk">[],
  costPerSize: Settings["cost_per_size"]
) {
  const totals = computeOrderTotals(order, items);
  const cost = computeOrderCost(items, invoices, costPerSize);
  return { profit: totals.totalEx - cost, cost, exact: hasActualCost(invoices) };
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

// Číslo objednávky (= číslo faktury = variabilní symbol, viz
// 2026-08-order-numbering.sql) je jediný identifikátor v názvu — žádný
// text z order.title (ten je jen interní poznámka, ne popisek pro seznam).
export function orderLabel(order: Pick<Order, "order_number">) {
  return `Objednávka č. ${order.order_number || "—"}`;
}

// Eshop API vždycky nastaví title na "Objednávka z eshopu" (viz
// eshop/src/app/api/objednavka/route.ts), ruční objednávka založená v
// adminu (createOrder) title nenastavuje vůbec — podle toho jde odlišit
// zdroj bez nutnosti nového sloupce v DB.
export function orderSource(order: Pick<Order, "title">): "eshop" | "manual" {
  return order.title?.startsWith("Objednávka z eshopu") ? "eshop" : "manual";
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
