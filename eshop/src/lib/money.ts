import type { BannerMaterialPricing, Product, ProductVariant } from "./types";

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

// ── Varianty (stany, nafukovací, díly) ───────────────────────────────────────
export type DeliverySpeed = "fast" | "slow"; // fast = do 14 dní (letecky), slow = do 4 týdnů (vlakem)

export const DELIVERY_LABEL: Record<DeliverySpeed, string> = {
  fast: "Dodání do 14 dní",
  slow: "Dodání do 4 týdnů",
};

export function variantSellPrice(v: ProductVariant, speed: DeliverySpeed): number {
  return speed === "fast" ? v.sellAir : v.sellTrain;
}

// Které rychlosti dodání mají u varianty nastavenou (kladnou) prodejní cenu.
export function availableSpeeds(v: ProductVariant): DeliverySpeed[] {
  const out: DeliverySpeed[] = [];
  if (v.sellAir > 0) out.push("fast");
  if (v.sellTrain > 0) out.push("slow");
  return out;
}

// Nejnižší kladná prodejní cena napříč variantami — pro „od …" na dlaždici.
export function minVariantSell(variants: ProductVariant[] | undefined): number | null {
  const prices = (variants ?? []).flatMap((v) => [v.sellAir, v.sellTrain]).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

// ── Banner na m² ──────────────────────────────────────────────────────────────
export type BannerMaterial = "pvc" | "mesh";

export const BANNER_MATERIAL_LABEL: Record<BannerMaterial, string> = {
  pvc: "PVC plachtovina",
  mesh: "Mesh (síťovina)",
};

// Plocha v m² ze zadaných centimetrů (min. účtovaná 0,25 m²).
export function bannerAreaM2(widthCm: number, heightCm: number): number {
  const m2 = (Math.max(0, widthCm) / 100) * (Math.max(0, heightCm) / 100);
  return m2;
}

export function bannerPrice(pricing: BannerMaterialPricing, widthCm: number, heightCm: number): number {
  const m2 = bannerAreaM2(widthCm, heightCm);
  const billable = Math.max(m2, 0.25); // minimální účtovaná plocha
  return Math.round(billable * (pricing.sellPerM2 || 0));
}

export function minBannerSell(product: Product): number | null {
  const b = product.config?.banner;
  const sells = [b?.pvc.sellPerM2, b?.mesh.sellPerM2].filter((v): v is number => !!v && v > 0);
  return sells.length ? Math.min(...sells) : null;
}

// Sjednocené „od …" na kartě kategorie podle typu produktu.
export function fromPrice(product: Product): number | null {
  if (product.kind === "simple") return product.price || null;
  if (product.kind === "configurable") return minSizePrice(product.price_by_size);
  if (product.kind === "variant") return minVariantSell(product.config?.variants);
  if (product.kind === "banner_m2") return minBannerSell(product);
  return null;
}
