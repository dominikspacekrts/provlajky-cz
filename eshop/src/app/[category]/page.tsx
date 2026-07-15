import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { fmtMoney, minSizePrice } from "@/lib/money";
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!(category in PRODUCT_CATEGORIES)) notFound();
  const cat = category as ProductCategory;

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("category", cat)
    .eq("active", true)
    .order("sort_order");
  const products = (data || []) as Product[];

  // Plážové vlajky nemají výpis — jde se rovnou do konfigurátoru.
  if (cat === "plazove-vlajky") {
    const configurable = products.find((p) => p.kind === "configurable") ?? products[0];
    if (configurable) redirect(`/produkt/${configurable.slug}`);
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-panel">
      <h1 style={{ fontSize: 34 }}>{PRODUCT_CATEGORIES[cat]}</h1>

      {products.length === 0 && (
        <p className="muted" style={{ color: "var(--gray)", marginTop: 16 }}>
          V této kategorii momentálně nemáme žádné produkty. Ozvěte se nám na{" "}
          <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>.
        </p>
      )}

      <div className="category-grid reveal-stagger">
        {products.map((p) => (
          <Link key={p.id} href={`/produkt/${p.slug}`} className="category-card">
            <div className="thumb">
              {p.images?.[0] ? (
                <Image src={p.images[0]} alt={p.name} width={320} height={320} style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
              ) : (
                <span style={{ fontSize: 46 }}>🏳️</span>
              )}
            </div>
            <div className="body">
              <div className="name">{p.name}</div>
              <div className="price">
                {p.kind === "simple" ? (
                  <>{fmtMoney(p.price)} <span className="vat">bez DPH</span></>
                ) : (
                  minSizePrice(p.price_by_size) != null ? (
                    <>od {fmtMoney(minSizePrice(p.price_by_size)!)} <span className="vat">bez DPH</span></>
                  ) : (
                    "cena na dotaz"
                  )
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
      </div>
    </div>
  );
}
