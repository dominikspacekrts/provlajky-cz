"use client";

import { useState, useTransition } from "react";
import { createProduct, updateProduct, type ProductInput } from "@/lib/actions/products";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductConfig,
  type ProductKind,
  type ProductOption,
  type ProductVariant,
  type TentWalls,
  type FlagMaterial,
  type CustomFlagConfig,
} from "@/lib/types";

const emptyBanner = (): NonNullable<ProductConfig["banner"]> => ({
  pvc: { buyPerM2: 0, sellPerM2: 0 },
  mesh: { buyPerM2: 0, sellPerM2: 0 },
});

const emptyOption = (): ProductOption => ({
  id: crypto.randomUUID().slice(0, 8),
  label: "",
  sellPrice: 0,
  buyPrice: 0,
});

const emptyFlagMaterial = (): FlagMaterial => ({
  id: crypto.randomUUID().slice(0, 8),
  label: "",
  sellPerM2: 0,
  buyPerM2: 0,
});

const emptyCustomFlag = (): CustomFlagConfig => ({
  materials: [],
  eyeletSurchargePct: 20,
  maxDimState: 300,
  maxDimCustom: 200,
});

const emptyVariant = (): ProductVariant => ({
  id: crypto.randomUUID().slice(0, 8),
  label: "",
  size: "",
  cost: 0,
  customs: 0,
  airFreight: 0,
  trainFreight: 0,
  transactionFee: 0,
  sellAir: 0,
  sellTrain: 0,
});

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
  config: {},
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
    config: p.config || {},
  };
}

