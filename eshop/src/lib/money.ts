import type { Product } from "./types";

export function fmtMoney(value: number) {
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  );
}

export function minSizePrice(priceBySize: Product["price_by_size"]) {
  const values = Object.values(priceBySize || {}).filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return Math.min(...values);
}
