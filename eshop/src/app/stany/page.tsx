import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { fmtMoney, fromPrice } from "@/lib/money";
import { PRODUCT_CATEGORIES, TENT_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";
import TentFold from "@/components/TentFold";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nůžkové stany a nafukovací produkty s potiskem — PROVLAJKY.CZ",
  description:
    "Skládací nůžkové stany, nafukovací stany, totemy, brány i náhradní díly s plnobarevným potiskem na míru.",
};

export default async function StanyPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .in("category", TENT_CATEGORIES)
    .eq("active", true)
    .order("category")
    .order("sort_order");
  const products = (data || []) as Product[];

  const byCategory = new Map<ProductCategory, Product[]>();
  for (const cat of TENT_CATEGORIES) byCategory.set(cat, []);
  for (const p of products) byCategory.get(p.category)?.push(p);

  return (
    <div className="container stany-page" style={{ paddingTop: 40, paddingBottom: 72 }}>
      <section className="stany-hero reveal-stagger">
        <div className="stany-hero-copy">
          <h1>Nůžkové stany s potiskem</h1>
          <p>
            Skládací pop-up stany s hliníkovou nůžkovou konstrukcí a plnobarevným potiskem střechy, valance i bočnic.
            Rozloží se za minutu bez nářadí — ideální na sportovní akce, festivaly i prodejní stánky.
          </p>
          <div className="stany-hero-cta">
            {byCategory.get("nuzkove-stany")?.[0] ? (
              <Link href={`/produkt/${byCategory.get("nuzkove-stany")![0].slug}`} className="btn-yellow">
                Sestavit stan →
              </Link>
            ) : (
              <a href="mailto:info@provlajky.cz?subject=Poptávka – nůžkový stan" className="btn-yellow">
                Poptat stan na míru
              </a>
            )}
            <a href="tel:+420605981155" className="btn-outline">Zavolat nám</a>
          </div>
          <div className="stany-fold">
            <TentFold />
            <span>Nůžková konstrukce — složí a rozloží se za minutu</span>
          </div>
        </div>
        <div className="stany-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stan-hero.jpg" alt="Nůžkový stan s potiskem" />
        </div>
      </section>

      {TENT_CATEGORIES.map((cat) => {
        const items = byCategory.get(cat) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat} className="stany-section reveal-stagger">
            <h2>{PRODUCT_CATEGORIES[cat]}</h2>
            <div className="category-grid">
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
                      <span style={{ fontSize: 46 }}>⛺</span>
                    )}
                  </div>
                  <div className="body">
                    <div className="name">{p.name}</div>
                    {p.subtitle && <div className="card-sub">{p.subtitle}</div>}
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

      {products.length === 0 && (
        <p className="muted" style={{ color: "var(--gray)", marginTop: 24 }}>
          Katalog stanů právě plníme. Napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> a
          připravíme nabídku na míru.
        </p>
      )}
    </div>
  );
}
