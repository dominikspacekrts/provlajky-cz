import { createClient } from "@/lib/supabase";
import { fromPrice } from "@/lib/money";
import type { Product, ProductCategory } from "@/lib/types";
import { HERO_GROUPS } from "@/lib/heroGroups";
import Nova2Client from "@/components/Nova2Client";

export const dynamic = "force-dynamic";

// Startovací cena za skupinu = nejnižší reálná "od" cena napříč jejími
// kategoriemi (stejný výpočet jako na /[category], viz fromPrice()).
// Sleva za skupinu/kategorii = nejvyšší sale_pct mezi aktivními produkty
// (nastavuje se v adminu u produktu, viz Product.sale_pct) — žádná sleva
// natvrdo v kódu, jen reálná data.
// Supabase teprve plníte daty — dokud produkt v kategorii nemá cenu,
// panel cenu prostě nezobrazí (nikdy nevymýšlíme číslo).
async function fetchGroupPricesAndSale(): Promise<{
  prices: Record<string, number | null>;
  heroSalePct: Record<string, number>;
  salePctByCategory: Partial<Record<ProductCategory, number>>;
}> {
  const prices: Record<string, number | null> = {};
  const heroSalePct: Record<string, number> = {};
  for (const g of HERO_GROUPS) {
    prices[g.id] = null;
    heroSalePct[g.id] = 0;
  }
  const salePctByCategory: Partial<Record<ProductCategory, number>> = {};

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("products").select("*").eq("active", true);
    if (error || !data) return { prices, heroSalePct, salePctByCategory };
    const products = data as Product[];

    for (const p of products) {
      const cur = salePctByCategory[p.category] || 0;
      if (p.sale_pct > cur) salePctByCategory[p.category] = p.sale_pct;
    }

    for (const g of HERO_GROUPS) {
      const inGroup = products.filter((p) => g.categories.includes(p.category));
      const values = inGroup.map(fromPrice).filter((v): v is number => v != null && v > 0);
      prices[g.id] = values.length ? Math.min(...values) : null;
      heroSalePct[g.id] = Math.max(0, ...inGroup.map((p) => p.sale_pct || 0));
    }
  } catch {
    // Supabase env not configured yet / network error — ship without prices
    // rather than guessing at them.
  }

  return { prices, heroSalePct, salePctByCategory };
}

export default async function Home() {
  const { prices, heroSalePct, salePctByCategory } = await fetchGroupPricesAndSale();
  return <Nova2Client prices={prices} heroSalePct={heroSalePct} salePctByCategory={salePctByCategory} />;
}
