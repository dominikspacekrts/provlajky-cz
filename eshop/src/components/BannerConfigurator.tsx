"use client";

// Konfigurátor banneru / meshe na m². Materiál je daný produktem (Frontlit 500 B1
// nebo Easy Mesh 270) — bez přepínání. Rozměr v cm + volitelný editor návrhu
// jako u plážových vlajek.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { BANNER_MATERIAL_LABEL, bannerAreaM2, bannerPrice, type BannerMaterial } from "@/lib/money";
import { BANNER_MATERIAL_BLURB } from "@/lib/productCopy";
import type { Product } from "@/lib/types";
import { makeRectThumb, type RectDesign } from "@/lib/rectDesign";
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

const RectDesignEditor = dynamic(() => import("./RectDesignEditor"), { ssr: false });

const MOBILE_STEPS = ["Rozměr", "Vlastní návrh"] as const;

/** Materiál zafixovaný podle produktu — zákazník si PVC/mesh vybere už na výpisu kategorie. */
export function resolveBannerMaterial(product: Product): BannerMaterial {
  const slug = product.slug.toLowerCase();
  const name = product.name.toLowerCase();
  if (slug.includes("mesh") || name.includes("mesh")) return "mesh";
  if (slug.includes("pvc") || name.includes("frontlit") || name.includes("banner") || name.includes("placht")) {
    return "pvc";
  }
  const b = product.config?.banner;
  if ((b?.mesh.sellPerM2 ?? 0) > 0 && !((b?.pvc.sellPerM2 ?? 0) > 0)) return "mesh";
  return "pvc";
}

export default function BannerConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();

  const material = useMemo(() => resolveBannerMaterial(product), [product]);
  const banner = product.config?.banner;
  const pricing = banner?.[material];

  const [w, setW] = useState(200);
  const [h, setH] = useState(100);
  const [qty, setQty] = useState(1);
  const [design, setDesign] = useState<RectDesign | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);

  const m2 = useMemo(() => bannerAreaM2(w, h), [w, h]);
  const unitPrice = useMemo(
    () => (pricing ? bannerPrice(pricing, w, h) : 0),
    [pricing, w, h]
  );

  useEffect(() => {
    if (!design?.logoDataUrl || design.logoIsPdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = design.logoDataUrl;
  }, [design?.logoDataUrl, design?.logoIsPdf]);

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

  const previewSrc = useMemo(() => {
    if (!design) return null;
    if (design.logoIsPdf) return null;
    return makeRectThumb(design, logoImg, w, h);
  }, [design, logoImg, w, h]);

  function handleAdd() {
    if (unitPrice <= 0) return;
    const thumb = design ? makeRectThumb(design, logoImg, w, h) : null;
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
      thumb,
      widthCm: w,
      heightCm: h,
      material,
      note: `${w}×${h} cm (${m2.toFixed(2)} m²) · ${BANNER_MATERIAL_LABEL[material]}${
        design ? " · vlastní návrh z editoru" : " · grafiku dodáme ke schválení"
      }`,
      design: design
        ? {
            bgColor: design.bgColor,
            thumb,
            source: "eshop",
            logo: design.logoDataUrl
              ? {
                  src: design.logoDataUrl,
                  x: design.logoX - design.logoScale / 2,
                  y: design.logoY - design.logoScale / 2,
                  w: design.logoScale,
                  h: design.logoScale,
                  rotation: design.logoRotation || 0,
                }
              : null,
            eshop: {
              logoX: design.logoX,
              logoY: design.logoY,
              logoScale: design.logoScale,
              shape: "D",
              hs: false,
            },
          }
        : null,
    });
    setAskNext(true);
  }

  const sizeBlock = (
    <>
      <div className="fc-material-card">
        <div className="fc-material-card-title">{BANNER_MATERIAL_LABEL[material]}</div>
        <p className="fc-material-card-body">{BANNER_MATERIAL_BLURB[material]}</p>
      </div>

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
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Cena za m² zatím není nastavená — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  const designBlock = (
    <>
      <div style={{ marginTop: isMobile ? 0 : 10 }}>
        <button className="btn-outline btn-design" onClick={() => setEditorOpen(true)}>
          <PenMark className="btn-mark" />
          {design ? "Upravit vlastní návrh" : "Navrhnout vlastní grafiku"}
        </button>
        {design && (
          <button className="link-reset" onClick={() => setDesign(null)}>
            Odebrat návrh
          </button>
        )}
      </div>
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
        {design
          ? "Návrh je uložený a propíše se do objednávky."
          : "Volitelné — pokud grafiku nenahrajete, připravíme návrh po objednávce a pošleme ke schválení."}
      </p>
    </>
  );

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        <div className="banner-preview" style={{ width: preview.pw, height: preview.ph }}>
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="Náhled grafiky" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : design?.logoIsPdf ? (
            <span className="banner-preview-hint">PDF nahráno</span>
          ) : (
            <span className="banner-preview-hint">{BANNER_MATERIAL_LABEL[material]}</span>
          )}
          <span className="banner-preview-dims">
            {w} × {h} cm
          </span>
          <i className="banner-preview-eyelets" aria-hidden="true">
            <b /><b /><b /><b /><b /><b />
          </i>
        </div>
        <FcContactLink />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          {isMobile ? (
            <>
              <FcStepHeader steps={MOBILE_STEPS} step={step} />
              <FcStepBody step={step}>
                {step === 0 && sizeBlock}
                {step === 1 && designBlock}
              </FcStepBody>
            </>
          ) : (
            <>
              <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
              {sizeBlock}
              {designBlock}
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

      {editorOpen && (
        <RectDesignEditor
          title={`Návrh — ${BANNER_MATERIAL_LABEL[material]}`}
          widthCm={w}
          heightCm={h}
          initial={design}
          onSave={setDesign}
          onClose={() => setEditorOpen(false)}
        />
      )}

      <AddedToCartDialog
        open={askNext}
        onClose={() => setAskNext(false)}
        summary={`${product.name} · ${BANNER_MATERIAL_LABEL[material]} · ${w}×${h} cm`}
      />
    </div>
  );
}
