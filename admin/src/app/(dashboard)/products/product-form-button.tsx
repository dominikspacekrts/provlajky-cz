"use client";

import { useState, useTransition } from "react";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions/products";
import { PRODUCT_CATEGORIES, type Product, type ProductCategory, type ProductKind } from "@/lib/types";

const emptyInput = (): ProductInput => ({
  slug: "",
  category: "plazove-vlajky",
  name: "",
  subtitle: "",
  description: "",
  kind: "configurable",
  price: 0,
  price_by_size: { S: 0, M: 0, L: 0, XL: 0 },
  vat_rate: 0.21,
  images: [],
  active: false,
  sort_order: 0,
});

function toInput(p: Product): ProductInput {
  return {
    slug: p.slug,
    category: p.category,
    name: p.name,
    subtitle: p.subtitle || "",
    description: p.description || "",
    kind: p.kind,
    price: p.price,
    price_by_size: { S: 0, M: 0, L: 0, XL: 0, ...p.price_by_size },
    vat_rate: p.vat_rate,
    images: p.images || [],
    active: p.active,
    sort_order: p.sort_order,
  };
}

export default function ProductFormButton({ product }: { product?: Product }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ProductInput>(() => (product ? toInput(product) : emptyInput()));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProductInput>(key: K, v: ProductInput[K]) {
    setValue((cur) => ({ ...cur, [key]: v }));
  }

  function openModal() {
    setValue(product ? toInput(product) : emptyInput());
    setError(null);
    setOpen(true);
  }

  function addImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setValue((cur) => ({ ...cur, images: [...cur.images, reader.result as string] }));
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(idx: number) {
    setValue((cur) => ({ ...cur, images: cur.images.filter((_, i) => i !== idx) }));
  }

  function submit() {
    if (!value.name.trim()) {
      setError("Vyplň název produktu.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (product) await updateProduct(product.id, value);
        else await createProduct(value);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nepodařilo se uložit produkt.");
      }
    });
  }

  return (
    <>
      <button className="btn primary" onClick={openModal}>
        {product ? "Upravit" : "+ Přidat produkt"}
      </button>
      {open && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <h3>{product ? "Upravit produkt" : "Nový produkt"}</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className="form-col">
              <label>
                Název
                <input value={value.name} onChange={(e) => set("name", e.target.value)} />
              </label>
              <label>
                Slug (URL) — necháš prázdné, doplní se z názvu
                <input
                  value={value.slug}
                  placeholder={value.name}
                  onChange={(e) => set("slug", e.target.value)}
                />
              </label>
              <label>
                Kategorie
                <select value={value.category} onChange={(e) => set("category", e.target.value as ProductCategory)}>
                  {Object.entries(PRODUCT_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Typ produktu
                <select value={value.kind} onChange={(e) => set("kind", e.target.value as ProductKind)}>
                  <option value="configurable">Konfigurovatelný (tvar/velikost — vlajky, bannery)</option>
                  <option value="simple">Jednoduchý (pevná cena — příslušenství)</option>
                </select>
              </label>

              {value.kind === "simple" ? (
                <label>
                  Cena bez DPH (Kč)
                  <input
                    type="number"
                    step="0.01"
                    value={value.price}
                    onChange={(e) => set("price", Number(e.target.value) || 0)}
                  />
                </label>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: "var(--color-gray-700)", marginBottom: 4 }}>
                    Cena bez DPH podle velikosti (Kč)
                  </div>
                  <div className="cost-grid">
                    {(["S", "M", "L", "XL"] as const).map((size) => (
                      <label key={size}>
                        {size}
                        <div className="cost-input">
                          <input
                            type="number"
                            step="0.01"
                            value={value.price_by_size[size] ?? 0}
                            onChange={(e) =>
                              set("price_by_size", { ...value.price_by_size, [size]: Number(e.target.value) || 0 })
                            }
                          />
                          <span className="cur">Kč</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label>
                Podnadpis (krátký popisek na eshopu)
                <input value={value.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </label>
              <label>
                Popis
                <textarea rows={4} value={value.description} onChange={(e) => set("description", e.target.value)} />
              </label>

              <label>
                Obrázky
                <input type="file" accept="image/*" multiple onChange={(e) => addImages(e.target.files)} />
              </label>
              {value.images.length > 0 && (
                <div className="product-image-preview-row">
                  {value.images.map((src, i) => (
                    <div key={i} className="product-image-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" />
                      <button type="button" className="product-image-remove" onClick={() => removeImage(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="cb-line">
                <input type="checkbox" checked={value.active} onChange={(e) => set("active", e.target.checked)} />
                Aktivní na eshopu
              </label>
            </div>

            {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}

            <div className="header-actions" style={{ marginTop: 16 }}>
              <button className="btn primary" disabled={isPending} onClick={submit}>
                {isPending ? "Ukládám…" : "Uložit"}
              </button>
              <button className="btn" onClick={() => setOpen(false)} disabled={isPending}>
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
