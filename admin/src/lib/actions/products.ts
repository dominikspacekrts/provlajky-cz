"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductCategory, ProductConfig, ProductKind } from "@/lib/types";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type ProductInput = {
  slug: string;
  category: ProductCategory;
  name: string;
  subtitle: string;
  description: string;
  kind: ProductKind;
  price: number;
  price_by_size: Product["price_by_size"];
  vat_rate: number;
  images: string[];
  active: boolean;
  sort_order: number;
  sale_pct: number;
  config: ProductConfig;
  partner_ids: string[];
};

export async function createProduct(input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  let { error } = await supabase.from("products").insert({ ...input, slug });
  if (error) {
    // partner_ids je z novější migrace (2026-08-order-item-product-link.sql) —
    // dokud neproběhla, zkusíme to bez něj, ať jde produkt založit i tak.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- partner_ids se schválně zahodí
    const { partner_ids: _partnerIds, ...withoutPartnerIds } = input;
    ({ error } = await supabase.from("products").insert({ ...withoutPartnerIds, slug }));
  }
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateProduct(id: string, input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  let { error } = await supabase
    .from("products")
    .update({ ...input, slug, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- partner_ids se schválně zahodí
    const { partner_ids: _partnerIds, ...withoutPartnerIds } = input;
    ({ error } = await supabase
      .from("products")
      .update({ ...withoutPartnerIds, slug, updated_at: new Date().toISOString() })
      .eq("id", id));
  }
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  revalidatePath("/");
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  revalidatePath("/");
}

export async function toggleProductActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  revalidatePath("/");
}
