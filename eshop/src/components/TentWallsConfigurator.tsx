"use client";

// Nůžkový stan skládaný po částech: zákazník začíná se stanem jen se
// střechou a přidává si zadní stěnu + obě boční stěny — každou zvlášť
// jako bez stěny / poloviční / celá, s volbou jednostranného nebo
// oboustranného potisku. Cena se přepočítává živě podle výběru.
//
// Náhled (TentGraphic) je zatím jen orientační přiblížení — umí ukázat
// celkovou úroveň "bez stěn / poloviční / celé" a jednostranný/oboustranný
// potisk, ne přesně tuhle kombinaci po jednotlivých stranách. Přesný obrázek
// podle konkrétní konfigurace se doladí později (Viewmax generování).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import type { Product, TentWallOption } from "@/lib/types";
import { CheckMark } from "@/components/Icons";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import TentGraphic from "@/components/TentGraphic";

type WallType = "none" | "half" | "full";
type Side = { type: WallType; double: boolean };
const noSide: Side = { type: "none", double: false };

function sidePrice(side: Side, opts: { full: TentWallOption; half: TentWallOption }, buy: boolean) {
  if (side.type === "none") return 0;
  const o = side.type === "full" ? opts.full : opts.half;
  if (buy) return side.double ? o.buyDouble : o.buySingle;
  return side.double ? o.sellDouble : o.sellSingle;
}

function SideEditor({
  label,
  side,
  onChange,
}: {
  label: string;
  side: Side;
  onChange: (next: Side) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div className="option-label">{label}</div>
      <div className="option-row">
        {(
          [
            ["none", "Bez stěny"],
            ["half", "Poloviční stěna"],
            ["full", "Celá stěna"],
          ] as const
        ).map(([type, text]) => (
          <button
            key={type}
            className={`option-chip${side.type === type ? " active" : ""}`}
            onClick={() => onChange({ ...side, type })}
          >
            {text}
          </button>
        ))}
      </div>
      {side.type !== "none" && (
        <div className="option-row" style={{ paddingTop: 0 }}>
          {(
            [
              [false, "Jednostranný potisk"],
              [true, "Oboustranný potisk"],
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

export default function TentWallsConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const router = useRouter();

  const cfg = product.config?.tentWalls;
  const [back, setBack] = useState<Side>(noSide);
  const [left, setLeft] = useState<Side>(noSide);
  const [right, setRight] = useState<Side>(noSide);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const unitPrice = useMemo(() => {
    if (!cfg) return 0;
    const backOpts = { full: cfg.fullWallBack, half: cfg.halfWallBack };
    const sideOpts = { full: cfg.fullWallSide, half: cfg.halfWallSide };
    return (
      cfg.baseSell +
      sidePrice(back, backOpts, false) +
      sidePrice(left, sideOpts, false) +
      sidePrice(right, sideOpts, false)
    );
  }, [cfg, back, left, right]);

  // Přiblížení pro náhled — TentGraphic umí jen jednu společnou úroveň
  // stěn pro celý stan, ne po stranách zvlášť.
  const anyFull = back.type === "full" || left.type === "full" || right.type === "full";
  const anyWall = anyFull || back.type === "half" || left.type === "half" || right.type === "half";
  const anyDouble = (back.type !== "none" && back.double) || (left.type !== "none" && left.double) || (right.type !== "none" && right.double);
  const previewWalls = anyFull ? "full" : anyWall ? "half" : "none";

  function describe(name: string, side: Side) {
    if (side.type === "none") return null;
    const typeLabel = side.type === "full" ? "celá" : "poloviční";
    return `${name}: ${typeLabel} (${side.double ? "oboustranný" : "jednostranný"} potisk)`;
  }

  function handleAdd() {
    if (!cfg || unitPrice <= 0) return;
    const parts = [describe("Zadní stěna", back), describe("Levá boční stěna", left), describe("Pravá boční stěna", right)].filter(
      (v): v is string => Boolean(v)
    );
    const note = parts.length ? parts.join(" · ") : "Jen střecha, bez stěn";
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
      thumb: product.images?.[0] || null,
      note,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
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

  return (
    <div className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}`}>
      <div className="fc-stage">
        <TentGraphic size={product.name} walls={previewWalls} printSides={anyDouble ? "double" : "single"} className="config-preview-flag" />
      </div>

      <aside className="fc-panel reveal-stagger">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" className="config-hero-logo" style={{ marginBottom: 22 }} />

        <h1 style={{ fontSize: 28 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        <SideEditor label="Zadní stěna" side={back} onChange={setBack} />
        <SideEditor label="Levá boční stěna" side={left} onChange={setLeft} />
        <SideEditor label="Pravá boční stěna" side={right} onChange={setRight} />
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
          Přední strana zůstává otevřená jako vstup. Poloviční stěna už zahrnuje boční tyč, která ji drží.
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

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-yellow" disabled={unitPrice <= 0} onClick={handleAdd}>
            {added ? (<><CheckMark className="btn-mark" /> Přidáno</>) : ("Vložit do košíku")}
          </button>
          <button className="btn-outline" onClick={() => router.push("/kosik")}>
            Přejít do košíku
          </button>
        </div>
        {unitPrice <= 0 && (
          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 10 }}>
            Cena zatím není nastavená — napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>.
          </p>
        )}

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
