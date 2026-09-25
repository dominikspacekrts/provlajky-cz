import type { Product } from "@/lib/types";
import type { NewsletterProductCard } from "./types";

const SITE_URL = (process.env.NEXT_PUBLIC_SHOP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://provlajky.cz").replace(
  /\/$/,
  ""
);

const minPositive = (values: (number | undefined | null)[]): number => {
  const ok = values.filter((v): v is number => typeof v === "number" && v > 0);
  return ok.length ? Math.min(...ok) : 0;
};

/** Produkty prodávané za m² — cena na kartě je „od X Kč/m²“. */
export function productPricedPerM2(p: Product): boolean {
  return p.kind === "banner_m2" || p.kind === "custom_flag";
}

/** Nejnižší výchozí cena bez DPH — stejná logika jako „od …“ v eshopu. */
export function productFromPrice(p: Product): number {
  const cfg = p.config;
  switch (p.kind) {
    case "banner_m2":
      return minPositive([cfg?.banner?.pvc?.sellPerM2, cfg?.banner?.mesh?.sellPerM2]);
    case "custom_flag":
      return minPositive((cfg?.customFlag?.materials || []).map((m) => m.sellPerM2));
    case "variant":
      return minPositive((cfg?.variants || []).flatMap((v) => [v.sellAir, v.sellTrain]));
    case "options":
      return minPositive((cfg?.options || []).map((o) => o.sellPrice));
    case "configurable":
      return minPositive(Object.values(p.price_by_size || {}));
    case "tent_walls": {
      const tw = cfg?.tentWalls;
      return minPositive([tw?.baseSell, tw?.baseSellTrain, tw?.stockBaseSell, tw?.stockBaseSellTrain]);
    }
    default:
      return minPositive([p.price]);
  }
}

function absoluteImage(src: string | undefined): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  return `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
}

/** UTM pro měření prokliků z newsletteru v admin → Návštěvnost. */
export function withNewsletterUtm(url: string, campaign = "newsletter"): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("utm_source")) parsed.searchParams.set("utm_source", "newsletter");
    if (!parsed.searchParams.has("utm_medium")) parsed.searchParams.set("utm_medium", "email");
    if (!parsed.searchParams.has("utm_campaign")) parsed.searchParams.set("utm_campaign", campaign);
    return parsed.toString();
  } catch {
    return url;
  }
}

export function toProductCard(p: Product): NewsletterProductCard {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: absoluteImage(p.images?.[0]),
    fromPrice: productFromPrice(p),
    perM2: productPricedPerM2(p),
    url: withNewsletterUtm(`${SITE_URL}/produkt/${encodeURIComponent(p.slug)}`),
  };
}

export function shopHomeUrl() {
  return withNewsletterUtm(SITE_URL);
}
