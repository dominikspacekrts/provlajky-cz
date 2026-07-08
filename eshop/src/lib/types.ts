// Mirrors the relevant slice of admin/src/lib/types.ts (snake_case, as returned by supabase-js).

export type ProductCategory = "plazove-vlajky" | "vlajky-na-zakazku" | "pvc-bannery" | "prislusenstvi";
export type ProductKind = "simple" | "configurable";

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
};

export const PRODUCT_CATEGORIES: Record<ProductCategory, string> = {
  "plazove-vlajky": "Plážové vlajky",
  "vlajky-na-zakazku": "Vlajky na zakázku",
  "pvc-bannery": "PVC bannery",
  prislusenstvi: "Příslušenství a stojany",
};

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
};
