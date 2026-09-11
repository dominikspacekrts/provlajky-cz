"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

// PostgREST hlásí sloupec, který ve schema cache nezná (migrace na něj ještě
// neproběhla), jako "Could not find the 'x' column of 'products' in the
// schema cache" (PGRST204) — tenhle sloupec z dat zahodíme a zkusíme to
// znovu, ať produkt jde uložit i s nedoběhlou migrací (sale_pct, partner_ids…
// — a cokoliv podobného příště, bez nutnosti to řešit zvlášť pro každý sloupec).
const MISSING_COLUMN_RE = /Could not find the '(\w+)' column/;

async function withMissingColumnFallback(
  run: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>,
  row: Record<string, unknown>
) {
  let payload = row;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await run(payload);
    if (!error) return null;
    const missing = MISSING_COLUMN_RE.exec(error.message)?.[1];
    if (!missing || !(missing in payload)) return error;
    const next = { ...payload };
    delete next[missing];
    payload = next;
  }
  return { message: "Příliš mnoho chybějících sloupců — zkontroluj, jestli proběhly všechny SQL migrace." };
}

export async function createProduct(input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  const error = await withMissingColumnFallback(
    (row) => supabase.from("products").insert(row),
    { ...input, slug }
  );
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateProduct(id: string, input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  const error = await withMissingColumnFallback(
    (row) => supabase.from("products").update(row).eq("id", id),
    { ...input, slug, updated_at: new Date().toISOString() }
  );
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

// Produktové fotky patří do Storage, ne do databáze jako base64 data URL.
// Feed pro Merchant Center i Heureku potřebuje absolutní https:// adresu —
// z data URL by vznikla nesmyslná adresa typu
// `https://provlajky.cz/data:image/jpeg;base64,...` a položka by se do feedu
// vůbec nedostala. Base64 se navíc tahal do každého výpisu produktů.
const PRODUCT_IMAGE_BUCKET = "produktove_fotky";

export async function uploadProductImage(formData: FormData): Promise<string> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Nepřišel žádný soubor.");
  if (!file.type.startsWith("image/")) throw new Error("Nahrát lze jen obrázek.");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  // Service-role klient: zápis do Storage se jinak řídí RLS politikami, které
  // pro tenhle bucket nemáme nastavené.
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Nahrání fotky selhalo: ${error.message}`);

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
