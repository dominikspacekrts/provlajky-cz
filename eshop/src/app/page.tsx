import { createClient } from "@/lib/supabase";
import type { Product, ProductCategory } from "@/lib/types";
import Nova2Client from "@/components/Nova2Client";
import { fetchPublishedReviews } from "@/lib/reviews";
import { fromPrice } from "@/lib/money";
import type { TilePrice, TilePriceHints } from "@/components/NovaFields";

export const dynamic = "force-dynamic";

type HomeData = {
  salePctByCategory: Partial<Record<ProductCategory, number>>;
  priceHints: TilePriceHints;
};

function tilePrice(p: Product): TilePrice | null {
  const price = fromPrice(p);
  if (price == null || price <= 0) return null;
  return { price, perM2: p.kind === "banner_m2" || p.kind === "custom_flag" };
}

// Sleva za kategorii = nejvyšší sale_pct mezi aktivními produkty v ní
// (nastavuje se v adminu u produktu, viz Product.sale_pct) — žádná sleva
// natvrdo v kódu, jen reálná data. Stejně tak „od …" na dlaždicích se počítá
// z aktuálních cen produktů, takže změna ceny v adminu se hned propíše.
async function fetchHomeData(): Promise<HomeData> {
  const salePctByCategory: HomeData["salePctByCategory"] = {};
  const priceHints: TilePriceHints = { byCategory: {}, bySlug: {} };
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("products").select("*").eq("active", true);
    if (error || !data) return { salePctByCategory, priceHints };
    for (const p of data as Product[]) {
      const cur = salePctByCategory[p.category] || 0;
      if (p.sale_pct > cur) salePctByCategory[p.category] = p.sale_pct;

      const tp = tilePrice(p);
      if (!tp) continue;
      priceHints.bySlug[p.slug] = tp;
      const best = priceHints.byCategory[p.category];
      if (!best || tp.price < best.price) priceHints.byCategory[p.category] = tp;
    }
  } catch {
    // Supabase env not configured yet / network error — ship bez plaket a cen, nehádat.
  }
  return { salePctByCategory, priceHints };
}

export default async function Home() {
  const [{ salePctByCategory, priceHints }, reviews] = await Promise.all([fetchHomeData(), fetchPublishedReviews()]);
  return <Nova2Client salePctByCategory={salePctByCategory} priceHints={priceHints} reviews={reviews} />;
}
