"use client";

// Nůžkový stan skládaný po stěnách: zákazník začíná se stanem jen se
// střechou a u každé ze 4 stran (přední/zadní/levá boční/pravá boční) si
// zvlášť přidá "celou stěnu" nebo "poloviční stěnu" (tlačítkem), u přidané
// stěny zvolí jednostranný/oboustranný potisk a jde ji zase smazat (×).
// Cena se u každého řádku i celkem počítá živě.
//
// Přední a zadní stěna mají stejnou šířku (podle velikosti stanu — cfg.backWidthM),
// boční stěny jsou vždy 3 m (hloubka je u všech velikostí stejná).
//
// Foto je zatím jen statická produktová fotka — přesný obrázek podle
// konkrétní kombinace stěn se doladí později přes Viewmax (moc kombinací
// na to, aby šly předgenerovat všechny najednou).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import type { Product, TentWallOption } from "@/lib/types";
import { CheckMark, FlagMark } from "@/components/Icons";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";

type WallType = "half" | "full";
type Side = { type: WallType; double: boolean } | null;

type PositionKey = "front" | "back" | "left" | "right";
const POSITIONS: { key: PositionKey; label: string }[] = [
  { key: "front", label: "Přední stěna" },
  { key: "back", label: "Zadní stěna" },
  { key: "left", label: "Levá boční stěna" },
  { key: "right", label: "Pravá boční stěna" },
];

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
}: {
  label: string;
  side: Side;
  onChange: (next: Side) => void;
  price: number;
}) {
  if (!side) {
    return (
      <div className="option-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="option-chip" onClick={() => onChange({ type: "full", double: false })}>
            + Celá stěna
          </button>
          <button className="option-chip" onClick={() => onChange({ type: "half", double: false })}>
            + Poloviční stěna
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="option-row" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {label} — {side.type === "full" ? "celá stěna" : "poloviční stěna"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--gray)" }}>+{fmtMoney(price)}</span>
          <button className="link-reset" onClick={() => onChange(null)} aria-label={`Odebrat ${label.toLowerCase()}`}>
            ✕
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
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
  const [sides, setSides] = useState<Record<PositionKey, Side>>({ front: null, back: null, left: null, right: null });
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const image = product.images?.[0];

  const priceByPosition = useMemo(() => {
    const out = {} as Record<PositionKey, number>;
    for (const p of POSITIONS) out[p.key] = sidePrice(sides[p.key], optionFor(cfg, p.key), false);
    return out;
  }, [cfg, sides]);

  const unitPrice = useMemo(() => {
    if (!cfg) return 0;
    return cfg.baseSell + POSITIONS.reduce((sum, p) => sum + priceByPosition[p.key], 0);
  }, [cfg, priceByPosition]);

  function handleAdd() {
    if (!cfg || unitPrice <= 0) return;
    const parts = POSITIONS.filter((p) => sides[p.key]).map((p) => {
      const s = sides[p.key]!;
      return `${p.label}: ${s.type === "full" ? "celá" : "poloviční"} (${s.double ? "oboustranný" : "jednostranný"} potisk)`;
    });
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
      thumb: image || null,
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
        {image ? (
          <Image
            src={image}
            alt={product.name}
            width={640}
            height={480}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            unoptimized
          />
        ) : (
          <FlagMark className="thumb-empty" />
        )}
      </div>

      <aside className="fc-panel reveal-stagger">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" className="config-hero-logo" style={{ marginBottom: 22 }} />

        <h1 style={{ fontSize: 28 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        <div className="option-label">Stěny</div>
        {POSITIONS.map((p) => (
          <PositionRow
            key={p.key}
            label={p.label}
            side={sides[p.key]}
            price={priceByPosition[p.key]}
            onChange={(next) => setSides((cur) => ({ ...cur, [p.key]: next }))}
          />
        ))}
        <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
          Poloviční stěna už zahrnuje boční tyč, která ji drží. Kombinovat lze libovolně.
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