// Náklad = nákup + clo + doprava (dle způsobu) + cena z transakce.
function variantCost(v: ProductVariant, mode: "air" | "train") {
  const freight = mode === "air" ? v.airFreight : v.trainFreight;
  return v.cost + v.customs + freight + v.transactionFee;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0) + " Kč";

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

  // ── config helpers ─────────────────────────────────────────────────────────
  const banner = value.config.banner ?? emptyBanner();
  const variants = value.config.variants ?? [];
  const options = value.config.options ?? [];

  function setBanner(next: NonNullable<ProductConfig["banner"]>) {
    setValue((cur) => ({ ...cur, config: { ...cur.config, banner: next } }));
  }
  function setVariants(next: ProductVariant[]) {
    setValue((cur) => ({ ...cur, config: { ...cur.config, variants: next } }));
  }
  function patchVariant(id: string, patch: Partial<ProductVariant>) {
    setVariants(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }
  function setOptions(next: ProductOption[]) {
    setValue((cur) => ({ ...cur, config: { ...cur.config, options: next } }));
  }
  function patchOption(id: string, patch: Partial<ProductOption>) {
    setOptions(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function setBuyPrice(v: number) {
    setValue((cur) => ({ ...cur, config: { ...cur.config, buyPrice: v } }));
  }

  const customFlag = value.config.customFlag ?? emptyCustomFlag();
  function setCustomFlag(next: CustomFlagConfig) {
    setValue((cur) => ({ ...cur, config: { ...cur.config, customFlag: next } }));
  }
  function patchFlagMaterial(id: string, patch: Partial<FlagMaterial>) {
    setCustomFlag({ ...customFlag, materials: customFlag.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  }

  function submit() {
    if (!value.name.trim()) {
      setError("Vyplň název produktu.");
      return;
    }
    // Odešli jen relevantní část configu podle typu.
    const cleanConfig: ProductConfig =
      value.kind === "banner_m2"
        ? { banner }
        : value.kind === "variant"
        ? { variants }
        : value.kind === "options"
        ? { options }
        : value.kind === "custom_flag"
        ? { customFlag }
        : value.kind === "simple"
        ? { buyPrice: value.config.buyPrice ?? 0 }
        : {};
    setError(null);
    startTransition(async () => {
      try {
        const payload = { ...value, config: cleanConfig };
        if (product) await updateProduct(product.id, payload);
        else await createProduct(payload);
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
                <input value={value.slug} placeholder={value.name} onChange={(e) => set("slug", e.target.value)} />
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
                  <option value="configurable">Konfigurovatelný (tvar/velikost — vlajky)</option>
                  <option value="banner_m2">Banner na m² (PVC / mesh)</option>
                  <option value="custom_flag">Vlajky na zakázku (materiály za m²)</option>
                  <option value="variant">Varianty s náklady (stany, nafukovací, díly)</option>
                  <option value="options">Volby s cenou (hmotnost apod. — stojany)</option>
                  <option value="simple">Jednoduchý (pevná cena — příslušenství)</option>
                </select>
              </label>

              {value.kind === "simple" && (
                <div className="variant-row" style={{ marginBottom: 0 }}>
                  <label style={{ flex: 1 }}>
                    Prodejní cena bez DPH (Kč)
                    <input
                      type="number"
                      step="0.01"
                      value={value.price}
                      onChange={(e) => set("price", Number(e.target.value) || 0)}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    Nákupní cena bez DPH (Kč)
                    <input
                      type="number"
                      step="0.01"
                      value={value.config.buyPrice ?? 0}
                      onChange={(e) => setBuyPrice(Number(e.target.value) || 0)}
                    />
                    <small style={{ color: value.price >= (value.config.buyPrice ?? 0) ? "#16a34a" : "#dc2626" }}>
                      marže {fmt(value.price - (value.config.buyPrice ?? 0))}
                    </small>
                  </label>
                </div>
              )}

              {value.kind === "options" && (
                <div className="variant-block">
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--color-gray-700)" }}>
                      Volby (např. hmotnost) — u každé prodejní a nákupní cena bez DPH.
                    </div>
                    <button type="button" className="btn" onClick={() => setOptions([...options, emptyOption()])}>
                      + Volba
                    </button>
                  </div>
                  {options.length === 0 && <p className="muted">Zatím žádná volba. Přidej první tlačítkem výše.</p>}
                  {options.map((o) => (
                    <div key={o.id} className="variant-row" style={{ alignItems: "flex-end" }}>
                      <label style={{ flex: 2 }}>
                        Popis volby (např. 6 kg)
                        <input value={o.label} onChange={(e) => patchOption(o.id, { label: e.target.value })} />
                      </label>
                      <label style={{ flex: 1 }}>
                        Prodej
                        <input
                          type="number"
                          step="0.01"
                          value={o.sellPrice}
                          onChange={(e) => patchOption(o.id, { sellPrice: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        Nákup
                        <input
                          type="number"
                          step="0.01"
                          value={o.buyPrice}
                          onChange={(e) => patchOption(o.id, { buyPrice: Number(e.target.value) || 0 })}
                        />
                        <small style={{ color: o.sellPrice >= o.buyPrice ? "#16a34a" : "#dc2626" }}>
                          marže {fmt(o.sellPrice - o.buyPrice)}
                        </small>
                      </label>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => setOptions(options.filter((x) => x.id !== o.id))}
                      >
                        Smazat
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {value.kind === "configurable" && (
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

              {value.kind === "banner_m2" && (
                <div className="variant-block">
                  <div style={{ fontSize: 13, color: "var(--color-gray-700)", marginBottom: 8 }}>
                    Cena za m² bez DPH — nákupní a prodejní, zvlášť pro plnou PVC plachtovinu a mesh.
                  </div>
                  {(["pvc", "mesh"] as const).map((mat) => (
                    <div key={mat} className="variant-row" style={{ alignItems: "flex-end" }}>
                      <div style={{ minWidth: 90, fontWeight: 600 }}>{mat === "pvc" ? "PVC plachta" : "Mesh"}</div>
                      <label style={{ flex: 1 }}>
                        Nákup / m²
                        <input
                          type="number"
                          step="0.01"
                          value={banner[mat].buyPerM2}
                          onChange={(e) =>
                            setBanner({ ...banner, [mat]: { ...banner[mat], buyPerM2: Number(e.target.value) || 0 } })
                          }
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        Prodej / m²
                        <input
                          type="number"
                          step="0.01"
                          value={banner[mat].sellPerM2}
                          onChange={(e) =>
                            setBanner({ ...banner, [mat]: { ...banner[mat], sellPerM2: Number(e.target.value) || 0 } })
                          }
                        />
                      </label>
                      <div style={{ minWidth: 130, fontSize: 12, color: "var(--color-gray-700)" }}>
                        marže {fmt(banner[mat].sellPerM2 - banner[mat].buyPerM2)}/m²
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {value.kind === "custom_flag" && (
                <div className="variant-block">
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--color-gray-700)" }}>
                      Materiály vlajek na zakázku — cena za m² bez DPH (prodej i nákup). Zákazník vybere materiál,
                      zadá rozměr a cena se spočítá podle plochy. Typy a umístění oček řeší eshop automaticky.
                    </div>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setCustomFlag({ ...customFlag, materials: [...customFlag.materials, emptyFlagMaterial()] })}
                    >
                      + Materiál
                    </button>
                  </div>

                  {customFlag.materials.length === 0 && (
                    <p className="muted">Zatím žádný materiál. Přidej první tlačítkem výše.</p>
                  )}

                  {customFlag.materials.map((m) => (
                    <div key={m.id} className="variant-row" style={{ alignItems: "flex-end" }}>
                      <label style={{ flex: 2 }}>
                        Materiál (např. polyglans)
                        <input value={m.label} onChange={(e) => patchFlagMaterial(m.id, { label: e.target.value })} />
                      </label>
                      <label style={{ flex: 1 }}>
                        Prodej / m²
                        <input
                          type="number"
                          step="0.01"
                          value={m.sellPerM2}
                          onChange={(e) => patchFlagMaterial(m.id, { sellPerM2: Number(e.target.value) || 0 })}
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        Nákup / m²
                        <input
                          type="number"
                          step="0.01"
                          value={m.buyPerM2}
                          onChange={(e) => patchFlagMaterial(m.id, { buyPerM2: Number(e.target.value) || 0 })}
                        />
                        <small style={{ color: m.sellPerM2 >= m.buyPerM2 ? "#16a34a" : "#dc2626" }}>
                          marže {fmt(m.sellPerM2 - m.buyPerM2)}/m²
                        </small>
                      </label>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() =>
                          setCustomFlag({ ...customFlag, materials: customFlag.materials.filter((x) => x.id !== m.id) })
                        }
                      >
                        Smazat
                      </button>
                    </div>
                  ))}

                  <div className="variant-row" style={{ marginTop: 12 }}>
                    <label style={{ flex: 1 }}>
                      Hustší oka každých 30 cm (+%)
                      <input
                        type="number"
                        step="1"
                        value={customFlag.eyeletSurchargePct}
                        onChange={(e) => setCustomFlag({ ...customFlag, eyeletSurchargePct: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label style={{ flex: 1 }}>
                      Max rozměr — státní (cm)
                      <input
                        type="number"
                        step="1"
                        value={customFlag.maxDimState}
                        onChange={(e) => setCustomFlag({ ...customFlag, maxDimState: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <label style={{ flex: 1 }}>
                      Max rozměr — vlastní (cm)
                      <input
                        type="number"
                        step="1"
                        value={customFlag.maxDimCustom}
                        onChange={(e) => setCustomFlag({ ...customFlag, maxDimCustom: Number(e.target.value) || 0 })}
                      />
                    </label>
                  </div>
                </div>
              )}

              {value.kind === "variant" && (
                <div className="variant-block">
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--color-gray-700)" }}>
                      Varianty — u každé zadej náklad (nákup, clo, doprava, transakce). Součet se dopočítá; podle něj
                      nastav prodejní cenu. Prodej letecky = dodání do 14 dní, prodej vlakem = dodání do 2 měsíců.
                      Na eshopu se produkt automaticky rozdělí na karty podle „Rozměru". „Grafika (stěny)" určuje
                      kreslený náhled stanu (u nůžkových stanů) — necháš-li Auto, odvodí se z popisu varianty.
                    </div>
                    <button type="button" className="btn" onClick={() => setVariants([...variants, emptyVariant()])}>
                      + Varianta
                    </button>
                  </div>

                  {variants.length === 0 && <p className="muted">Zatím žádná varianta. Přidej první tlačítkem výše.</p>}

                  {variants.map((v) => {
                    const costAir = variantCost(v, "air");
                    const costTrain = variantCost(v, "train");
                    return (
                      <div key={v.id} className="variant-card">
                        <div className="variant-row">
                          <label style={{ flex: 3 }}>
                            Popis varianty
                            <input value={v.label} onChange={(e) => patchVariant(v.id, { label: e.target.value })} />
                          </label>
                          <label style={{ flex: 1 }}>
                            Rozměr
                            <input
                              value={v.size ?? ""}
                              onChange={(e) => patchVariant(v.id, { size: e.target.value })}
                            />
                          </label>
                          <label style={{ flex: 1.4 }}>
                            Grafika (stěny)
                            <select
                              value={v.walls ?? ""}
                              onChange={(e) =>
                                patchVariant(v.id, { walls: (e.target.value || undefined) as TentWalls | undefined })
                              }
                            >
                              <option value="">Auto (z popisu)</option>
                              <option value="none">Bez stěn (jen rám + strop)</option>
                              <option value="half">Poloviční stěny</option>
                              <option value="full">Celé stěny</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            className="btn danger"
                            style={{ alignSelf: "flex-end" }}
                            onClick={() => setVariants(variants.filter((x) => x.id !== v.id))}
                          >
                            Smazat
                          </button>
                        </div>

                        <div className="variant-row">
                          {(
                            [
                              ["cost", "Nákup / ks"],
                              ["customs", "Clo"],
                              ["airFreight", "Doprava letecky"],
                              ["trainFreight", "Doprava vlakem"],
                              ["transactionFee", "Cena z transakce"],
                            ] as const
                          ).map(([field, label]) => (
                            <label key={field} style={{ flex: 1 }}>
                              {label}
                              <input
                                type="number"
                                step="0.01"
                                value={v[field]}
                                onChange={(e) => patchVariant(v.id, { [field]: Number(e.target.value) || 0 })}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="variant-sum">
                          <span>
                            Náklad <b>letecky:</b> {fmt(costAir)} &nbsp;·&nbsp; <b>vlakem:</b> {fmt(costTrain)}
                          </span>
                        </div>

                        <div className="variant-row">
                          <label style={{ flex: 1 }}>
                            Prodejní cena — dodání do 14 dní (letecky)
                            <input
                              type="number"
                              step="0.01"
                              value={v.sellAir}
                              onChange={(e) => patchVariant(v.id, { sellAir: Number(e.target.value) || 0 })}
                            />
                            <small style={{ color: v.sellAir >= costAir ? "#16a34a" : "#dc2626" }}>
                              marže {fmt(v.sellAir - costAir)}
                            </small>
                          </label>
                          <label style={{ flex: 1 }}>
                            Prodejní cena — dodání do 2 měsíců (vlakem)
                            <input
                              type="number"
                              step="0.01"
                              value={v.sellTrain}
                              onChange={(e) => patchVariant(v.id, { sellTrain: Number(e.target.value) || 0 })}
                            />
                            <small style={{ color: v.sellTrain >= costTrain ? "#16a34a" : "#dc2626" }}>
                              marže {fmt(v.sellTrain - costTrain)}
                            </small>
                          </label>
                        </div>
                      </div>
                    );
                  })}
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
