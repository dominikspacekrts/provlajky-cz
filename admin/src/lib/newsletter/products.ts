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

/** Pevné kategorie v coldcall mailu — ne jednotlivé produkty. */
export type ColdcallCategoryDef = {
  id: string;
  label: string;
  href: string;
  /** Kategorie produktů, ze kterých se bere nejlevnější cena. */
  categories?: Product["category"][];
  /** PVC / mesh z banner_m2 produktů. */
  bannerMaterial?: "pvc" | "mesh";
  fallbackImage: string;
  /** Vynucená fotka (např. totem u nafukovací reklamy). */
  forceImage?: string;
};

export const COLDCALL_CATEGORY_DEFS: ColdcallCategoryDef[] = [
  {
    id: "plazove-vlajky",
    label: "Plážové vlajky",
    href: "/plazove-vlajky",
    categories: ["plazove-vlajky"],
    fallbackImage: "/produkty/plazova-vlajka-sirka.jpg",
  },
  {
    id: "nuzkove-stany-hex",
    label: "Nůžkové stany HEX",
    href: "/nuzkove-stany",
    categories: ["nuzkove-stany"],
    fallbackImage: "/stany/nuzkovy-3x3.jpg",
  },
  {
    id: "nafukovaci-stany-air",
    label: "Nafukovací stany AIR",
    href: "/nafukovaci-stany",
    categories: ["nafukovaci-stany"],
    fallbackImage: "/produkty/nafukovaci-stan.jpg",
  },
  {
    id: "bannery-na-miru",
    label: "Bannery na míru",
    href: "/produkt/pvc-banner-na-miru",
    bannerMaterial: "pvc",
    fallbackImage: "/produkty/banner-pvc.jpg",
  },
  {
    id: "meshe-na-miru",
    label: "Meshe na míru",
    href: "/produkt/mesh-banner-na-miru",
    bannerMaterial: "mesh",
    fallbackImage: "/produkty/banner-mesh.jpg",
  },
  {
    id: "nafukovaci-reklama",
    label: "Nafukovací reklama",
    href: "/brany-a-totemy",
    categories: ["totemy", "nafukovaci-brany"],
    fallbackImage: "/produkty/nafukovaci-totem.jpg",
    forceImage: "/produkty/nafukovaci-totem.jpg",
  },
];

export const COLDCALL_CATEGORY_IDS = COLDCALL_CATEGORY_DEFS.map((d) => d.id);

function cheapestInCategories(
  products: Product[],
  categories: Product["category"][]
): { price: number; image: string | null } {
  let price = 0;
  let image: string | null = null;
  for (const p of products) {
    if (!categories.includes(p.category)) continue;
    const from = productFromPrice(p);
    if (from <= 0) continue;
    if (price === 0 || from < price) {
      price = from;
      image = p.images?.[0] || image;
    } else if (!image && p.images?.[0]) {
      image = p.images[0];
    }
  }
  return { price, image };
}

function cheapestBannerMaterial(
  products: Product[],
  material: "pvc" | "mesh"
): { price: number; image: string | null } {
  let price = 0;
  let image: string | null = null;
  const preferSlug = material === "pvc" ? "pvc-banner-na-miru" : "mesh-banner-na-miru";
  for (const p of products) {
    if (p.kind !== "banner_m2" && p.category !== "pvc-bannery") continue;
    const sell = p.config?.banner?.[material]?.sellPerM2;
    if (!(typeof sell === "number" && sell > 0)) continue;
    if (price === 0 || sell < price || (sell === price && p.slug === preferSlug)) {
      price = sell;
      image = p.images?.[0] || image;
    }
  }
  return { price, image };
}

/** Karty kategorií pro coldcall — vždy stejné pořadí, cena „od …“ z aktivních produktů. */
export function buildColdcallCategoryCards(products: Product[]): NewsletterProductCard[] {
  const active = products.filter((p) => p.active !== false);
  return COLDCALL_CATEGORY_DEFS.map((def) => {
    const priced = def.bannerMaterial
      ? cheapestBannerMaterial(active, def.bannerMaterial)
      : cheapestInCategories(active, def.categories || []);
    return {
      id: def.id,
      name: def.label,
      slug: def.id,
      imageUrl: absoluteImage(def.forceImage || priced.image || def.fallbackImage),
      fromPrice: priced.price,
      perM2: !!def.bannerMaterial,
      url: withNewsletterUtm(`${SITE_URL}${def.href}`),
    };
  });
}

/**
 * Nech jen známé kategorie. Prázdný výběr zůstane prázdný.
 * Staré kampaně s UUID produktů → spadnou na všechny kategorie.
 */
export function normalizeColdcallCategoryIds(ids: string[] | null | undefined): string[] {
  const known = new Set(COLDCALL_CATEGORY_IDS);
  const raw = ids || [];
  const picked = raw.filter((id) => known.has(id));
  if (picked.length) return picked;
  if (raw.length > 0) return [...COLDCALL_CATEGORY_IDS];
  return [];
}
