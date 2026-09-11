import { createClient } from "@/lib/supabase";
import { getCheckoutSettings } from "@/lib/checkoutSettings";
import { availableSpeeds, variantSellPrice } from "@/lib/money";
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

// Společný podklad pro /feeds/google.xml a /feeds/heureka.xml. Oba feedy
// popisují stejné zboží, liší se jen obalem — proto se položky staví jednou tady.
//
// Dvě věci, na kterých feed stojí a snadno se rozbijí:
//  1) `id` musí být shodné s `item_id` v dataLayer (viz lib/analytics.ts),
//     jinak agentura nespáruje objednávky s produkty v Nákupech,
//  2) ceny jsou **s DPH**. V databázi jsou bez ní.

// banner_m2 a custom_flag se do feedu nedávají — cena je u nich za m², ne za
// kus. Merchant Center takovou cenu bere jako zavádějící, protože neodpovídá
// tomu, co zákazník ve výsledku zaplatí. Zákazník se ke konfigurátoru dostane
// přes kategorii, jen ne jedním klikem z Nákupů.
const SKIP_KINDS: Product["kind"][] = ["banner_m2", "custom_flag"];

export const BRAND = "PROVLAJKY.CZ";

// Nejbližší kategorie z taxonomie Google. Uvádí se celou cestou, ne číslem —
// číselníky se mezi verzemi taxonomie mění, textová cesta je stabilnější.
const GOOGLE_CATEGORY: Record<ProductCategory, string> = {
  "plazove-vlajky": "Business & Industrial > Advertising & Marketing > Trade Show Displays",
  "vlajky-na-zakazku": "Business & Industrial > Advertising & Marketing > Trade Show Displays",
  "pvc-bannery": "Business & Industrial > Advertising & Marketing > Trade Show Displays",
  prislusenstvi: "Business & Industrial > Advertising & Marketing > Trade Show Displays",
  "nuzkove-stany": "Home & Garden > Lawn & Garden > Outdoor Living > Canopies & Gazebos",
  "nafukovaci-stany": "Home & Garden > Lawn & Garden > Outdoor Living > Canopies & Gazebos",
  totemy: "Business & Industrial > Advertising & Marketing > Trade Show Displays",
  "nafukovaci-brany": "Business & Industrial > Advertising & Marketing > Trade Show Displays",
  "nahradni-dily": "Business & Industrial > Advertising & Marketing > Trade Show Displays",
};

export type FeedItem = {
  id: string;
  /** Společné ID pro varianty téhož produktu (velikosti, provedení). */
  itemGroupId: string | null;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  /** Kč s DPH. */
  price: number;
  productType: string;
  googleCategory: string;
  /** Popis varianty do názvu i do Heureky (PARAM). */
  variant: string | null;
};

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function withVat(priceExVat: number, vatRate: number) {
  return round2(priceExVat * (1 + (vatRate || 0)));
}

function absoluteImage(src: string | undefined) {
  if (!src) return null;
  return src.startsWith("http") ? src : `${SITE_URL}${src}`;
}

/** Název max. 150 znaků — delší Merchant Center ořízne sám, radši čitelně. */
function title(name: string, variant: string | null) {
  const full = variant ? `${name} — ${variant}` : name;
  return full.length <= 150 ? full : `${full.slice(0, 147)}…`;
}

function productLink(slug: string, size?: string | null) {
  const base = `${SITE_URL}/produkt/${slug}`;
  return size ? `${base}?size=${encodeURIComponent(size)}` : base;
}

/**
 * Popis varianty do názvu. Z labelu se odřízne rozměr, protože ten už je
 * v názvu produktu — jinak vzniknou tituly typu „Stan AIR 4×4 m — 4×4 m".
 * Rozlišovací je až zbytek („střecha + vstupní stříška"), samotný rozměr by
 * navíc dvě varianty téhož stanu vůbec nerozlišil.
 */
function variantLabel(variantLabelRaw: string, size: string | null | undefined) {
  const label = (variantLabelRaw || "").trim();
  if (!size) return label || null;
  const withoutSize = label.startsWith(size) ? label.slice(size.length).replace(/^\s*·\s*/, "").trim() : label;
  return withoutSize || null;
}

