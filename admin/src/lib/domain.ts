// Pure domain helpers, ported 1:1 from the old app's app.js so behaviour
// (rounding, discount math, status labels) stays identical after the rebuild.
import type { Order, OrderItem, OrderTotals, Product, Settings, SupplierInvoice } from "./types";

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

export type ProductLookup = Pick<Product, "kind" | "config">;
type CostItem = Pick<
  OrderItem,
  "size" | "unit_price" | "width_cm" | "height_cm" | "product_id" | "material" | "variant_id" | "option_id" | "wc_line_name"
>;

// Nůžkové stany (tent_walls) neukládají výběr stěn strukturovaně — jen do
// wc_line_name (název položky), viz TentWallsConfigurator.handleAdd v eshopu.
// Aby šel spočítat náklad (a tedy i marže/podíl partnerů), zpětně to odsud
// naparsujeme — křehčí než sloupec v DB, ale funguje i na starší objednávky
// bez migrace.
const TENT_WALL_POSITION_LABELS: Record<string, "front" | "back" | "left" | "right"> = {
  "Přední stěna": "front",
  "Zadní stěna": "back",
  "Levá boční stěna": "left",
  "Pravá boční stěna": "right",
};
function parseTentWallsFromLineName(wcLineName: string | null | undefined) {
  const result: Partial<Record<"front" | "back" | "left" | "right", { full: boolean; double: boolean }>> = {};
  if (!wcLineName) return result;
  for (const [label, key] of Object.entries(TENT_WALL_POSITION_LABELS)) {
    const m = wcLineName.match(new RegExp(`${label}: (celá|poloviční) \\((jednostranný|oboustranný) potisk\\)`));
    if (m) result[key] = { full: m[1] === "celá", double: m[2] === "oboustranný" };
  }
  return result;
}
function tentWallOptionFor(cfg: NonNullable<Product["config"]>["tentWalls"], key: "front" | "back" | "left" | "right") {
  if (!cfg) return null;
  return key === "left" || key === "right" ? { full: cfg.fullWallSide, half: cfg.halfWallSide } : { full: cfg.fullWallBack, half: cfg.halfWallBack };
}

// Odhadovaný náklad jedné položky — podle produktu/volby, ze které vznikla
// (order_items.product_id/material/variant_id/option_id → products.config,
// nastavuje se ve formuláři produktu; viz "Nákupní cena"/"Náklad" u
// jednotlivých typů produktu). null = náklad neznámý (položka bez
// product_id — starší objednávka před migrací 2026-08-order-item-product-
// link.sql, nebo ručně přidaná položka bez vazby na katalog) — marže se u
// ní nezobrazuje (ne jako 0, ale jako "neznámá").
export function itemCost(item: CostItem, productById: Map<string, ProductLookup>, costPerSize: Settings["cost_per_size"]) {
  const product = item.product_id ? productById.get(item.product_id) : undefined;
  if (!product) {
    // Starší položka bez product_id — dřívější (a pořád fungující) odhad
    // podle globálního nastavení fungoval jen u vlajek.
    if (!item.size) return null;
    return costPerSize[item.size as keyof Settings["cost_per_size"]] ?? null;
  }
  const cfg = product.config;
  switch (product.kind) {
    case "configurable": {
      if (!item.size) return null;
      return cfg.costBySize?.[item.size as "S" | "M" | "L" | "XL"] ?? null;
    }
    case "simple":
      return cfg.buyPrice ?? null;
    case "options": {
      const o = cfg.options?.find((x) => x.id === item.option_id);
      return o ? o.buyPrice : null;
    }
    case "banner_m2": {
      if (item.width_cm == null || item.height_cm == null) return null;
      const mat = item.material === "mesh" ? cfg.banner?.mesh : item.material === "pvc" ? cfg.banner?.pvc : undefined;
      if (!mat) return null;
      return mat.buyPerM2 * ((item.width_cm / 100) * (item.height_cm / 100));
    }
    case "custom_flag": {
      if (item.width_cm == null || item.height_cm == null) return null;
      const mat = cfg.customFlag?.materials?.find((x) => x.id === item.material);
      if (!mat) return null;
      return mat.buyPerM2 * ((item.width_cm / 100) * (item.height_cm / 100));
    }
    case "variant": {
      const v = cfg.variants?.find((x) => x.id === item.variant_id);
      if (!v) return null;
      const costAir = v.cost + v.customs + v.airFreight + v.transactionFee;
      const costTrain = v.cost + v.customs + v.trainFreight + v.transactionFee;
      // Zvolený způsob dopravy (letecky/vlakem) se u položky zvlášť neukládá
      // — odvodí se z toho, které prodejní ceně (sellAir/sellTrain) je
      // uložená prodejní cena položky blíž.
      const nearerAir = Math.abs(item.unit_price - v.sellAir) <= Math.abs(item.unit_price - v.sellTrain);
      return nearerAir ? costAir : costTrain;
    }
    case "tent_walls": {
      const tw = cfg.tentWalls;
      if (!tw) return null;
      const walls = parseTentWallsFromLineName(item.wc_line_name);
      let cost = tw.baseBuy;
      for (const key of ["front", "back", "left", "right"] as const) {
        const w = walls[key];
        if (!w) continue;
        const opts = tentWallOptionFor(tw, key);
        if (!opts) continue;
        const o = w.full ? opts.full : opts.half;
        cost += w.double ? o.buyDouble : o.buySingle;
      }
      return cost;
    }
    default:
      return null;
  }
}

