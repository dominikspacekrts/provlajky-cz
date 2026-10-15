"use client";

// Konfigurátor banneru / meshe na m². Materiál je daný produktem (Frontlit 500 B1
// nebo Easy Mesh 270) — bez přepínání. Rozměr v cm + volitelný editor návrhu
// jako u plážových vlajek.

import dynamic from "next/dynamic";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import MdText from "@/components/MdText";
import ArtworkChoice from "@/components/ArtworkChoice";
import {
  freeDesignNote,
  OWN_ARTWORK_PENDING_NOTE,
  freeDesignOrderDesign,
  type ArtworkMode,
  type FreeDesignLogo,
} from "@/lib/designTemplates";

const RectDesignEditor = dynamic(() => import("./RectDesignEditor"), { ssr: false });

const MOBILE_STEPS = ["Rozměr", "Grafika"] as const;

/** Strana o tolika cm vyplní kratší hranu náhledu. Menší banner je menší,
 *  větší se vejde až po okraj a dál už neroste. */
const PREVIEW_REF_CM = 220;

/** Pole drží text, ať jde hodnotu smazat celou. Prázdný řetězec zůstane
 *  prázdný — dřív se hned vrátila 0 a další číslice se psala před ni. */
function sanitizeDimInput(raw: string): string {
  const next = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (next === "") return "";
  const dot = next.indexOf(".");
  const intRaw = (dot === -1 ? next : next.slice(0, dot)).replace(/^0+(?=\d)/, "");
  if (dot === -1) return intRaw;
  const frac = next.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${intRaw === "" ? "0" : intRaw}.${frac}`;
}

function parseDim(raw: string): number {
  const n = Number(raw);
  return raw === "" || !Number.isFinite(n) ? 0 : Math.max(0, n);
}

function previewPixels(widthCm: number, heightCm: number, frameW: number, frameH: number) {
  if (frameW < 8 || frameH < 8) return null;
  const wCm = Math.max(widthCm, 1);
  const hCm = Math.max(heightCm, 1);
  const pxPerCm = Math.min(frameW, frameH) / PREVIEW_REF_CM;
  let pw = wCm * pxPerCm;
  let ph = hCm * pxPerCm;
  const fit = Math.min(1, frameW / pw, frameH / ph);
  pw *= fit;
  ph *= fit;
  const minSide = 72;
  const longSide = Math.max(pw, ph);
  if (longSide > 0 && longSide < minSide) {
    const up = Math.min(minSide / longSide, frameW / pw, frameH / ph);
    pw *= up;
    ph *= up;
  }
  return { width: Math.max(1, Math.round(pw)), height: Math.max(1, Math.round(ph)) };
}

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

  const [wInput, setWInput] = useState("200");
  const [hInput, setHInput] = useState("100");
  const [held, setHeld] = useState({ w: 200, h: 100 });
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [qty, setQty] = useState(1);
  const [design, setDesign] = useState<RectDesign | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [artworkMode, setArtworkMode] = useState<ArtworkMode>("own");
  const [freeLogo, setFreeLogo] = useState<FreeDesignLogo | null>(null);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);

  const w = parseDim(wInput);
  const h = parseDim(hInput);
  const previewCm = { w: w > 0 ? w : held.w, h: h > 0 ? h : held.h };

  const m2 = useMemo(() => bannerAreaM2(w, h), [w, h]);
  const unitPrice = useMemo(
    () => (pricing ? bannerPrice(pricing, w, h) : 0),
    [pricing, w, h]
  );

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setFrame((prev) =>
        Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5
          ? prev
          : { w: r.width, h: r.height }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function setWidthInput(next: string) {
    setWInput(next);
    const n = parseDim(next);
    if (n > 0) setHeld((prev) => ({ ...prev, w: n }));
  }

  function setHeightInput(next: string) {
    setHInput(next);
    const n = parseDim(next);
    if (n > 0) setHeld((prev) => ({ ...prev, h: n }));
  }

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

  const previewSrc = useMemo(() => {
    if (!design || artworkMode === "free") return null;
    if (design.logoIsPdf) return null;
    return makeRectThumb(design, logoImg, w, h);
  }, [design, logoImg, w, h, artworkMode]);

  function handleAdd() {
    if (unitPrice <= 0 || w <= 0 || h <= 0) return;
    const free = artworkMode === "free";
    const thumb = !free && design ? makeRectThumb(design, logoImg, w, h) : null;
    addLine({
      productId: product.id,
      productSlug: product.slug,
      productCategory: product.category,
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
        free ? ` · ${freeDesignNote(freeLogo)}` : design ? " · vlastní návrh z editoru" : ` · ${OWN_ARTWORK_PENDING_NOTE}`
      }`,
      design: free
        ? freeDesignOrderDesign(freeLogo)
        : design
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
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={wInput}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setWidthInput(sanitizeDimInput(e.target.value))}
          />
        </label>
        <span className="banner-dim-x">×</span>
        <label>
          Výška (cm)
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={hInput}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setHeightInput(sanitizeDimInput(e.target.value))}
          />
        </label>
        <div className="banner-area">{w > 0 && h > 0 ? `${m2.toFixed(2)} m²` : "– m²"}</div>
      </div>
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Cena za m² zatím není nastavená — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  const previewBox = previewPixels(previewCm.w, previewCm.h, frame.w, frame.h);
  const dimLabel = (raw: string, n: number) => (raw === "" || n <= 0 ? "–" : raw);

  const designBlock = (
    <ArtworkChoice
      mode={artworkMode}
      onModeChange={setArtworkMode}
      logo={freeLogo}
      onLogoChange={setFreeLogo}
      own={
        <>
          <div style={{ marginTop: 10 }}>
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
              : "Nahrajte hotovou grafiku, nebo ji dodejte po objednávce."}
          </p>
        </>
      }
    />
  );

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        <div
          ref={frameRef}
          className="banner-preview-frame"
          style={
            isMobile && galleryPhotos?.length
              ? { left: 92, right: 16, top: 16, bottom: 16 }
              : undefined
          }
        >
          <div
            className="banner-preview banner-preview-fit"
            style={previewBox ?? { visibility: "hidden" }}
          >
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="Náhled grafiky" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : design?.logoIsPdf ? (
              <span className="banner-preview-hint">PDF nahráno</span>
            ) : (
              <span className="banner-preview-hint">{BANNER_MATERIAL_LABEL[material]}</span>
            )}
            <span className="banner-preview-dims">
              {dimLabel(wInput, w)} × {dimLabel(hInput, h)} cm
            </span>
            <i className="banner-preview-eyelets" aria-hidden="true">
              <b /><b /><b /><b /><b /><b />
            </i>
          </div>
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
                <MdText
                  style={{ color: "var(--gray)", fontSize: 13, marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}
                >
                  {product.description}
                </MdText>
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
          vatRate={product.vat_rate}
          disabled={unitPrice <= 0 || w <= 0 || h <= 0}
          addLabel="Do košíku"
          onAdd={handleAdd}
        />
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />

      {editorOpen && (
        <RectDesignEditor
          title={`Návrh — ${BANNER_MATERIAL_LABEL[material]}`}
          widthCm={previewCm.w}
          heightCm={previewCm.h}
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
