"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Product, ProductCategory, ProductConfig, ProductKind, ProductSupplier } from "@/lib/types";

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
  // Neukládá se do products (veřejně čitelné přes eshop), ale do
  // product_suppliers — viz saveProductSupplier níž.
  supplier: ProductSupplier;
};

// PostgREST hlásí sloupec, který ve schema cache nezná (migrace na něj ještě
// neproběhla), jako "Could not find the 'x' column of 'products' in the
// schema cache" (PGRST204) — tenhle sloupec z dat zahodíme a zkusíme to
// znovu, ať produkt jde uložit i s nedoběhlou migrací (sale_pct, partner_ids…
// — a cokoliv podobného příště, bez nutnosti to řešit zvlášť pro každý sloupec).
const MISSING_COLUMN_RE = /Could not find the '(\w+)' column/;

async function withMissingColumnFallback<T>(
  run: (row: Record<string, unknown>) => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  row: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  let payload = row;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await run(payload);
    if (!error) return { data, error: null };
    const missing = MISSING_COLUMN_RE.exec(error.message)?.[1];
    if (!missing || !(missing in payload)) return { data: null, error };
    const next = { ...payload };
    delete next[missing];
    payload = next;
  }
  return {
    data: null,
    error: { message: "Příliš mnoho chybějících sloupců — zkontroluj, jestli proběhly všechny SQL migrace." },
  };
}

// Kontakt na dodavatele leží v product_suppliers, ne v products — products
// mají RLS politiku "public can view active products", takže sloupec s
// e-mailem by si přečetl kdokoliv přes veřejné API eshopu.
async function saveProductSupplier(productId: string, supplier: ProductSupplier | undefined) {
  const name = (supplier?.name || "").trim();
  const email = (supplier?.email || "").trim();
  const supabase = await createClient();
  const { error } =
    !name && !email
      ? await supabase.from("product_suppliers").delete().eq("product_id", productId)
      : await supabase
          .from("product_suppliers")
          .upsert({ product_id: productId, name, email, updated_at: new Date().toISOString() });
  if (error) {
    throw new Error(
      `Produkt je uložený, ale dodavatele se uložit nepodařilo: ${error.message}. ` +
        "Proběhla migrace admin/supabase/2026-09-product-suppliers.sql?"
    );
  }
}

/** Mapa product_id → dodavatel. Prázdná, dokud neproběhne migrace. */
export async function loadProductSuppliers(): Promise<Record<string, ProductSupplier>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_suppliers").select("product_id, name, email");
  if (error || !data) return {};
  const out: Record<string, ProductSupplier> = {};
  for (const row of data as { product_id: string; name: string | null; email: string | null }[]) {
    out[row.product_id] = { name: row.name || "", email: row.email || "" };
  }
  return out;
}

export async function createProduct(input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  const { supplier, ...productFields } = input;
  const { data, error } = await withMissingColumnFallback<{ id: string }>(
    (row) => supabase.from("products").insert(row).select("id").single(),
    { ...productFields, slug }
  );
  if (error) throw new Error(error.message);
  try {
    if (data?.id) await saveProductSupplier(data.id, supplier);
  } finally {
    revalidatePath("/products");
    revalidatePath("/");
  }
}

export async function updateProduct(id: string, input: ProductInput) {
  const supabase = await createClient();
  const slug = input.slug.trim() ? slugify(input.slug) : slugify(input.name);
  const { supplier, ...productFields } = input;
  const { error } = await withMissingColumnFallback(
    (row) => supabase.from("products").update(row).eq("id", id).select("id").single(),
    { ...productFields, slug, updated_at: new Date().toISOString() }
  );
  if (error) throw new Error(error.message);
  try {
    await saveProductSupplier(id, supplier);
  } finally {
    revalidatePath("/products");
    revalidatePath("/");
  }
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
