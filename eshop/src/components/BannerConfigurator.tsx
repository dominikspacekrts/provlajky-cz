"use client";

// Konfigurátor PVC banneru na m². Uživatel zvolí materiál (PVC / mesh), zadá
// rozměr v cm a nahraje grafiku — náhled se přizpůsobí poměru stran zadaného
// rozměru a cena se spočítá podle plochy (cena/m² z adminu).

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import {
  BANNER_MATERIAL_LABEL,
  bannerAreaM2,
  bannerPrice,
  fmtMoney,
  type BannerMaterial,
} from "@/lib/money";
import type { Product } from "@/lib/types";

export default function BannerConfigurator({ product }: { product: Product }) {
  const { addLine } = useCart();
  const router = useRouter();

  const banner = product.config?.banner;
  const [material, setMaterial] = useState<BannerMaterial>("pvc");
  const [w, setW] = useState(200);
  const [h, setH] = useState(100);
  const [qty, setQty] = useState(1);
  const [artwork, setArtwork] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pricing = banner?.[material];
  const m2 = useMemo(() => bannerAreaM2(w, h), [w, h]);
  const unitPrice = useMemo(
    () => (pricing ? bannerPrice(pricing, w, h) : 0),
    [pricing, w, h]
  );

  // Náhled drží poměr stran zadaného rozměru (max 360×260 px).
  const preview = useMemo(() => {
    const ratio = w > 0 && h > 0 ? w / h : 2;
    let pw = 360;
    let ph = pw / ratio;
    if (ph > 260) {
      ph = 260;
      pw = ph * ratio;
    }
    return { pw: Math.round(pw), ph: Math.round(ph) };
  }, [w, h]);

  function pickArtwork(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    // Downscale na náhled ~1000 px delší strany kvůli velikosti v košíku.
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const max = 1000;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
        setArtwork(c.toDataURL("image/jpeg", 0.85));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleAdd() {
    if (unitPrice <= 0) return;
    addLine({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      type: "banner",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: artwork,
      note: `${w}×${h} cm (${m2.toFixed(2)} m²) · ${BANNER_MATERIAL_LABEL[material]}${
        artwork ? " · s grafikou" : " · grafiku dodáme ke schválení"
      }`,
      // Grafiku předáme do objednávky přes design.thumb (route posílá jen design, ne thumb).
      design: artwork ? { thumb: artwork, source: "eshop" } : null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="configurator">
      <div className="config-preview">
        <div
          className="banner-preview"
          style={{ width: preview.pw, height: preview.ph }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {artwork ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={artwork} alt="Náhled grafiky" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="banner-preview-hint">＋ Nahrát grafiku</span>
          )}
          <span className="banner-preview-dims">
            {w} × {h} cm
          </span>
          <i className="banner-preview-eyelets" aria-hidden="true">
            <b /><b /><b /><b /><b /><b />
          </i>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={(e) => pickArtwork(e.target.files)}
        />
      </div>

      <div>
        <h1 style={{ fontSize: 30 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        <div className="option-label">Materiál</div>
        <div className="option-row">
          {(["pvc", "mesh"] as const).map((mat) => (
            <button
              key={mat}
              className={`option-chip${material === mat ? " active" : ""}`}
              onClick={() => setMaterial(mat)}
            >
              {BANNER_MATERIAL_LABEL[mat]}
            </button>
          ))}
        </div>
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          {material === "pvc"
            ? "Plná PVC plachtovina 510 g/m² — univerzální, sytý potisk, oka po obvodu."
            : "Mesh se síťovou strukturou propouští vítr — ideální na ploty a vysoké budovy."}
        </p>

        <div className="option-label">Rozměr banneru</div>
        <div className="banner-dim-row">
          <label>
            Šířka (cm)
            <input type="number" min={10} value={w} onChange={(e) => setW(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <span className="banner-dim-x">×</span>
          <label>
            Výška (cm)
            <input type="number" min={10} value={h} onChange={(e) => setH(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <div className="banner-area">{m2.toFixed(2)} m²</div>
        </div>

        <div style={{ marginTop: 18 }}>
          <button className="btn-outline btn-design" onClick={() => fileRef.current?.click()}>
            🎨 {artwork ? "Změnit grafiku" : "Nahrát vlastní grafiku"}
          </button>
          {artwork && (
            <button className="link-reset" onClick={() => setArtwork(null)}>
              Odebrat
            </button>
          )}
        </div>
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Grafika není podmínkou — pokud ji nenahrajete, připravíme návrh po objednávce a pošleme ke schválení.
        </p>

        <div className="config-price">
          {unitPrice > 0 ? (
            <>
              {fmtMoney(unitPrice)} <span className="vat">bez DPH / ks</span>
            </>
          ) : (
            <span style={{ fontSize: 20 }}>Cena na dotaz</span>
          )}
        </div>

        <div className="qty-row">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Počet kusů</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-yellow" disabled={unitPrice <= 0} onClick={handleAdd}>
            {added ? "Přidáno ✓" : "Vložit do košíku"}
          </button>
          <button className="btn-outline" onClick={() => router.push("/kosik")}>
            Přejít do košíku
          </button>
        </div>
        {unitPrice <= 0 && (
          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 10 }}>
            Cena za m² pro tento materiál zatím není nastavená — napište nám na{" "}
            <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>.
          </p>
        )}

        {product.description && (
          <p style={{ color: "var(--gray)", marginTop: 24, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description}
          </p>
        )}
      </div>
    </div>
  );
}
