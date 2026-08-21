import { createClient } from "@/lib/supabase";
import { fromPrice } from "@/lib/money";
import type { Product } from "@/lib/types";
import { HERO_GROUPS } from "@/lib/heroGroups";
import Nova2Client from "./Nova2Client";

export const dynamic = "force-dynamic";

// Startovací cena za skupinu = nejnižší reálná "od" cena napříč jejími
// kategoriemi (stejný výpočet jako na /[category], viz fromPrice()).
// Supabase teprve plníte daty — dokud produkt v kategorii nemá cenu,
// panel cenu prostě nezobrazí (nikdy nevymýšlíme číslo).
async function fetchGroupPrices(): Promise<Record<string, number | null>> {
  const prices: Record<string, number | null> = {};
  for (const g of HERO_GROUPS) prices[g.id] = null;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("products").select("*").eq("active", true);
    if (error || !data) return prices;
    const products = data as Product[];

    for (const g of HERO_GROUPS) {
      const inGroup = products.filter((p) => g.categories.includes(p.category));
      const values = inGroup.map(fromPrice).filter((v): v is number => v != null && v > 0);
      prices[g.id] = values.length ? Math.min(...values) : null;
    }
  } catch {
    // Supabase env not configured yet / network error — ship without prices
    // rather than guessing at them.
  }

  return prices;
}

export default async function Nova2() {
  const prices = await fetchGroupPrices();
  return <Nova2Client prices={prices} />;
}
