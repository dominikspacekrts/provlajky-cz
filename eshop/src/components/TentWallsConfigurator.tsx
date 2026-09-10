"use client";

// Nůžkový stan skládaný po stěnách: zákazník začíná se stanem jen se
// střechou a u každé ze 4 stran si přidá celou/poloviční stěnu a potisk.
//
// Desktop: vše najednou, zhuštěné řádky. Mobil: kroky
// Střecha → Přední+zadní → Boční → Shrnutí (bez scrollu stránky).

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import { TENT_PRODUCT_BLURB } from "@/lib/productCopy";
import type { Product, TentWallOption } from "@/lib/types";
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
import TentStage from "@/components/TentStage";
import { layersForWidth } from "@/lib/tentLayers";

type WallType = "half" | "full";
type Side = { type: WallType; double: boolean } | null;

type PositionKey = "front" | "back" | "left" | "right";
const POSITIONS: { key: PositionKey; label: string; short: string }[] = [
  { key: "front", label: "Přední stěna", short: "Přední" },
  { key: "back", label: "Zadní stěna", short: "Zadní" },
  { key: "left", label: "Levá boční stěna", short: "Levá" },
  { key: "right", label: "Pravá boční stěna", short: "Pravá" },
];

const MOBILE_STEPS = ["Střecha", "Přední a zadní", "Boční stěny", "Shrnutí"] as const;

function optionFor(cfg: NonNullable<Product["config"]>["tentWalls"], key: PositionKey) {
  if (!cfg) return null;
  return key === "left" || key === "right"
    ? { full: cfg.fullWallSide, half: cfg.halfWallSide }
    : { full: cfg.fullWallBack, half: cfg.halfWallBack };
}

function sidePrice(side: Side, opts: { full: TentWallOption; half: TentWallOption } | null, buy: boolean) {
  if (!side || !opts) return 0;
  const o = side.type === "full" ? opts.full : opts.half;
  if (buy) return side.double ? o.buyDouble : o.buySingle;
  return side.double ? o.sellDouble : o.sellSingle;
}

