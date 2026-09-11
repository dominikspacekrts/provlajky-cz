"use client";

// Konfigurátor „Vlajky na zakázku": typ (státní / vlastní grafika), materiál
// za m², rozměr, oka, a u vlastní grafiky obdélníkový editor jako u plážových.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { customFlagPrice } from "@/lib/money";
import type { Product, FlagMaterial } from "@/lib/types";
import { COUNTRIES, flagSrc, type Country } from "@/lib/countries";
import {
  EYELET_TYPES,
  EYELET_PLACEMENTS,
  FLAG_PACKAGING_NOTE,
  type EyeletPlacement,
} from "@/lib/flagOptions";
import { makeRectThumb, type RectDesign } from "@/lib/rectDesign";
import FlagWave from "./FlagWave";
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

type FlagType = "state" | "custom";

const MOBILE_STEPS = ["Typ, materiál, rozměr", "Oka", "Návrh / země"] as const;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function CustomFlagConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();

  const cfg = product.config?.customFlag;
  const materials = useMemo<FlagMaterial[]>(() => cfg?.materials ?? [], [cfg]);
  const surcharge = cfg?.eyeletSurchargePct ?? 20;
  const maxDimState = cfg?.maxDimState ?? 300;
  const maxDimCustom = cfg?.maxDimCustom ?? 200;

  const [flagType, setFlagType] = useState<FlagType>("custom");
  const [materialId, setMaterialId] = useState<string>(materials[0]?.id ?? "");
  const material = materials.find((m) => m.id === materialId) ?? materials[0];

  const [country, setCountry] = useState<Country | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);

  const [design, setDesign] = useState<RectDesign | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const [w, setW] = useState(100);
  const [h, setH] = useState(100);
  const [eyeletType, setEyeletType] = useState<string>(EYELET_TYPES[0].id);
  const [placements, setPlacements] = useState<Set<EyeletPlacement>>(new Set(["left"]));
  const [dense, setDense] = useState(false);
  const [qty, setQty] = useState(1);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);

  const maxDim = flagType === "state" ? maxDimState : maxDimCustom;
  const unitPrice = useMemo(
    () => customFlagPrice(material, w, h, dense, surcharge),
    [material, w, h, dense, surcharge]
  );

  const filteredCountries = useMemo(() => {
    const q = norm(countryQuery.trim());
    const list = q ? COUNTRIES.filter((c) => norm(c.name).includes(q)) : COUNTRIES;
    return list.slice(0, 60);
  }, [countryQuery]);

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

  const designThumb = useMemo(() => {
    if (flagType !== "custom" || !design || design.logoIsPdf) return null;
    return makeRectThumb(design, logoImg, w, h);
  }, [flagType, design, logoImg, w, h]);

  const flagImageSrc =
    flagType === "state" ? (country ? flagSrc(country.code) : null) : designThumb;

  const eyeletLabel = EYELET_TYPES.find((e) => e.id === eyeletType)?.label ?? "";

  function togglePlacement(p: EyeletPlacement) {
    setPlacements((prev) => {
      if (p === "all") return prev.has("all") ? new Set() : new Set(["all"]);
      const next = new Set(prev);
      next.delete("all");
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function selectCountry(c: Country) {
    setCountry(c);
    setCountryQuery(c.name);
    setCountryOpen(false);
  }

  const placementText = () => {
    if (placements.has("all")) return "všechny strany";
    const labels = EYELET_PLACEMENTS.filter((p) => placements.has(p.id)).map((p) => p.label.toLowerCase());
    return labels.length ? labels.join(", ") : "neuvedeno";
  };

  function handleAdd() {
    if (unitPrice <= 0 || !material) return;
    if (flagType === "custom" && !design?.logoDataUrl) return;
    const subject =
      flagType === "state"
        ? country
          ? `Státní vlajka – ${country.name}`
          : "Státní vlajka"
        : design
        ? "Vlastní grafika z editoru"
        : "Vlastní grafika";
    const note = `${subject} · ${material.label} · ${w}×${h} cm · oka: ${eyeletLabel} (${placementText()})${
      dense ? ` · hustší oka +${surcharge}%` : ""
    }`;
    const thumb =
      flagType === "state"
        ? country
          ? flagSrc(country.code)
          : null
        : makeRectThumb(design!, logoImg, w, h);
    addLine({
      productId: product.id,
      productSlug: product.slug,
      productCategory: product.category,
      name: product.name,
      type: "flag",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb,
      note,
      widthCm: w,
      heightCm: h,
      material: material?.id ?? null,
      design:
        flagType === "custom" && design
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

  const typeMaterialSizeBlock = (
    <>
      <div className="option-label">Typ vlajky</div>
      <div className="option-row">
        <button className={`option-chip${flagType === "state" ? " active" : ""}`} onClick={() => setFlagType("state")}>
          Státní vlajka
        </button>
        <button
          className={`option-chip${flagType === "custom" ? " active" : ""}`}
          onClick={() => setFlagType("custom")}
        >
          Vlastní grafika
        </button>
      </div>

      {materials.length > 0 && (
        <>
          <div className="option-label">Materiál</div>
          <div className="option-row">
            {materials.map((m) => (
              <button
                key={m.id}
                className={`option-chip${materialId === m.id ? " active" : ""}`}
                onClick={() => setMaterialId(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="option-label">Rozměr vlajky</div>
      <div className="banner-dim-row">
        <label>
          Šířka (cm)
          <input
            type="number"
            min={10}
            max={maxDim}
            value={w}
            onChange={(e) => setW(Math.min(maxDim, Math.max(0, Number(e.target.value) || 0)))}
          />
        </label>
        <span className="banner-dim-x">×</span>
        <label>
          Výška (cm)
          <input
            type="number"
            min={10}
            max={maxDim}
            value={h}
            onChange={(e) => setH(Math.min(maxDim, Math.max(0, Number(e.target.value) || 0)))}
          />
        </label>
        <div className="banner-area">{((w / 100) * (h / 100)).toFixed(2)} m²</div>
      </div>
      <p className="editor-note">Maximálně {maxDim} cm.</p>
    </>
  );

  const eyeletsBlock = (
    <>
      <div className="option-label">Typ oček</div>
      <div className="option-row">
        {EYELET_TYPES.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`option-chip${eyeletType === e.id ? " active" : ""}`}
            onClick={() => setEyeletType(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="option-label">Umístění oček</div>
      <div className="placement-box">
        {EYELET_PLACEMENTS.map((p) => (
          <label key={p.id} className="placement-line">
            <input type="checkbox" checked={placements.has(p.id)} onChange={() => togglePlacement(p.id)} />
            {p.label}
          </label>
        ))}
      </div>
      <p className="editor-note">Můžete vybrat více možností najednou.</p>

      <div className="flag-packaging-note">{FLAG_PACKAGING_NOTE}</div>

      <label className="cb-line" style={{ marginTop: 14 }}>
        <input type="checkbox" checked={dense} onChange={(e) => setDense(e.target.checked)} />
        Upevňovací oka každých 30 cm: +{surcharge} %
      </label>
    </>
  );

  const graphicsBlock = (
    <>
      {flagType === "state" ? (
        <>
          <div className="option-label">Vyberte stát</div>
          <div className="country-picker">
            <div className="country-input">
              {country && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flagSrc(country.code)} alt="" className="country-flag-mini" />
              )}
              <input
                type="text"
                placeholder="Začněte psát název státu…"
                value={countryQuery}
                onChange={(e) => {
                  setCountryQuery(e.target.value);
                  setCountryOpen(true);
                  if (country) setCountry(null);
                }}
                onFocus={() => setCountryOpen(true)}
                onBlur={() => setTimeout(() => setCountryOpen(false), 150)}
              />
            </div>
            {countryOpen && filteredCountries.length > 0 && (
              <ul className="country-list">
                {filteredCountries.map((c) => (
                  <li key={c.code}>
                    <button type="button" onMouseDown={() => selectCountry(c)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={flagSrc(c.code)} alt="" className="country-flag-mini" />
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: isMobile ? 0 : 4 }}>
            <button
              className={`btn-outline btn-design${design ? "" : " btn-design-required"}`}
              onClick={() => setEditorOpen(true)}
            >
              <PenMark className="btn-mark" />
              {design ? "Upravit vlastní návrh" : "Navrhnout vlastní vlajku"}
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
              : "Povinný krok — nahrajte logo nebo celoplošnou grafiku. Barvu pozadí řešte jen když ji potřebujete."}
          </p>
        </>
      )}
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Cena za m² pro tento materiál zatím není nastavená — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  const canAdd =
    unitPrice > 0 && (flagType === "state" || Boolean(design?.logoDataUrl));

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        {flagType === "state" ? (
          <FlagWave
            shape="B"
            classic
            color="#e5e7eb"
            flagImageSrc={flagImageSrc}
            wind={0.28}
          />
        ) : (
          <div
            className="banner-preview"
            style={{ aspectRatio: `${Math.max(w, 1)} / ${Math.max(h, 1)}` }}
          >
            {designThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={designThumb} alt="Náhled vlajky" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : design?.logoIsPdf ? (
              <span className="banner-preview-hint">PDF nahráno</span>
            ) : (
              <span className="banner-preview-hint">Navrhněte vlastní vlajku</span>
            )}
            <span className="banner-preview-dims">
              {w} × {h} cm
            </span>
          </div>
        )}
        <FcContactLink />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          {isMobile ? (
            <>
              <FcStepHeader steps={MOBILE_STEPS} step={step} />
              <FcStepBody step={step}>
                {step === 0 && typeMaterialSizeBlock}
                {step === 1 && eyeletsBlock}
                {step === 2 && graphicsBlock}
              </FcStepBody>
            </>
          ) : (
            <>
              <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
              {typeMaterialSizeBlock}
              {graphicsBlock}
              {eyeletsBlock}
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
          disabled={!canAdd}
          addLabel="Do košíku"
          onAdd={handleAdd}
        />
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />

      {editorOpen && (
        <RectDesignEditor
          title="Navrhněte si vlastní vlajku"
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
        summary={`${product.name} · ${w}×${h} cm · ${material?.label ?? ""}`}
      />
    </div>
  );
}
