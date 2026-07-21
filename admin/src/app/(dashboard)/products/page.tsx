import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/domain";
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";
import ActiveToggle from "./active-toggle";
import ProductFormButton from "./product-form-button";
import DeleteProductButton from "./delete-product-button";

export const dynamic = "force-dynamic";

function priceLabel(p: Product): string {
  if (p.kind === "simple") return fmtMoney(p.price, "CZK") + " bez DPH";
  if (p.kind === "banner_m2") {
    const b = p.config?.banner;
    const sells = [b?.pvc.sellPerM2, b?.mesh.sellPerM2].filter((v): v is number => !!v);
    return sells.length ? `od ${fmtMoney(Math.min(...sells), "CZK")}/m² bez DPH` : "cena/m² nenastavena";
  }
  if (p.kind === "variant") {
    const vs = p.config?.variants ?? [];
    const sells = vs.flatMap((v) => [v.sellAir, v.sellTrain]).filter((v) => v > 0);
    return sells.length
      ? `${vs.length} variant · od ${fmtMoney(Math.min(...sells), "CZK")} bez DPH`
      : `${vs.length} variant · prodejní cena nenastavena`;
  }
  const bySize = ["S", "M", "L", "XL"].map((s) => p.price_by_size?.[s as "S"]).filter((v): v is number => v != null);
  return bySize.length > 0 ? `od ${fmtMoney(Math.min(...bySize), "CZK")} bez DPH` : "cena nenastavena";
}

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("category").order("sort_order");
  const products = (data || []) as Product[];

  const byCategory = new Map<ProductCategory, Product[]>();
  for (const cat of Object.keys(PRODUCT_CATEGORIES) as ProductCategory[]) byCategory.set(cat, []);
  for (const p of products) byCategory.get(p.category)?.push(p);

  return (
    <div>
      <div className="row-between">
        <h2>Produkty</h2>
        <ProductFormButton />
      </div>
      <p className="muted">
        Produkty, které se zobrazují na eshopu (dev.provlajky.cz). Přepínačem „Aktivní“ rozhodneš, jestli je produkt
        na eshopu vidět.
      </p>

      {Array.from(byCategory.entries()).map(([cat, items]) => (
        <div key={cat} style={{ marginTop: 28 }}>
          <h3>{PRODUCT_CATEGORIES[cat]}</h3>
          {items.length === 0 && <p className="muted">Zatím žádné produkty v této kategorii.</p>}
          <div className="product-grid">
            {items.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-thumb">
                  {p.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt={p.name} />
                  ) : (
                    <span className="product-thumb-empty">🏳️</span>
                  )}
                </div>
                <div className="product-info">
                  <div className="product-name">{p.name}</div>
                  <div className="product-price">{priceLabel(p)}</div>
                </div>
                <div className="product-actions">
                  <ActiveToggle productId={p.id} active={p.active} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <ProductFormButton product={p} />
                    <DeleteProductButton productId={p.id} name={p.name} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
