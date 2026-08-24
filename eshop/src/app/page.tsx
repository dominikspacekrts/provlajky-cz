import { createClient } from "@/lib/supabase";
import type { Product, ProductCategory } from "@/lib/types";
import Nova2Client from "@/components/Nova2Client";

export const dynamic = "force-dynamic";

// Sleva za kategorii = nejvyšší sale_pct mezi aktivními produkty v ní
// (nastavuje se v adminu u produktu, viz Product.sale_pct) — žádná sleva
// natvrdo v kódu, jen reálná data.
async function fetchSalePctByCategory(): Promise<Partial<Record<ProductCategory, number>>> {
  const salePctByCategory: Partial<Record<ProductCategory, number>> = {};
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("products").select("*").eq("active", true);
    if (error || !data) return salePctByCategory;
    for (const p of data as Product[]) {
      const cur = salePctByCategory[p.category] || 0;
      if (p.sale_pct > cur) salePctByCategory[p.category] = p.sale_pct;
    }
  } catch {
    // Supabase env not configured yet / network error — ship bez slevových plaket, nehádat.
  }
  return salePctByCategory;
}

export default async function Home() {
  const salePctByCategory = await fetchSalePctByCategory();
  return <Nova2Client salePctByCategory={salePctByCategory} />;
}
