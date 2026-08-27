import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase";
import { SITE_URL } from "@/lib/site";

// plazove-vlajky a vlajky-na-zakazku nemají vlastní výpis — [category]/page.tsx
// je rovnou přesměruje na konfigurátor, takže sem nepatří (ten produkt je
// pokrytý níž přes /produkt/[slug]).
const STATIC_CATEGORY_PAGES = ["pvc-bannery", "prislusenstvi", "nahradni-dily"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient();
  const { data } = await supabase.from("products").select("slug").eq("active", true);
  const products = data || [];

  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/stany`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/brany-a-totemy`, changeFrequency: "weekly", priority: 0.8 },
    ...STATIC_CATEGORY_PAGES.map((c) => ({
      url: `${SITE_URL}/${c}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/obchodni-podminky`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/ochrana-osobnich-udaju`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/produkt/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