// Marže položky (prodejní cena − náklad) × počet kusů, nebo null, když
// náklad není známý (viz itemCost výš).
export function itemMargin(
  item: CostItem & Pick<OrderItem, "qty">,
  productById: Map<string, ProductLookup>,
  costPerSize: Settings["cost_per_size"]
) {
  const cost = itemCost(item, productById, costPerSize);
  if (cost == null) return null;
  return ((item.unit_price || 0) - cost) * (item.qty || 0);
}

// Podíl z tržby každé objednávky, který jde na provoz (web, účetní apod.)
// a nerozděluje se mezi partnery — odečítá se z položkové marže dřív, než
// se zbytek rozdělí (viz platby/page.tsx).
export const PLATFORM_FEE_PCT = 0.1;

// Náklad celé objednávky — přednostně přesný (faktury od dodavatele v Kč),
// jinak odhad součtem itemCost × qty přes položky, kde je náklad známý.
export function computeOrderCost(
  items: (CostItem & Pick<OrderItem, "qty">)[],
  invoices: Pick<SupplierInvoice, "amount_czk">[],
  productById: Map<string, ProductLookup>,
  costPerSize: Settings["cost_per_size"]
) {
  const actual = supplierActualCostCzk(invoices);
  if (actual > 0) return actual;
  let cost = 0;
  for (const it of items) {
    const c = itemCost(it, productById, costPerSize);
    if (c != null) cost += c * (it.qty || 0);
  }
  return cost;
}

// Zisk = základ daně celkem (produkty po slevě + doprava, bez DPH) − náklad.
// "exact" = máme fakturu od dodavatele (přesný zisk), jinak jde o
// předběžný odhad z nákladů nastavených u produktů.
export function computeOrderProfit(
  order: Pick<Order, "discount_pct" | "shipping" | "ship_vat_rate">,
  items: (CostItem & Pick<OrderItem, "qty" | "vat_rate">)[],
  invoices: Pick<SupplierInvoice, "amount_czk">[],
  productById: Map<string, ProductLookup>,
  costPerSize: Settings["cost_per_size"]
) {
  const totals = computeOrderTotals(order, items);
  const cost = computeOrderCost(items, invoices, productById, costPerSize);
  return { profit: totals.totalEx - cost, cost, exact: hasActualCost(invoices) };
}

// Marže položky rozdělená rovným dílem mezi partnery přiřazené téhle
// položce (order_items.partner_ids) — vrací mapu partner_id → částka.
// Položky s neznámou marží nebo bez přiřazených partnerů se do výsledku
// nepočítají (viz "nerozděleno" v Platbách, kde se to dopočítá zvlášť).
export function splitItemMarginByPartners(
  margin: number,
  partnerIds: string[]
): Map<string, number> {
  const result = new Map<string, number>();
  if (!partnerIds.length) return result;
  const share = margin / partnerIds.length;
  for (const id of partnerIds) result.set(id, (result.get(id) || 0) + share);
  return result;
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
  registry: "OR KS v Ostravě, oddíl C, vložka 24424",
};

export function isBanner(it: Pick<OrderItem, "type">) {
  return it.type === "banner";
}

export function itemLineTotal(it: Pick<OrderItem, "unit_price" | "qty">) {
  return (it.unit_price || 0) * (it.qty || 0);
}
