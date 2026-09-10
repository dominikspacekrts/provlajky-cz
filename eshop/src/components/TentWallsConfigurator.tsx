"use client";

// Nůžkový stan skládaný po stěnách.
// Na začátku: s potiskem / bez potisku. Bez potisku → skladová barva látky.
// Volitelně barvení rámu (+ cena z adminu, výchozí 1000/2000).

import { useMemo, useState } from "react";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import { TENT_PRODUCT_BLURB } from "@/lib/productCopy";
import {
  DEFAULT_FRAME_COLOR_BUY,
  DEFAULT_FRAME_COLOR_SELL,
  TENT_FABRIC_COLORS,
  TENT_FRAME_COLORS,
} from "@/lib/tentColors";
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
type PrintMode = "printed" | "stock";

type PositionKey = "front" | "back" | "left" | "right";
const POSITIONS: { key: PositionKey; label: string; short: string }[] = [
  { key: "front", label: "Přední stěna", short: "Přední" },
  { key: "back", label: "Zadní stěna", short: "Zadní" },
  { key: "left", label: "Levá boční stěna", short: "Levá" },
  { key: "right", label: "Pravá boční stěna", short: "Pravá" },
];

const MOBILE_STEPS = ["Potisk a barvy", "Přední a zadní", "Boční stěny", "Shrnutí"] as const;

function optionFor(cfg: NonNullable<Product["config"]>["tentWalls"], key: PositionKey) {
  if (!cfg) return null;
  return key === "left" || key === "right"
    ? { full: cfg.fullWallSide, half: cfg.halfWallSide }
    : { full: cfg.fullWallBack, half: cfg.halfWallBack };
}

function sidePrice(side: Side, opts: { full: TentWallOption; half: TentWallOption } | null, buy: boolean) {
  if (!side || !opts) return 0;
  const o = side.type === "full" ? opts.full : opts.half;
  // Bez potisku účtujeme jednostrannou / skladovou cenu stěny.
  if (buy) return side.double ? o.buyDouble : o.buySingle;
  return side.double ? o.sellDouble : o.sellSingle;
}

function PositionRow({
  label,
  side,
  onChange,
  price,
  compact,
  stockMode,
}: {
  label: string;
  side: Side;
  onChange: (next: Side) => void;
  price: number;
  compact?: boolean;
  stockMode?: boolean;
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
          {stockMode ? " (bez potisku)" : ""}
        </span>
        <div className="fc-tent-row-meta">
          <span className="fc-tent-row-price">+{fmtMoney(price)}</span>
          <button className="link-reset" onClick={() => onChange(null)} aria-label={`Odebrat ${label.toLowerCase()}`}>
            Odebrat
          </button>
        </div>
      </div>
      {!stockMode && (
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
      )}
    </div>
  );
}