function PositionRow({
  label,
  side,
  onChange,
  price,
  compact,
}: {
  label: string;
  side: Side;
  onChange: (next: Side) => void;
  price: number;
  compact?: boolean;
}) {
  if (!side) {
    return (
      <div className={`fc-tent-row${compact ? " is-compact" : ""}`}>
        <span className="fc-tent-row-label">{label}</span>
        <div className="fc-tent-row-actions">
          <button className="option-chip" onClick={() => onChange({ type: "full", double: false })}>
            + Celá
          </button>
          <button className="option-chip" onClick={() => onChange({ type: "half", double: false })}>
            + Poloviční
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`fc-tent-row is-set${compact ? " is-compact" : ""}`}>
      <div className="fc-tent-row-top">
        <span className="fc-tent-row-label">
          {label} — {side.type === "full" ? "celá" : "poloviční"}
        </span>
        <div className="fc-tent-row-meta">
          <span className="fc-tent-row-price">+{fmtMoney(price)}</span>
          <button className="link-reset" onClick={() => onChange(null)} aria-label={`Odebrat ${label.toLowerCase()}`}>
            Odebrat
          </button>
        </div>
      </div>
      <div className="fc-tent-row-actions">
        {(
          [
            [false, "Jednostranný"],
            [true, "Oboustranný"],
          ] as const
        ).map(([double, text]) => (
          <button
            key={String(double)}
            className={`option-chip${side.double === double ? " active" : ""}`}
            onClick={() => onChange({ ...side, double })}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TentWallsConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();

  const cfg = product.config?.tentWalls;
  const [sides, setSides] = useState<Record<PositionKey, Side>>({ front: null, back: null, left: null, right: null });
  const [roofColor, setRoofColor] = useState<"black" | "white">("black");
  const [qty, setQty] = useState(1);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);
  const image = product.images?.[0];
  const layers = layersForWidth(cfg?.backWidthM);

  const priceByPosition = useMemo(() => {
    const out = {} as Record<PositionKey, number>;
    for (const p of POSITIONS) out[p.key] = sidePrice(sides[p.key], optionFor(cfg, p.key), false);
    return out;
  }, [cfg, sides]);

  const unitPrice = useMemo(() => {
    if (!cfg) return 0;
    return cfg.baseSell + POSITIONS.reduce((sum, p) => sum + priceByPosition[p.key], 0);
  }, [cfg, priceByPosition]);

  const wallsNote = useMemo(() => {
    const parts = POSITIONS.filter((p) => sides[p.key]).map((p) => {
      const s = sides[p.key]!;
      return `${p.label}: ${s.type === "full" ? "celá" : "poloviční"} (${s.double ? "oboustranný" : "jednostranný"})`;
    });
    return parts.length ? parts.join(" · ") : "jen střecha";
  }, [sides]);

  function handleAdd() {
    if (!cfg || unitPrice <= 0) return;
    const parts = POSITIONS.filter((p) => sides[p.key]).map((p) => {
      const s = sides[p.key]!;
      return `${p.label}: ${s.type === "full" ? "celá" : "poloviční"} (${s.double ? "oboustranný" : "jednostranný"} potisk)`;
    });
    const roofNote = `Střecha bez potisku, ${roofColor === "black" ? "černá" : "bílá"}`;
    const note = [roofNote, ...parts].join(" · ");
    addLine({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      type: "product",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: image || null,
      note,
    });
    setAskNext(true);
  }

  if (!cfg) {
    return (
      <div className="container">
        <div className="page-panel">
          <h1 style={{ fontSize: 30 }}>{product.name}</h1>
          <p style={{ color: "var(--gray)", marginTop: 12 }}>
            Konfigurace zatím není nastavená. Napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>{" "}
            a připravíme nabídku na míru.
          </p>
        </div>
      </div>
    );
  }

  const roofBlock = (
    <>
      <div className="option-label">Barva střechy (bez potisku)</div>
      <div className="option-row">
        {(["black", "white"] as const).map((c) => (
          <button
            key={c}
            className={`option-chip${roofColor === c ? " active" : ""}`}
            onClick={() => setRoofColor(c)}
          >
            {c === "black" ? "Černá" : "Bílá"}
          </button>
        ))}
      </div>
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
        Základní cena zahrnuje stan se střechou. Stěny přidáte v dalších krocích.
      </p>
    </>
  );

  const frontBackBlock = (
    <>
      <div className="option-label">Přední a zadní stěna</div>
      {POSITIONS.filter((p) => p.key === "front" || p.key === "back").map((p) => (
        <PositionRow
          key={p.key}
          label={isMobile ? p.short : p.label}
          side={sides[p.key]}
          price={priceByPosition[p.key]}
          compact
          onChange={(next) => setSides((cur) => ({ ...cur, [p.key]: next }))}
        />
      ))}
    </>
  );

  const sidesBlock = (
    <>
      <div className="option-label">Boční stěny</div>
      {POSITIONS.filter((p) => p.key === "left" || p.key === "right").map((p) => (
        <PositionRow
          key={p.key}
          label={isMobile ? p.short : p.label}
          side={sides[p.key]}
          price={priceByPosition[p.key]}
          compact
          onChange={(next) => setSides((cur) => ({ ...cur, [p.key]: next }))}
        />
      ))}
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
        Poloviční stěna už zahrnuje boční tyč, která ji drží.
      </p>
    </>
  );

  const summaryBlock = (
    <>
      <div className="option-label">Shrnutí</div>
      <ul className="fc-tent-summary">
        <li>
          Střecha: {roofColor === "black" ? "černá" : "bílá"} (bez potisku)
        </li>
        {POSITIONS.map((p) => {
          const s = sides[p.key];
          return (
            <li key={p.key}>
              {p.label}:{" "}
              {s
                ? `${s.type === "full" ? "celá" : "poloviční"}, ${s.double ? "oboustranný" : "jednostranný"} potisk (+${fmtMoney(
                    priceByPosition[p.key]
                  )})`
                : "bez stěny"}
            </li>
          );
        })}
      </ul>
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Cena zatím není nastavená — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  const desktopWalls = (
    <>
      <div className="option-label">Stěny</div>
      {POSITIONS.map((p) => (
        <PositionRow
          key={p.key}
          label={p.label}
          side={sides[p.key]}
          price={priceByPosition[p.key]}
          compact
          onChange={(next) => setSides((cur) => ({ ...cur, [p.key]: next }))}
        />
      ))}
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
        Poloviční stěna už zahrnuje boční tyč, která ji drží. Kombinovat lze libovolně.
      </p>
    </>
  );

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        <TentStage layers={layers} sides={sides} alt={product.name} />
        <FcContactLink />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          {isMobile ? (
            <>
              <FcStepHeader steps={MOBILE_STEPS} step={step} />
              <FcStepBody step={step}>
                {step === 0 && (
                  <>
                    {TENT_PRODUCT_BLURB["nuzkove-stany"] && (
                      <p className="fc-product-blurb">{TENT_PRODUCT_BLURB["nuzkove-stany"]}</p>
                    )}
                    {roofBlock}
                  </>
                )}
                {step === 1 && frontBackBlock}
                {step === 2 && sidesBlock}
                {step === 3 && summaryBlock}
              </FcStepBody>
            </>
          ) : (
            <>
              <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
              {TENT_PRODUCT_BLURB["nuzkove-stany"] && (
                <p className="fc-product-blurb">{TENT_PRODUCT_BLURB["nuzkove-stany"]}</p>
              )}
              {roofBlock}
              {desktopWalls}
              {unitPrice <= 0 && (
                <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
                  Cena zatím není nastavená — napište nám na info@provlajky.cz.
                </p>
              )}
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
        summary={`${product.name} · střecha ${roofColor === "black" ? "černá" : "bílá"} · ${wallsNote}`}
      />
    </div>
  );
}
