// Mirrors the relevant slice of admin/src/lib/types.ts (snake_case, as returned by supabase-js).

export type ProductCategory =
  | "plazove-vlajky"
  | "vlajky-na-zakazku"
  | "pvc-bannery"
  | "prislusenstvi"
  | "nuzkove-stany"
  | "nafukovaci-stany"
  | "totemy"
  | "nafukovaci-brany"
  | "nahradni-dily";
export type ProductKind = "simple" | "configurable" | "banner_m2" | "variant" | "options" | "custom_flag" | "tent_walls";

export type ProductOption = {
  id: string;
  label: string;
  sellPrice: number;
  buyPrice: number;
};

export type BannerMaterialPricing = { buyPerM2: number; sellPerM2: number };

// Vlajky na zakázku — materiál a cena za m².
export type FlagMaterial = {
  id: string;
  label: string;
  sellPerM2: number;
  buyPerM2: number;
};

export type CustomFlagConfig = {
  materials: FlagMaterial[];
  eyeletSurchargePct: number; // hustší oka každých 30 cm (+%)
  maxDimState: number; // max rozměr státní vlajky (cm)
  maxDimCustom: number; // max rozměr vlastní vlajky (cm)
};

// Grafika stěn stanu pro kreslený náhled (TentGraphic).
export type TentWalls = "none" | "half" | "full";

export type ProductVariant = {
  id: string;
  label: string;
  size?: string | null;
  cost: number;
  customs: number;
  airFreight: number;
  trainFreight: number;
  transactionFee: number;
  sellAir: number; // prodejní cena — dodání do 14 dní
  sellTrain: number; // prodejní cena — dodání do 2 měsíců
  walls?: TentWalls; // volitelné — jaká grafika stěn se u varianty vykreslí
};

// Cena jedné volby stěny (jednostranný/oboustranný potisk, nákup/prodej).
export type TentWallOption = { buySingle: number; buyDouble: number; sellSingle: number; sellDouble: number };

// Nůžkový stan skládaný po částech: zákazník začíná se stanem jen se
// střechou (base) a k němu si podle chuti přidává zadní stěnu a boční
// stěny — každou zvlášť jako "bez stěny" / "poloviční" / "celá", s volbou
// jednostranného nebo oboustranného potisku. Zadní stěna má šířku podle
// velikosti stanu (backWidthM — 3/4,5/6 m), boční stěny jsou vždy 3 m
// (hloubka stanu je u všech velikostí stejná). Poloviční stěna už v sobě
// má zahrnutou boční tyč, která ji drží.
export type TentWallsConfig = {
  baseBuy: number;
  baseSell: number;
  backWidthM: number;
  fullWallBack: TentWallOption;
  halfWallBack: TentWallOption;
  fullWallSide: TentWallOption;
  halfWallSide: TentWallOption;
};

export type ProductConfig = {
  banner?: { pvc: BannerMaterialPricing; mesh: BannerMaterialPricing };
  variants?: ProductVariant[];
  options?: ProductOption[];
  customFlag?: CustomFlagConfig;
  buyPrice?: number;
  costBySize?: { S: number; M: number; L: number; XL: number };
  tentWalls?: TentWallsConfig;
};

export type Product = {
  id: string;
  slug: string;
  category: ProductCategory;
  name: string;
  subtitle: string | null;
  description: string | null;
  kind: ProductKind;
  price: number;
  price_by_size: { S?: number; M?: number; L?: number; XL?: number };
  vat_rate: number;
  images: string[];
  active: boolean;
  sort_order: number;
  sale_pct: number;
  config: ProductConfig;
};

export const PRODUCT_CATEGORIES: Record<ProductCategory, string> = {
  "plazove-vlajky": "Plážové vlajky",
  "vlajky-na-zakazku": "Vlajky na zakázku",
  "pvc-bannery": "PVC bannery",
  prislusenstvi: "Příslušenství a stojany",
  "nuzkove-stany": "Nůžkové stany",
  "nafukovaci-stany": "Nafukovací stany",
  totemy: "Totemy / nafukovací sloupy",
  "nafukovaci-brany": "Nafukovací brány",
  "nahradni-dily": "Náhradní díly a příslušenství",
};

// Kategorie, které se vypisují na landing stránce /stany — jen stany
// (totemy a brány mají vlastní stránku /brany-a-totemy, náhradní díly
// nejsou v hlavní navigaci, ale zůstávají dostupné přes /nahradni-dily).
export const TENT_CATEGORIES: ProductCategory[] = ["nuzkove-stany", "nafukovaci-stany"];

// Kategorie, které se vypisují na landing stránce /brany-a-totemy.
export const GATE_TOTEM_CATEGORIES: ProductCategory[] = ["nafukovaci-brany", "totemy"];