function ColorSwatches({
  colors,
  value,
  onChange,
}: {
  colors: { id: string; label: string; hex: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="fc-color-swatches" role="listbox" aria-label="Výběr barvy">
      {colors.map((c) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={value === c.id}
          className={`fc-color-swatch${value === c.id ? " active" : ""}`}
          style={{ background: c.hex }}
          title={c.label}
          onClick={() => onChange(c.id)}
        >
          <span className="fc-color-swatch-label">{c.label}</span>
        </button>
      ))}
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
  const [printMode, setPrintMode] = useState<PrintMode>("printed");
  const [fabricColorId, setFabricColorId] = useState(TENT_FABRIC_COLORS[0].id);
  const [roofColor, setRoofColor] = useState<"black" | "white">("black");
  const [framePainted, setFramePainted] = useState(false);
  const [frameColorId, setFrameColorId] = useState(TENT_FRAME_COLORS[0].id);
  const [sides, setSides] = useState<Record<PositionKey, Side>>({ front: null, back: null, left: null, right: null });
  const [qty, setQty] = useState(1);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);
  const image = product.images?.[0];
  const layers = layersForWidth(cfg?.backWidthM);

  const frameBuy = cfg?.frameColorBuy ?? DEFAULT_FRAME_COLOR_BUY;
  const frameSell = cfg?.frameColorSell ?? DEFAULT_FRAME_COLOR_SELL;
  const stockBaseSell = (cfg?.stockBaseSell ?? 0) > 0 ? cfg!.stockBaseSell! : cfg?.baseSell ?? 0;
  const baseSell = printMode === "stock" ? stockBaseSell : cfg?.baseSell ?? 0;

  const priceByPosition = useMemo(() => {
    const out = {} as Record<PositionKey, number>;
    for (const p of POSITIONS) {
      const side = sides[p.key];
      // Bez potisku vždy single cena.
      const priced = side && printMode === "stock" ? { ...side, double: false } : side;
      out[p.key] = sidePrice(priced, optionFor(cfg, p.key), false);
    }
    return out;
  }, [cfg, sides, printMode]);

  const unitPrice = useMemo(() => {
    if (!cfg) return 0;
    const walls = POSITIONS.reduce((sum, p) => sum + priceByPosition[p.key], 0);
    return baseSell + walls + (framePainted ? frameSell : 0);
  }, [cfg, priceByPosition, baseSell, framePainted, frameSell]);

  const fabricColor = TENT_FABRIC_COLORS.find((c) => c.id === fabricColorId) ?? TENT_FABRIC_COLORS[0];
  const frameColor = TENT_FRAME_COLORS.find((c) => c.id === frameColorId) ?? TENT_FRAME_COLORS[0];

  function setPrintModeSafe(next: PrintMode) {
    setPrintMode(next);
    if (next === "stock") {
      setSides((cur) => {
        const out = { ...cur };
        for (const k of Object.keys(out) as PositionKey[]) {
          if (out[k]) out[k] = { ...out[k]!, double: false };
        }
        return out;
      });
    }
  }

  const wallsNote = useMemo(() => {
    const parts = POSITIONS.filter((p) => sides[p.key]).map((p) => {
      const s = sides[p.key]!;
      return `${p.short}: ${s.type === "full" ? "celá" : "poloviční"}`;
    });
    return parts.length ? parts.join(", ") : "jen střecha";
  }, [sides]);

  function handleAdd() {
    if (!cfg || unitPrice <= 0) return;
    const parts = POSITIONS.filter((p) => sides[p.key]).map((p) => {
      const s = sides[p.key]!;
      if (printMode === "stock") {
        return `${p.label}: ${s.type === "full" ? "celá" : "poloviční"} bez potisku`;
      }
      return `${p.label}: ${s.type === "full" ? "celá" : "poloviční"} (${s.double ? "oboustranný" : "jednostranný"} potisk)`;
    });
    const modeNote =
      printMode === "stock"
        ? `Bez potisku, látka ${fabricColor.label}`
        : `S potiskem · střecha ${roofColor === "black" ? "černá" : "bílá"} (bez potisku)`;
    const frameNote = framePainted ? `Rám barvený ${frameColor.label}` : "Rám standardní";
    const note = [modeNote, frameNote, ...parts].join(" · ");
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

  const printAndColorsBlock = (
    <>
      <div className="option-label">Provedení</div>
      <div className="option-row">
        <button className={`option-chip${printMode === "printed" ? " active" : ""}`} onClick={() => setPrintModeSafe("printed")}>
          S potiskem
        </button>
        <button className={`option-chip${printMode === "stock" ? " active" : ""}`} onClick={() => setPrintModeSafe("stock")}>
          Bez potisku
        </button>
      </div>

      {printMode === "stock" ? (
        <>
          <div className="option-label">Barva látky (střecha a stěny)</div>
          <ColorSwatches colors={TENT_FABRIC_COLORS} value={fabricColorId} onChange={setFabricColorId} />
          <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
            Skladové barvy oxfordové látky 600D — bez celoplošného potisku.
          </p>
        </>
      ) : (
        <>
          <div className="option-label">Barva střechy (bez potisku)</div>
          <div className="option-row">
            {(["black", "white"] as const).map((c) => (
              <button key={c} className={`option-chip${roofColor === c ? " active" : ""}`} onClick={() => setRoofColor(c)}>
                {c === "black" ? "Černá" : "Bílá"}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
            Potisk přijde na stěny / střechu podle vaší grafiky. Barvu látky tady řešit nemusíte.
          </p>
        </>
      )}

      <div className="option-label" style={{ marginTop: 12 }}>
        Barvení rámu
      </div>
      <div className="option-row">
        <button className={`option-chip${!framePainted ? " active" : ""}`} onClick={() => setFramePainted(false)}>
          Standardní
        </button>
        <button className={`option-chip${framePainted ? " active" : ""}`} onClick={() => setFramePainted(true)}>
          Barevný rám · +{fmtMoney(frameSell)}
        </button>
      </div>
      {framePainted && (
        <>
          <ColorSwatches colors={TENT_FRAME_COLORS} value={frameColorId} onChange={setFrameColorId} />
          <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>
            Lakování nohou / rámu do zvolené skladové barvy.
          </p>
        </>
      )}
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
          stockMode={printMode === "stock"}
          onChange={(next) =>
            setSides((cur) => ({
              ...cur,
              [p.key]: next && printMode === "stock" ? { ...next, double: false } : next,
            }))
          }
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
          stockMode={printMode === "stock"}
          onChange={(next) =>
            setSides((cur) => ({
              ...cur,
              [p.key]: next && printMode === "stock" ? { ...next, double: false } : next,
            }))
          }
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
          {printMode === "stock"
            ? `Bez potisku · látka ${fabricColor.label}`
            : `S potiskem · střecha ${roofColor === "black" ? "černá" : "bílá"}`}
        </li>
        <li>{framePainted ? `Rám barvený ${frameColor.label} (+${fmtMoney(frameSell)})` : "Rám standardní"}</li>
        {POSITIONS.map((p) => {
          const s = sides[p.key];
          return (
            <li key={p.key}>
              {p.label}:{" "}
              {s
                ? printMode === "stock"
                  ? `${s.type === "full" ? "celá" : "poloviční"} bez potisku (+${fmtMoney(priceByPosition[p.key])})`
                  : `${s.type === "full" ? "celá" : "poloviční"}, ${s.double ? "oboustranný" : "jednostranný"} potisk (+${fmtMoney(
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
          stockMode={printMode === "stock"}
          onChange={(next) =>
            setSides((cur) => ({
              ...cur,
              [p.key]: next && printMode === "stock" ? { ...next, double: false } : next,
            }))
          }
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
                    {printAndColorsBlock}
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
              {printAndColorsBlock}
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
        summary={`${product.name} · ${printMode === "stock" ? "bez potisku" : "s potiskem"} · ${wallsNote}`}
      />
    </div>
  );
}
