"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Product, ProductCategory, ProductKind } from "@/lib/types";

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
};

export async function createProduct(input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  const { error } = await supabase.from("products").insert({ ...input, slug });
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateProduct(id: string, input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  const { error } = await supabase
    .from("products")
    .update({ ...input, slug, updated_at: new Date().toISOString() })
    .eq("id", id);
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
