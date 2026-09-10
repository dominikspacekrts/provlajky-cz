"use client";

// Konfigurátor PVC banneru na m². Uživatel zvolí materiál (PVC / mesh), zadá
// rozměr v cm a nahraje grafiku — náhled se přizpůsobí poměru stran zadaného
// rozměru a cena se spočítá podle plochy (cena/m² z adminu).

import { useMemo, useRef, useState } from "react";
import { useCart } from "@/lib/cart";
import {
  BANNER_MATERIAL_LABEL,
  bannerAreaM2,
  bannerPrice,
  type BannerMaterial,
} from "@/lib/money";
import type { Product } from "@/lib/types";
import { PenMark } from "@/components/Icons";
import { useConfiguratorLayout } from "@/lib/useConfiguratorLayout";
import {
  AddedToCartDialog,
  FcContactLink,
  FcDesktopHeader,
  FcStepBody,
  FcStepHeader,
  FcStepNav,
} from "@/components/ConfiguratorChrome";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import CtaBar from "@/components/CtaBar";

const MOBILE_STEPS = ["Materiál a rozměr", "Grafika"] as const;

export default function BannerConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();

  const banner = product.config?.banner;
  const [material, setMaterial] = useState<BannerMaterial>("pvc");
  const [w, setW] = useState(200);
  const [h, setH] = useState(100);
  const [qty, setQty] = useState(1);
  const [artwork, setArtwork] = useState<string | null>(null);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pricing = banner?.[material];
  const m2 = useMemo(() => bannerAreaM2(w, h), [w, h]);
  const unitPrice = useMemo(
    () => (pricing ? bannerPrice(pricing, w, h) : 0),
    [pricing, w, h]
  );

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
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isSvg && !isPdf) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      if (isPdf) {
        setArtwork(src);
        return;
      }
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
      widthCm: w,
      heightCm: h,
      material,
      note: `${w}×${h} cm (${m2.toFixed(2)} m²) · ${BANNER_MATERIAL_LABEL[material]}${
        artwork ? " · s grafikou" : " · grafiku dodáme ke schválení"
      }`,
      design: artwork ? { thumb: artwork, source: "eshop" } : null,
    });
    setAskNext(true);
  }

  const materialSizeBlock = (
    <>
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
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
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
    </>
  );

  const artworkBlock = (
    <>
      <div style={{ marginTop: isMobile ? 0 : 14 }}>
        <button className="btn-outline btn-design" onClick={() => fileRef.current?.click()}>
          <PenMark className="btn-mark" />
          {artwork ? "Změnit grafiku" : "Nahrát vlastní grafiku"}
        </button>
        {artwork && (
          <button className="link-reset" onClick={() => setArtwork(null)}>
            Odebrat
          </button>
        )}
      </div>
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
        Grafika není podmínkou — pokud ji nenahrajete, připravíme návrh po objednávce a pošleme ke schválení.
      </p>
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Cena za m² pro tento materiál zatím není nastavená — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        <div
          className="banner-preview"
          style={{ width: preview.pw, height: preview.ph }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {artwork ? (
            artwork.startsWith("data:application/pdf") ? (
              <span className="banner-preview-hint">PDF nahráno</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artwork} alt="Náhled grafiky" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )
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
          accept="image/svg+xml,.svg,application/pdf,.pdf"
          hidden
          onChange={(e) => pickArtwork(e.target.files)}
        />
        <FcContactLink />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          {isMobile ? (
            <>
              <FcStepHeader steps={MOBILE_STEPS} step={step} />
              <FcStepBody step={step}>
                {step === 0 && materialSizeBlock}
                {step === 1 && artworkBlock}
              </FcStepBody>
            </>
          ) : (
            <>
              <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
              {materialSizeBlock}
              {artworkBlock}
              {product.description && (
                <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {product.description}
                </p>
              )}
            </>
          )}
        </div>

        {isMobile && (
          <FcStepNav
            step={step}
            stepsCount={MOBILE_STEPS.length}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(step + 1)}
          />
        )}

        <CtaBar
          qty={qty}
          onQtyChange={setQty}
          unitPrice={unitPrice}
          disabled={unitPrice <= 0}
          addLabel="Do košíku"
          onAdd={handleAdd}
        />
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />

      <AddedToCartDialog
        open={askNext}
        onClose={() => setAskNext(false)}
        summary={`${product.name} · ${BANNER_MATERIAL_LABEL[material]} · ${w}×${h} cm`}
      />
    </div>
  );
}
