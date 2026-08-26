"use client";

// Konfigurátor variant (nůžkové/nafukovací stany, totemy, brány, díly).
// Uživatel vybere variantu a rychlost dodání (do 14 dní / do 2 měsíců) — cenu
// řídí prodejní cena nastavená v adminu. Doprava letecky/vlakem se nezobrazuje.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import {
  DELIVERY_LABEL,
  fmtMoney,
  availableSpeeds,
  variantSellPrice,
  type DeliverySpeed,
} from "@/lib/money";
import {
  wallsFromVariant,
  tentRealImage,
  INFLATABLE_TENT_IMAGE,
  type Product,
  type ProductVariant,
} from "@/lib/types";
import { CheckMark } from "@/components/Icons";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";

export default function VariantConfigurator({
  product,
  size,
  galleryPhotos,
}: {
  product: Product;
  size?: string;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const router = useRouter();

  // Když je zadaná velikost (split podle velikosti), zúžíme varianty jen na ni —
  // rozbalovátko pak nabízí čistě konfiguraci stěn (jako HS u vlajek).
  const variants = useMemo<ProductVariant[]>(() => {
    const all = product.config?.variants ?? [];
    if (!size) return all;
    const filtered = all.filter((v) => (v.size ?? "").trim() === size.trim());
    return filtered.length > 0 ? filtered : all;
  }, [product, size]);

  const isNuzkovy = product.category === "nuzkove-stany";
  const isNafukovaci = product.category === "nafukovaci-stany";
  const title = size ? `${product.name} ${size}` : product.name;

  // Když je velikost už daná (viz filtr variants výš), je zbytečné ji
  // opakovat v každém štítku ("3×3 m · rám + strop..." pro každou volbu) —
  // ať jde vidět jen to, čím se možnosti liší.
  const stripSizePrefix = (label: string) =>
    size ? label.replace(new RegExp(`^\\s*${size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*·\\s*`), "") : label;

  const [variantId, setVariantId] = useState<string>(variants[0]?.id ?? "");
  const selected = variants.find((v) => v.id === variantId) ?? variants[0];

  const speeds = selected ? availableSpeeds(selected) : [];
  const [speed, setSpeed] = useState<DeliverySpeed>("fast");
  const activeSpeed: DeliverySpeed = speeds.includes(speed) ? speed : speeds[0] ?? "fast";

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const unitPrice = selected ? variantSellPrice(selected, activeSpeed) : 0;
  const image = product.images?.[0];

  function handleAdd() {
    if (!selected || unitPrice <= 0) return;
    addLine({
      productId: product.id,
      productSlug: product.slug,
      name: title,
      type: "product",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: image || null,
      note: `${selected.label} · ${DELIVERY_LABEL[activeSpeed]}`,
      variantId: selected.id,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  if (variants.length === 0) {
    return (
      <div className="container">
        <div className="page-panel">
          <h1 style={{ fontSize: 30 }}>{title}</h1>
          <p style={{ color: "var(--gray)", marginTop: 12 }}>
            Varianty připravujeme. Napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> a
            připravíme nabídku na míru.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}`}>
      <div className="fc-stage">
        {(isNuzkovy || isNafukovaci) && selected ? (
          <Image
            src={isNuzkovy ? tentRealImage(wallsFromVariant(selected)) : INFLATABLE_TENT_IMAGE}
            alt={`${product.name} ${selected.label}`}
            width={640}
            height={480}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            unoptimized
          />
        ) : image ? (
          <Image
            src={image}
            alt={product.name}
            width={520}
            height={620}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            unoptimized
          />
        ) : (
          <span style={{ fontSize: 60 }}>⛺</span>
        )}
      </div>

      <aside className="fc-panel reveal-stagger">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" className="config-hero-logo" style={{ marginBottom: 22 }} />

        <h1 style={{ fontSize: 28 }}>{title}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        <div className="option-label">{isNuzkovy ? "Konfigurace stěn" : "Varianta"}</div>
        <div className="option-row">
          {variants.map((v) => (
            <button
              key={v.id}
              className={`option-chip${selected?.id === v.id ? " active" : ""}`}
              onClick={() => setVariantId(v.id)}
            >
              {stripSizePrefix(v.label)}
            </button>
          ))}
        </div>

        {speeds.length > 0 && (
          <>
            <div className="option-label">Rychlost dodání</div>
            <div className="option-row">
              {speeds.map((s) => (
                <button
                  key={s}
                  className={`option-chip${activeSpeed === s ? " active" : ""}`}
                  onClick={() => setSpeed(s)}
                >
                  {DELIVERY_LABEL[s]} · {fmtMoney(variantSellPrice(selected, s))}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="qty-row">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Počet kusů</span>
          <div className="qty-stepper">
            <button type="button" aria-label="Ubrat kus" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
              −
            </button>
            <span className="qty-value">{qty}</span>
            <button type="button" aria-label="Přidat kus" onClick={() => setQty((q) => q + 1)}>
              +
            </button>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn-outline" onClick={() => router.push("/kosik")}>
            Přejít do košíku
          </button>
        </div>
        {unitPrice <= 0 && (
          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 10 }}>
            Pro tuto variantu zatím nemáme nastavenou cenu — napište nám na{" "}
            <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>.
          </p>
        )}

        <div className="fc-cta">
          <div className="fc-cta-price">
            {unitPrice > 0 ? (
              <>
                {fmtMoney(unitPrice)} <span className="vat">bez DPH / ks</span>
              </>
            ) : (
              <span>Cena na dotaz</span>
            )}
          </div>
          <button className="btn-yellow" disabled={unitPrice <= 0} onClick={handleAdd}>
            {added ? (<><CheckMark className="btn-mark" /> Přidáno</>) : ("Vložit do košíku")}
          </button>
        </div>

        {product.description && (
          <p style={{ color: "var(--gray)", marginTop: 24, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description}
          </p>
        )}
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />
    </div>
  );
}
