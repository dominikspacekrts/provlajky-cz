"use client";

// Konfigurátor plážové vlajky: 3D vlající náhled, tvar A–F (zavlní se při přepnutí),
// velikost, HS tunel s vysvětlivkou, editor vlastního návrhu a vložení do košíku.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import {
  FLAG_SHAPES,
  FLAG_SIZES,
  type FlagShape,
  type FlagSize,
  type OrderItemDesign,
  type Product,
} from "@/lib/types";
import {
  SHAPE_ASPECT,
  designPainter,
  drawFlagCanvas,
  flagPathD,
  type FlagDesign,
} from "@/lib/flagShapes";
import FlagWave from "./FlagWave";
import FlagEditorModal from "./FlagEditorModal";

function ShapeIcon({ shape, size = 44 }: { shape: FlagShape; size?: number }) {
  const h = 100;
  const w = Math.round(h * SHAPE_ASPECT[shape]);
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ height: size, width: "auto" }} aria-hidden="true">
      <path d={flagPathD(shape, w, h)} fill="currentColor" />
    </svg>
  );
}

export default function FlagConfigurator({ product }: { product: Product }) {
  const { addLine } = useCart();
  const router = useRouter();

  const [shape, setShape] = useState<FlagShape>("B");
  const [size, setSize] = useState<FlagSize>("M");
  const [hs, setHs] = useState(false);
  const [sleeveColor, setSleeveColor] = useState<"black" | "white">("black");
  const [qty, setQty] = useState(1);
  const [design, setDesign] = useState<FlagDesign | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [askNext, setAskNext] = useState(false);
  const thumbRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!design?.logoDataUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset odvozeného stavu při odebrání loga
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = design.logoDataUrl;
  }, [design?.logoDataUrl]);

  const drawDesign = useMemo(
    () => (design ? designPainter(design, logoImg) : undefined),
    [design, logoImg]
  );

  const unitPrice = useMemo(() => product.price_by_size?.[size] ?? 0, [product, size]);

  function makeThumb(): string | null {
    try {
      const full = drawFlagCanvas({
        shape,
        hs,
        sleeveColor,
        color: design?.bgColor ?? "#c9ccd1",
        drawDesign,
      });
      const t = thumbRef.current ?? document.createElement("canvas");
      thumbRef.current = t;
      const H = 440;
      t.height = H;
      t.width = Math.round((full.width / full.height) * H);
      const ctx = t.getContext("2d")!;
      ctx.fillStyle = "#f4f5f7";
      ctx.fillRect(0, 0, t.width, t.height);
      ctx.drawImage(full, 0, 0, t.width, t.height);
      return t.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  // Převod návrhu z editoru do formátu, který čte admin (order_items.design).
  function buildOrderDesign(thumb: string | null): OrderItemDesign | null {
    if (!design) return null;
    let logo: OrderItemDesign["logo"] = null;
    if (design.logoDataUrl && logoImg && logoImg.naturalWidth > 0) {
      const w = design.logoScale;
      const h = design.logoScale * SHAPE_ASPECT[shape] * (logoImg.naturalHeight / logoImg.naturalWidth);
      logo = {
        src: design.logoDataUrl,
        x: design.logoX - w / 2,
        y: design.logoY - h / 2,
        w,
        h,
        rotation: 0,
      };
    }
    return {
      bgColor: design.bgColor,
      sleeveColor: hs ? sleeveColor : undefined,
      logo,
      thumb,
      flagBounds: null,
      source: "eshop",
      eshop: { logoX: design.logoX, logoY: design.logoY, logoScale: design.logoScale, shape, hs },
    };
  }

  function handleAdd() {
    const noteParts = [hs ? `HS tunel (${sleeveColor === "black" ? "černý" : "bílý"})` : "standardní tunel"];
    if (design) noteParts.push(`vlastní návrh z editoru (pozadí ${design.bgColor})`);
    const thumb = makeThumb();
    addLine({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      type: "flag",
      shape,
      size,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb,
      note: noteParts.join(" · "),
      design: buildOrderDesign(thumb),
    });
    setAskNext(true);
  }

  return (
    <div className="configurator">
      <div className="config-stage">
        <FlagWave
          shape={shape}
          color={design ? design.bgColor : "#c9ccd1"}
          hs={hs}
          sleeveColor={sleeveColor}
          drawDesign={drawDesign}
          wind={0.3}
        />
        <span className="stage-hint">Najeďte myší — vlajka se rozvlaje</span>
      </div>

      <div>
        <h1 style={{ fontSize: 30 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        <div className="option-label">Tvar vlajky</div>
        <div className="shape-row">
          {FLAG_SHAPES.map((s) => (
            <button
              key={s}
              className={`shape-btn${shape === s ? " active" : ""}`}
              onClick={() => setShape(s)}
              aria-label={`Tvar ${s}`}
            >
              <ShapeIcon shape={s} />
              <span>{s}</span>
            </button>
          ))}
        </div>

        <div className="option-label">Velikost</div>
        <div className="option-row">
          {FLAG_SIZES.map((s) => (
            <button key={s} className={`option-chip${size === s ? " active" : ""}`} onClick={() => setSize(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="option-label">
          Provedení tunelu
          <span className="info-tip" tabIndex={0}>
            i
            <span className="info-pop" role="tooltip">
              HS znamená vyztužený tunel na tyč vlajky — vlajka drží tvar i za bezvětří. U typu HS vyrábíme
              tunel pouze v černé nebo bílé barvě.
            </span>
          </span>
        </div>
        <div className="option-row">
          <button className={`option-chip${!hs ? " active" : ""}`} onClick={() => setHs(false)}>
            Standardní
          </button>
          <button className={`option-chip${hs ? " active" : ""}`} onClick={() => setHs(true)}>
            HS — vyztužený
          </button>
        </div>
        {hs && (
          <div className="option-row" style={{ marginTop: 10 }}>
            {(["black", "white"] as const).map((c) => (
              <button key={c} className={`option-chip${sleeveColor === c ? " active" : ""}`} onClick={() => setSleeveColor(c)}>
                Tunel {c === "black" ? "černý" : "bílý"}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <button className="btn-outline btn-design" onClick={() => setEditorOpen(true)}>
            🎨 {design ? "Upravit vlastní návrh" : "Navrhnout vlastní vlajku"}
          </button>
          {design && (
            <button className="link-reset" onClick={() => setDesign(null)}>
              Odebrat návrh
            </button>
          )}
        </div>
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
          Návrh není podmínkou — pokud grafiku nenahrajete, připravíme vizualizaci po objednávce my a pošleme
          vám ji ke schválení.
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
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-yellow" disabled={unitPrice <= 0} onClick={handleAdd}>
            Přidat do košíku
          </button>
        </div>
        {unitPrice <= 0 && (
          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 10 }}>
            Pro tuto velikost zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
          </p>
        )}

        {product.description && (
          <p style={{ color: "var(--gray)", marginTop: 24, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description}
          </p>
        )}
      </div>

      {editorOpen && (
        <FlagEditorModal
          shape={shape}
          hs={hs}
          sleeveColor={sleeveColor}
          initial={design}
          onSleeveColor={setSleeveColor}
          onSave={(d) => {
            setDesign(d);
            setEditorOpen(false);
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {askNext && (
        <div className="editor-backdrop" onClick={() => setAskNext(false)}>
          <div className="ask-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="ask-check">✓</div>
            <h2>Přidáno do košíku</h2>
            <p>
              {product.name} · tvar {shape} · velikost {size}
              {hs ? ` · HS tunel ${sleeveColor === "black" ? "černý" : "bílý"}` : ""}
            </p>
            <div className="ask-actions">
              <button className="btn-yellow" onClick={() => router.push("/kosik")}>
                K pokladně
              </button>
              <button className="btn-outline" onClick={() => setAskNext(false)}>
                Pokračovat v nákupu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