/**
 * Rozpad produktu na položky feedu. Produkt s variantami (velikosti stanů,
 * velikosti plážových vlajek, provedení příslušenství) dá víc položek se
 * společným item_group_id — Nákupy je pak zobrazí jako jeden produkt
 * s výběrem, ne jako několik konkurenčních nabídek.
 */
function itemsForProduct(product: Product): FeedItem[] {
  const image = absoluteImage(product.images?.[0]);
  if (!image) return [];

  const description = stripHtml(product.subtitle || product.description || product.name);
  const productType = PRODUCT_CATEGORIES[product.category] ?? product.category;
  const googleCategory = GOOGLE_CATEGORY[product.category] ?? GOOGLE_CATEGORY["prislusenstvi"];

  const base = { description, imageLink: image, productType, googleCategory };

  if (product.kind === "configurable") {
    // Plážové vlajky: velikosti mají v databázi pevné ceny.
    return Object.entries(product.price_by_size || {})
      .filter(([, price]) => typeof price === "number" && price > 0)
      .map(([size, price]) => ({
        ...base,
        id: `${product.slug}-${size.toLowerCase()}`,
        itemGroupId: product.slug,
        title: title(product.name, `velikost ${size}`),
        link: productLink(product.slug),
        price: withVat(price as number, product.vat_rate),
        variant: `velikost ${size}`,
      }));
  }

  if (product.kind === "variant") {
    const variants = product.config?.variants ?? [];
    return variants
      .map((variant) => {
        // Cena feedu musí odpovídat tomu, co zákazník uvidí jako výchozí —
        // tedy nejnižší dostupné dopravě, stejně jako „od …" na kartě.
        const speeds = availableSpeeds(variant);
        if (speeds.length === 0) return null;
        const price = Math.min(...speeds.map((speed) => variantSellPrice(variant, speed)));
        if (price <= 0) return null;
        const label = variants.length > 1 ? variantLabel(variant.label, variant.size) : null;
        return {
          ...base,
          id: `${product.slug}-${variant.id}`,
          itemGroupId: variants.length > 1 ? product.slug : null,
          title: title(product.name, label),
          link: productLink(product.slug, variant.size),
          price: withVat(price, product.vat_rate),
          variant: label,
        };
      })
      .filter((item): item is FeedItem => item !== null);
  }

  if (product.kind === "options") {
    const options = product.config?.options ?? [];
    return options
      .filter((option) => option.sellPrice > 0)
      .map((option) => ({
        ...base,
        id: `${product.slug}-${option.id}`,
        itemGroupId: options.length > 1 ? product.slug : null,
        title: title(product.name, options.length > 1 ? option.label : null),
        link: productLink(product.slug),
        price: withVat(option.sellPrice, product.vat_rate),
        variant: options.length > 1 ? option.label : null,
      }));
  }

  const singlePrice =
    product.kind === "tent_walls" ? product.config?.tentWalls?.baseSell || 0 : product.price || 0;
  if (singlePrice <= 0) return [];
  return [
    {
      ...base,
      id: product.slug,
      itemGroupId: null,
      title: title(product.name, null),
      link: productLink(product.slug),
      price: withVat(singlePrice, product.vat_rate),
      variant: null,
    },
  ];
}

export type FeedData = {
  items: FeedItem[];
  /** Nejlevnější doprava s DPH, nebo null když v adminu žádná není. */
  shippingPrice: number | null;
};

export async function buildFeedData(): Promise<FeedData> {
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").eq("active", true).order("sort_order");
  const products = (data || []) as Product[];

  const items = products
    .filter((product) => !SKIP_KINDS.includes(product.kind))
    .flatMap(itemsForProduct);

  // Cenu dopravy bere Merchant Center jako doplněk k ceně zboží. Když v adminu
  // ještě žádná doprava nastavená není, pole se raději vynechá — Google si pak
  // vezme sazbu z nastavení účtu, místo aby zákazníkovi ukazoval nulu.
  const checkout = await getCheckoutSettings();
  const prices = (checkout.shippingMethods || []).map((method) => method.price).filter((price) => price > 0);
  const shippingPrice = prices.length ? round2(Math.min(...prices) * 1.21) : null;

  return { items, shippingPrice };
}
