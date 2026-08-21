import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { fmtMoney, fromPrice } from "@/lib/money";
import { PRODUCT_CATEGORIES, GATE_TOTEM_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";
import { FlagMark } from "@/components/Icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nafukovací brány a totemy s potiskem — PROVLAJKY.CZ",
  description: "Nafukovací brány a totemy (nafukovací sloupy) s plnobarevným potiskem na míru.",
};

export default async function BranyATotemyPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .in("category", GATE_TOTEM_CATEGORIES)
    .eq("active", true)
    .order("category")
    .order("sort_order");
  const products = (data || []) as Product[];

  const byCategory = new Map<ProductCategory, Product[]>();
  for (const cat of GATE_TOTEM_CATEGORIES) byCategory.set(cat, []);
  for (const p of products) byCategory.get(p.category)?.push(p);

  return (
    <div className="container">
      <div className="page-panel">
        <h1>Nafukovací brány a totemy</h1>

        {products.length === 0 && (
          <p className="muted">
            Katalog právě plníme. Napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> a
            připravíme nabídku na míru.
          </p>
        )}

        {GATE_TOTEM_CATEGORIES.map((cat) => {
          const items = byCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={cat} id={cat} style={{ marginTop: 28 }}>
              <h2>{PRODUCT_CATEGORIES[cat]}</h2>
              <div className="category-grid reveal-stagger">
                {items.map((p) => (
                  <Link key={p.id} href={`/produkt/${p.slug}`} className="category-card">
                    <div className="thumb">
                      {p.images?.[0] ? (
                        <Image
                          src={p.images[0]}
                          alt={p.name}
                          width={320}
                          height={320}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          unoptimized
                        />
                      ) : (
                        <FlagMark className="thumb-empty" />
                      )}
                    </div>
                    <div className="body">
                      <div className="name">{p.name}</div>
                      <div className="price">
                        {fromPrice(p) != null ? (
                          <>od {fmtMoney(fromPrice(p)!)} <span className="vat">bez DPH</span></>
                        ) : (
                          "cena na dotaz"
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
