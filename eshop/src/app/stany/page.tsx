import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { fmtMoney, minVariantSell } from "@/lib/money";
import {
  PRODUCT_CATEGORIES,
  TENT_CATEGORIES,
  variantSizes,
  tentRealImage,
  INFLATABLE_TENT_IMAGE,
  type Product,
  type ProductCategory,
} from "@/lib/types";
import TentFold from "@/components/TentFold";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nůžkové stany a nafukovací produkty s potiskem — PROVLAJKY.CZ",
  description:
    "Skládací nůžkové stany, nafukovací stany, totemy, brány i náhradní díly s plnobarevným potiskem na míru.",
};

// Kategorie, které rozdělujeme na karty podle velikosti (každá velikost = vlastní karta).
const SPLIT_BY_SIZE: ReadonlySet<ProductCategory> = new Set<ProductCategory>([
  "nuzkove-stany",
  "nafukovaci-stany",
  "totemy",
  "nafukovaci-brany",
]);

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

  const firstNuzkovy = byCategory.get("nuzkove-stany")?.[0];
  const firstNuzkovySize = firstNuzkovy ? variantSizes(firstNuzkovy)[0] : undefined;

  return (
    <div className="container stany-page" style={{ paddingTop: 40, paddingBottom: 72 }}>
      <section className="stany-hero reveal-stagger">
        <div className="stany-hero-copy">
          <h1>Nůžkové stany s potiskem</h1>
          <p>
            Skládací pop-up stany s hliníkovou nůžkovou konstrukcí a plnobarevným potiskem střechy, valance i bočnic.
            Vyber velikost, pak konfiguraci stěn — rozloží se za minutu bez nářadí.
          </p>
          <div className="stany-hero-cta">
            {firstNuzkovy ? (
              <Link
                href={`/produkt/${firstNuzkovy.slug}${firstNuzkovySize ? `?size=${encodeURIComponent(firstNuzkovySize)}` : ""}`}
                className="btn-yellow"
              >
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
              {SPLIT_BY_SIZE.has(cat)
                ? items.flatMap((p) => {
                    const sizes = variantSizes(p);
                    // Bez rozměrů (např. kompresor) → jedna karta jako dřív.
                    if (sizes.length === 0) return [<ProductCard key={p.id} product={p} category={cat} />];
                    return sizes.map((size) => (
                      <SizeCard key={`${p.id}-${size}`} product={p} category={cat} size={size} />
                    ));
                  })
                : items.map((p) => <ProductCard key={p.id} product={p} category={cat} />)}
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

// Karta pro jednu velikost daného produktu (split podle velikosti).
function SizeCard({ product, category, size }: { product: Product; category: ProductCategory; size: string }) {
  const variantsOfSize = (product.config?.variants ?? []).filter((v) => (v.size ?? "").trim() === size);
  const from = minVariantSell(variantsOfSize);
  const isNuzkovy = category === "nuzkove-stany";
  const isNafukovaci = category === "nafukovaci-stany";
  return (
    <Link href={`/produkt/${product.slug}?size=${encodeURIComponent(size)}`} className="category-card">
      <div className="thumb">
        {isNuzkovy || isNafukovaci ? (
          <Image
            src={isNuzkovy ? tentRealImage("full") : INFLATABLE_TENT_IMAGE}
            alt={`${product.name} ${size}`}
            width={480}
            height={360}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            unoptimized
          />
        ) : product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={`${product.name} ${size}`}
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
        <div className="name">{`${product.name} ${size}`}</div>
        <div className="price">
          {from != null ? (
            <>od {fmtMoney(from)} <span className="vat">bez DPH</span></>
          ) : (
            "cena na dotaz"
          )}
        </div>
      </div>
    </Link>
  );
}

// Klasická karta produktu (kategorie bez rozdělení podle velikosti).
function ProductCard({ product }: { product: Product; category: ProductCategory }) {
  const from = minVariantSell(product.config?.variants);
  return (
    <Link href={`/produkt/${product.slug}`} className="category-card">
      <div className="thumb">
        {product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
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
        <div className="name">{product.name}</div>
        {product.subtitle && <div className="card-sub">{product.subtitle}</div>}
        <div className="price">
          {from != null ? (
            <>od {fmtMoney(from)} <span className="vat">bez DPH</span></>
          ) : (
            "cena na dotaz"
          )}
        </div>
      </div>
    </Link>
  );
}
