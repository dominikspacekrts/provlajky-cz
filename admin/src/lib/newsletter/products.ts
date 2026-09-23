import type { Product } from "@/lib/types";
import type { NewsletterProductCard } from "./types";

const SITE_URL = (process.env.NEXT_PUBLIC_SHOP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://provlajky.cz").replace(
  /\/$/,
  ""
);

/** Nejnižší smysluplná výchozí cena produktu bez DPH. */
export function productFromPrice(p: Product): number {
  const candidates: number[] = [];
  if (p.price > 0) candidates.push(p.price);
  for (const v of Object.values(p.price_by_size || {})) {
    if (typeof v === "number" && v > 0) candidates.push(v);
  }
  const variants = p.config?.variants || [];
  for (const v of variants) {
    if (v.sellTrain > 0) candidates.push(v.sellTrain);
    if (v.sellAir > 0) candidates.push(v.sellAir);
  }
  const options = p.config?.options || [];
  for (const o of options) {
    if (o.sellPrice > 0) candidates.push(o.sellPrice);
  }
  const tw = p.config?.tentWalls;
  if (tw?.baseSell) candidates.push(tw.baseSell);
  if (tw?.baseSellTrain) candidates.push(tw.baseSellTrain);
  if (tw?.stockBaseSell) candidates.push(tw.stockBaseSell);
  if (tw?.stockBaseSellTrain) candidates.push(tw.stockBaseSellTrain);
  if (!candidates.length) return 0;
  return Math.min(...candidates);
}

function absoluteImage(src: string | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

export function toProductCard(p: Product): NewsletterProductCard {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: absoluteImage(p.images?.[0]),
    fromPrice: productFromPrice(p),
    url: `${SITE_URL}/produkt/${encodeURIComponent(p.slug)}`,
  };
}

export function shopHomeUrl() {
  return SITE_URL;
}