// Skupiny v navigaci "Produkty" — víc raw kategorií se sloučí pod jednu
// položku (stany, brány/totemy), zbytek je 1:1. nahradni-dily záměrně
// chybí — nejsou v hlavní navigaci, jen dostupné přes přímý odkaz.
export type NavGroup = { id: string; label: string; href: string; categories: ProductCategory[] };
export const NAV_GROUPS: NavGroup[] = [
  { id: "plazove-vlajky", label: "Plážové vlajky", href: "/plazove-vlajky", categories: ["plazove-vlajky"] },
  { id: "vlajky-na-zakazku", label: "Vlajky na zakázku", href: "/vlajky-na-zakazku", categories: ["vlajky-na-zakazku"] },
  { id: "pvc-bannery", label: "PVC bannery a meshe", href: "/pvc-bannery", categories: ["pvc-bannery"] },
  { id: "stany", label: "Nůžkové a nafukovací stany", href: "/stany", categories: TENT_CATEGORIES },
  { id: "brany-a-totemy", label: "Nafukovací reklama", href: "/brany-a-totemy", categories: GATE_TOTEM_CATEGORIES },
  { id: "prislusenstvi", label: "Příslušenství", href: "/prislusenstvi", categories: ["prislusenstvi"] },
];

// ── Stany: odvození grafiky a seskupení podle velikosti ──────────────────────

// Jaká grafika stěn patří k variantě — buď explicitně nastavená v adminu (walls),
// nebo odvozená z labelu (bez stěn → none, poloviční → half, celé → full).
export function wallsFromVariant(v: ProductVariant): TentWalls {
  if (v.walls) return v.walls;
  const l = (v.label || "").toLowerCase();
  if (l.includes("bez stěn") || l.includes("rám + strop") || l.includes("rám (konstrukce)") || l.includes("strop"))
    return "none";
  if (l.includes("poloviční")) return "half";
  if (l.includes("celé stěny") || l.includes("celá stěna") || l.includes("3 celé") || l.includes("bočnice"))
    return "full";
  return "full";
}

export function printSidesFromVariant(v: ProductVariant): "single" | "double" {
  return (v.label || "").toLowerCase().includes("oboustrann") ? "double" : "single";
}

// Realistický fotorealistický obrázek stanu (Viewmax) podle konfigurace stěn.
export function tentRealImage(walls: TentWalls): string {
  return `/stany/real-${walls}.jpg`;
}

// Nafukovací („spider" dome) stan s vstupní stříškou a logem PROVLAJKY.
export const INFLATABLE_TENT_IMAGE = "/stany/nafukovaci.jpg";

// Seřazený seznam unikátních velikostí variant produktu (pro split podle velikosti).
export function variantSizes(product: Product): string[] {
  const seen: string[] = [];
  for (const v of product.config?.variants ?? []) {
    const s = (v.size ?? "").trim();
    if (s && !seen.includes(s)) seen.push(s);
  }
  return seen;
}

export const FLAG_SHAPES = ["A", "B", "C", "D", "E", "F"] as const;
export type FlagShape = (typeof FLAG_SHAPES)[number];
export const FLAG_SIZES = ["S", "M", "L", "XL"] as const;
export type FlagSize = (typeof FLAG_SIZES)[number];

export type CustomerAddress = {
  company?: string;
  name?: string;
  street?: string;
  psc?: string;
  city?: string;
  ico?: string;
  dic?: string;
  email?: string;
  phone?: string;
  isCompany?: boolean;
};

// Návrh zákazníka u položky objednávky — struktura musí odpovídat typu Design
// v admin/src/lib/types.ts (ukládá se do order_items.design jsonb).
export type OrderItemDesign = {
  bgColor?: string;
  sleeveColor?: "white" | "black";
  logo?: { src: string; x: number; y: number; w: number; h: number; rotation: number } | null;
  thumb?: string | null;
  flagBounds?: null;
  // metadata navíc (admin je ignoruje): odkud návrh přišel a přesné hodnoty z eshop editoru
  source?: "eshop";
  eshop?: { logoX: number; logoY: number; logoScale: number; shape: string; hs: boolean };
  // Veřejná URL nahrané grafiky ve Supabase Storage (viz /api/objednavka) —
  // uložená vedle base64 polí výše, nenahrazuje je (ta pořád čte vizualizace
  // a editor v adminu), slouží jen ke stažení originálu k výrobě.
  artworkUrl?: string;
};

export type CartLine = {
  id: string; // client-side line id
  productId: string;
  productSlug: string;
  name: string;
  type: "flag" | "banner" | "product";
  shape: FlagShape | null;
  size: FlagSize | null;
  qty: number;
  unitPrice: number;
  vatRate: number;
  thumb?: string | null;
  note?: string | null;
  design?: OrderItemDesign | null;
  // Rozměr banneru / vlajky na zakázku — order_items.width_cm/height_cm v adminu.
  widthCm?: number | null;
  heightCm?: number | null;
  // Konkrétní volba v rámci produktu — order_items.material/variant_id/option_id
  // v adminu, potřeba pro dopočet marže a rozdělení zisku mezi partnery podle
  // products.config (viz admin/src/lib/domain.ts itemCost/itemMargin).
  material?: string | null; // banner_m2: 'pvc'|'mesh'; custom_flag: FlagMaterial.id
  variantId?: string | null; // kind=variant (stany, totemy, brány, díly)
  optionId?: string | null; // kind=options (těžké základny apod.)
};

// Způsoby dopravy/platby spravované v adminu (Nastavení → Doprava a platby).
// price v Kč bez DPH, 0 = zdarma/bez příplatku.
export type ShippingMethod = { id: string; label: string; price: number };
export type PaymentMethod = { id: string; label: string; price: number };
export type CheckoutSettings = {
  shippingFreeOverAmount: number;
  shippingMethods: ShippingMethod[];
  paymentMethods: PaymentMethod[];
};
