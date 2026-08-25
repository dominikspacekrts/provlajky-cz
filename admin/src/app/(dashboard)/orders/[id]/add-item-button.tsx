"use client";

import { useMemo, useState, useTransition } from "react";
import { addOrderItemFromProduct } from "@/lib/actions/orders";
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from "@/lib/types";

const SHAPES = ["A", "B", "C", "D", "E", "F"];
const SIZES = ["S", "M", "L", "XL"] as const;

const fmt = (n: number) => new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Math.round(n)) + " Kč";

export default function AddItemButton({
  orderId,
  products,
  defaultInternal,
}: {
  orderId: string;
  products: Product[];
  defaultInternal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [internal, setInternal] = useState(defaultInternal);
  const [qty, setQty] = useState(1);
  const [shape, setShape] = useState("A");
  const [size, setSize] = useState<(typeof SIZES)[number]>("M");
  const [widthCm, setWidthCm] = useState(100);
  const [heightCm, setHeightCm] = useState(100);
  const [material, setMaterial] = useState<"pvc" | "mesh">("pvc");
  const [variantId, setVariantId] = useState("");
  const [delivery, setDelivery] = useState<"air" | "train">("air");
  const [optionId, setOptionId] = useState("");
  const [flagMaterialId, setFlagMaterialId] = useState("");
  const [unitPriceOverride, setUnitPriceOverride] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Ke starším položkám (dopočet marže) potřebuje OrderDetailClient i
  // neaktivní produkty, ale nabízet k ručnímu přidání jde jen to, co je na
  // eshopu aktivní.
  const byCategory = useMemo(() => {
    const m = new Map<ProductCategory, Product[]>();
    for (const p of products) {
      if (!p.active) continue;
      if (!m.has(p.category)) m.set(p.category, []);
      m.get(p.category)!.push(p);
    }
    return m;
  }, [products]);

  const product = products.find((p) => p.id === productId) ?? null;

  function openModal() {
    setProductId("");
    setInternal(defaultInternal);
    setQty(1);
    setUnitPriceOverride(null);
    setError(null);
    setOpen(true);
  }

  function pickProduct(id: string) {
    setProductId(id);
    setUnitPriceOverride(null);
    const p = products.find((x) => x.id === id);
    if (!p) return;
    if (p.kind === "variant") setVariantId(p.config.variants?.[0]?.id ?? "");
    if (p.kind === "options") setOptionId(p.config.options?.[0]?.id ?? "");
    if (p.kind === "custom_flag") setFlagMaterialId(p.config.customFlag?.materials?.[0]?.id ?? "");
  }

  // Spočítá výchozí cenu/ks podle typu produktu a přepínače interní/prodejní.
  // Admin ji vždycky vidí a může přepsat — tohle je jen rozumný start.
  const computedUnitPrice = useMemo(() => {
    if (!product) return 0;
    if (product.kind === "configurable") {
      const sell = product.price_by_size?.[size] ?? 0;
      const cost = product.config.costBySize?.[size] ?? 0;
      return internal ? cost : sell;
    }
    if (product.kind === "banner_m2") {
      const m2 = (widthCm / 100) * (heightCm / 100);
      const mat = product.config.banner?.[material];
      return m2 * (internal ? mat?.buyPerM2 ?? 0 : mat?.sellPerM2 ?? 0);
    }
    if (product.kind === "variant") {
      const v = product.config.variants?.find((x) => x.id === variantId);
      if (!v) return 0;
      if (internal) return v.cost + v.customs + (delivery === "air" ? v.airFreight : v.trainFreight) + v.transactionFee;
      return delivery === "air" ? v.sellAir : v.sellTrain;
    }
    if (product.kind === "options") {
      const o = product.config.options?.find((x) => x.id === optionId);
      return o ? (internal ? o.buyPrice : o.sellPrice) : 0;
    }
    if (product.kind === "custom_flag") {
      const mat = product.config.customFlag?.materials?.find((x) => x.id === flagMaterialId);
      const m2 = (widthCm / 100) * (heightCm / 100);
      return mat ? m2 * (internal ? mat.buyPerM2 : mat.sellPerM2) : 0;
    }
    // simple
    return internal ? product.config.buyPrice ?? 0 : product.price;
  }, [product, size, widthCm, heightCm, material, variantId, delivery, optionId, flagMaterialId, internal]);

  const unitPrice = unitPriceOverride ?? computedUnitPrice;

  function lineName(): string {
    if (!product) return "";
    if (product.kind === "configurable") return `${product.name} — tvar ${shape}, ${size}`;
    if (product.kind === "banner_m2") return `${product.name} — ${material === "pvc" ? "PVC" : "mesh"} ${widthCm}×${heightCm} cm`;
    if (product.kind === "variant") {
      const v = product.config.variants?.find((x) => x.id === variantId);
      return v ? `${product.name} — ${v.label}` : product.name;
    }
    if (product.kind === "options") {
      const o = product.config.options?.find((x) => x.id === optionId);
      return o ? `${product.name} — ${o.label}` : product.name;
    }
    if (product.kind === "custom_flag") {
      const mat = product.config.customFlag?.materials?.find((x) => x.id === flagMaterialId);
      return `${product.name} — ${mat?.label ?? ""} ${widthCm}×${heightCm} cm`.trim();
    }
    return product.name;
  }

  function submit() {
    if (!product) {
      setError("Vyber produkt.");
      return;
    }
    setError(null);
    const isFlag = product.kind === "configurable";
    startTransition(async () => {
      try {
        await addOrderItemFromProduct(orderId, {
          type: product.kind === "banner_m2" ? "banner" : "flag",
          shape: isFlag ? shape : null,
          size: isFlag ? size : null,
          width_cm: product.kind === "banner_m2" || product.kind === "custom_flag" ? widthCm : null,
          height_cm: product.kind === "banner_m2" || product.kind === "custom_flag" ? heightCm : null,
          qty,
          unit_price: unitPrice,
          vat_rate: product.vat_rate,
          wc_line_name: lineName() + (internal ? " (interní nákup)" : ""),
          product_id: product.id,
          material: product.kind === "banner_m2" ? material : product.kind === "custom_flag" ? flagMaterialId : null,
          variant_id: product.kind === "variant" ? variantId : null,
          option_id: product.kind === "options" ? optionId : null,
          partner_ids: product.partner_ids || [],
        });
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nepodařilo se přidat položku.");
      }
    });
  }

  return (
    <>
      <button className="btn" onClick={openModal}>
        + Přidat položku
      </button>
      {open && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !isPending && setOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Přidat položku</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className="form-col">
              <label>
                Produkt
                <select value={productId} onChange={(e) => pickProduct(e.target.value)}>
                  <option value="">— vybrat produkt —</option>
                  {Array.from(byCategory.entries()).map(([cat, items]) => (
                    <optgroup key={cat} label={PRODUCT_CATEGORIES[cat]}>
                      {items.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              {product?.kind === "configurable" && (
                <div className="variant-row">
                  <label style={{ flex: 1 }}>
                    Tvar
                    <select value={shape} onChange={(e) => setShape(e.target.value)}>
                      {SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    Velikost
                    <select value={size} onChange={(e) => setSize(e.target.value as (typeof SIZES)[number])}>
                      {SIZES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {product?.kind === "banner_m2" && (
                <div className="variant-row">
                  <label style={{ flex: 1 }}>
                    Materiál
                    <select value={material} onChange={(e) => setMaterial(e.target.value as "pvc" | "mesh")}>
                      <option value="pvc">PVC plachta</option>
                      <option value="mesh">Mesh</option>
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    Šířka (cm)
                    <input type="number" value={widthCm} onChange={(e) => setWidthCm(Number(e.target.value) || 0)} />
                  </label>
                  <label style={{ flex: 1 }}>
                    Výška (cm)
                    <input type="number" value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value) || 0)} />
                  </label>
                </div>
              )}

              {product?.kind === "variant" && (
                <div className="variant-row">
                  <label style={{ flex: 2 }}>
                    Varianta
                    <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                      {product.config.variants?.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label} {v.size ? `(${v.size})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    Doprava
                    <select value={delivery} onChange={(e) => setDelivery(e.target.value as "air" | "train")}>
                      <option value="air">letecky (14 dní)</option>
                      <option value="train">vlakem (2 měsíce)</option>
                    </select>
                  </label>
                </div>
              )}

              {product?.kind === "options" && (
                <label>
                  Volba
                  <select value={optionId} onChange={(e) => setOptionId(e.target.value)}>
                    {product.config.options?.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {product?.kind === "custom_flag" && (
                <div className="variant-row">
                  <label style={{ flex: 1 }}>
                    Materiál
                    <select value={flagMaterialId} onChange={(e) => setFlagMaterialId(e.target.value)}>
                      {product.config.customFlag?.materials?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ flex: 1 }}>
                    Šířka (cm)
                    <input type="number" value={widthCm} onChange={(e) => setWidthCm(Number(e.target.value) || 0)} />
                  </label>
                  <label style={{ flex: 1 }}>
                    Výška (cm)
                    <input type="number" value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value) || 0)} />
                  </label>
                </div>
              )}

              {product && (
                <>
                  <div className="variant-row">
                    <label style={{ flex: 1 }}>
                      Počet ks
                      <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
                    </label>
                    <label style={{ flex: 1 }}>
                      Cena/ks bez DPH
                      <input
                        type="number"
                        step="0.01"
                        value={unitPrice}
                        onChange={(e) => setUnitPriceOverride(Number(e.target.value) || 0)}
                      />
                    </label>
                  </div>

                  <label className="cb-line">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => {
                        setInternal(e.target.checked);
                        setUnitPriceOverride(null);
                      }}
                    />
                    Interní nákup — nákupní (ne prodejní) cena
                  </label>

                  <div className="variant-sum">
                    Řádek: <b>{lineName()}</b> · {qty} × {fmt(unitPrice)} = {fmt(unitPrice * qty)}
                  </div>
                </>
              )}
            </div>

            {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}

            <div className="header-actions" style={{ marginTop: 16 }}>
              <button className="btn primary" disabled={isPending || !product} onClick={submit}>
                {isPending ? "Přidávám…" : "Přidat"}
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
