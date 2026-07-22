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
export type ProductKind = "simple" | "configurable" | "banner_m2" | "variant" | "options" | "custom_flag";

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
  sellTrain: number; // prodejní cena — dodání do 4 týdnů
  walls?: TentWalls; // volitelné — jaká grafika stěn se u varianty vykreslí
};

export type ProductConfig = {
  banner?: { pvc: BannerMaterialPricing; mesh: BannerMaterialPricing };
  variants?: ProductVariant[];
  options?: ProductOption[];
  customFlag?: CustomFlagConfig;
  buyPrice?: number;
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

// Kategorie, které se vypisují na landing stránce /stany (pod nůžkovými stany).
export const TENT_CATEGORIES: ProductCategory[] = [
  "nuzkove-stany",
  "nafukovaci-stany",
  "totemy",
  "nafukovaci-brany",
  "nahradni-dily",
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
};
