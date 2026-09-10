"use client";

// Konfigurátor plážové vlajky: 3D vlající náhled, tvar A–F (zavlní se při přepnutí),
// velikost, HS tunel s vysvětlivkou, editor vlastního návrhu a vložení do košíku.
//
// Na mobilu je obrazovka rozdělená na půl: nahoře vlající vlajka jako na
// desktopu, dole panel s jedním krokem po druhém (tvar a velikost → tunel →
// vlastní grafika) a úplně na spodku pořád viditelná cena, počet kusů a
// tlačítko do košíku. Na širokém displeji zůstává všechno pod sebou v jednom
// panelu — kroky by tam jen přidávaly kliky.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCart } from "@/lib/cart";
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
import { CheckMark, PenMark } from "@/components/Icons";
import { useMediaQuery } from "@/lib/useMediaQuery";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import CtaBar from "@/components/CtaBar";

// FlagWave táhne celé three.js jen kvůli animaci vlání — na první vykreslení
// stránky to nepotřebujeme, takže jde do vlastního JS chunku a načte se až
// po hlavním obsahu (žádané zrychlení načtení). Do doby, než dorazí, stojí
// místo ní tichý obrys tvaru (viz ShapeIcon níž), který pak plynule
// prokřížfaduje do živé 3D plachty.
const FlagWave = dynamic(() => import("./FlagWave"), { ssr: false });
const FlagEditorModal = dynamic(() => import("./FlagEditorModal"), { ssr: false });

// Mobilní kroky: jeden krok = jedno rozhodnutí, náhled a cena zůstávají vidět.
const MOBILE_STEPS = ["Tvar a velikost", "Tunel na tyč", "Vlastní grafika"] as const;

function ShapeIcon({ shape, size = 44 }: { shape: FlagShape; size?: number }) {
  const h = 100;
  const w = Math.round(h * SHAPE_ASPECT[shape]);
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} style={{ height: size, width: "auto" }} aria-hidden="true">
      <path d={flagPathD(shape, w, h)} fill="currentColor" />
    </svg>
  );
}

export default function FlagConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
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

  const isMobile = useMediaQuery("(max-width: 860px)");
  const [step, setStep] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);

  // Výšku krokového layoutu měříme, ne počítáme: nad konfigurátorem sedí
  // lišta a někdy i promo pruh a jejich výška se na mobilu liší podle toho,
  // na kolik řádků se text zalomí. Odhad přes CSS proměnné dostal spodní
  // lištu s cenou pod spodní hranu displeje.
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (!isMobile) {
      el.style.removeProperty("height");
      return;
    }
    const fit = () => {
      // Měříme jen s nescrollovanou stránkou: rect.top je vůči viewportu,
      // takže odscrollovaná stránka by výšku nafoukla.
      if (window.scrollY > 4) return;
      const top = el.getBoundingClientRect().top;
      const next = Math.max(480, Math.round(window.innerHeight - top - 8));
      if (Math.abs(parseFloat(el.style.height || "0") - next) > 1) el.style.height = `${next}px`;
      // Lišta s galerií realizací (viz .fc-gallery v CSS) sedí přes roh
      // náhledu vlajky a nesmí přerůst jeho skutečnou výšku — ta se ale
      // odvíjí od zlomku téhle měřené výšky (grid-template-rows), takže ji
      // dopočítáme až tady a dáme configurátoru k dispozici jako proměnnou.
      const stage = el.querySelector<HTMLElement>(".fc-stage");
      if (stage) el.style.setProperty("--fc-stage-h", `${Math.round(stage.getBoundingClientRect().height)}px`);
    };
    fit();
    // Lišta a promo pruh nad konfigurátorem se dorovnávají až po mountu
    // (promo čeká na sessionStorage), takže první měření bývá o jejich
    // výšku vedle — přeměříme, jakmile se cokoli nad tím pohne.
    const raf = requestAnimationFrame(fit);
    // Promo pruh naskakuje i dorůstá (zalomení textu po načtení fontu) až
    // nějakou dobu po mountu, a ResizeObserver na to nestačí — přeměříme
    // ještě několikrát po sobě, než se stránka ustálí.
    const timers = [80, 300, 900, 1800].map((ms) => window.setTimeout(fit, ms));
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    for (const sel of [".nv-nav", ".nv-promo"]) {
      const bar = document.querySelector(sel);
      if (bar) ro.observe(bar);
    }
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.addEventListener("load", fit);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.removeEventListener("load", fit);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!design?.logoDataUrl || design.logoIsPdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset odvozeného stavu při odebrání loga / PDF bez náhledu
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = design.logoDataUrl;
  }, [design?.logoDataUrl, design?.logoIsPdf]);

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
    if (design.logoDataUrl && design.logoIsPdf) {
      // PDF nemá živě dopočítaný rozměr (logoImg neexistuje) — přiložíme ho s výchozí
      // polohou, admin/výroba umístění doladí ručně podle přiloženého PDF.
      const w = design.logoScale;
      const h = design.logoScale;
      logo = {
        src: design.logoDataUrl,
        x: design.logoX - w / 2,
        y: design.logoY - h / 2,
        w,
        h,
        rotation: design.logoRotation || 0,
      };
    } else if (design.logoDataUrl && logoImg && logoImg.naturalWidth > 0) {
      const w = design.logoScale;
      const h = design.logoScale * SHAPE_ASPECT[shape] * (logoImg.naturalHeight / logoImg.naturalWidth);
      logo = {
        src: design.logoDataUrl,
        x: design.logoX - w / 2,
        y: design.logoY - h / 2,
        w,
        h,
        rotation: design.logoRotation || 0,
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
    if (design?.logoIsPdf) noteParts.push("PDF logo — umístění doladíme ručně");
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

  const shapeAndSizeBlock = (
    <>
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
      <div className="option-row option-row-nowrap">
        {FLAG_SIZES.map((s) => (
          <button key={s} className={`option-chip${size === s ? " active" : ""}`} onClick={() => setSize(s)}>
            {s}
          </button>
        ))}
      </div>
    </>
  );

  const sleeveBlock = (
    <>
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
    </>
  );

  const designBlock = (
    <>
      <div style={{ marginTop: 14 }}>
        <button className={`btn-outline btn-design${design ? "" : " btn-design-required"}`} onClick={() => setEditorOpen(true)}>
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
          : "Povinný krok — zadejte barvu podkladu a nahrajte logo, ať víme, jak má vlajka vypadat."}
      </p>
    </>
  );

  const hintsBlock = (
    <>
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Pro tuto velikost zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
        </p>
      )}
      {unitPrice > 0 && !design?.logoDataUrl && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Nejdřív navrhněte vlajku (barva podkladu + logo) — pak půjde přidat do košíku.
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
        <div className="fc-stage-shape" aria-hidden="true">
          <ShapeIcon shape={shape} size={220} />
        </div>
        <FlagWave
          shape={shape}
          color={design ? design.bgColor : "#c9ccd1"}
          hs={hs}
          sleeveColor={sleeveColor}
          drawDesign={drawDesign}
          wind={0.3}
        />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          {isMobile ? (
            <>
              <div className="fc-step-head">
                <span className="fc-step-name">{MOBILE_STEPS[step]}</span>
                <span className="fc-step-count">
                  Krok {step + 1} ze {MOBILE_STEPS.length}
                </span>
              </div>
              <div className="fc-step-bar" aria-hidden="true">
                {MOBILE_STEPS.map((s, i) => (
                  <i key={s} className={i <= step ? "is-done" : undefined} />
                ))}
              </div>
              {/* key na kroku → nový uzel → krok dojede zprava, ať je poznat pohyb vpřed */}
              <div className="fc-step" key={step}>
                {step === 0 && shapeAndSizeBlock}
                {step === 1 && sleeveBlock}
                {step === 2 && (
                  <>
                    {designBlock}
                    {unitPrice <= 0 && (
                      <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 10 }}>
                        Pro tuto velikost zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" className="config-hero-logo" style={{ marginBottom: 14 }} />

              <h1 style={{ fontSize: 23 }}>{product.name}</h1>
              {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 4, fontSize: 13.5 }}>{product.subtitle}</p>}

              {shapeAndSizeBlock}
              {sleeveBlock}
              {designBlock}
              {hintsBlock}

              {product.description && (
                <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {product.description}
                </p>
              )}
            </>
          )}
        </div>

        {isMobile && step < MOBILE_STEPS.length - 1 && (
          <div className="fc-step-nav">
            {step > 0 ? (
              <button type="button" className="fc-step-back" onClick={() => setStep(step - 1)}>
                Zpět
              </button>
            ) : (
              <span />
            )}
            <button type="button" className="btn-yellow" onClick={() => setStep(step + 1)}>
              Pokračovat
            </button>
          </div>
        )}
        {isMobile && step === MOBILE_STEPS.length - 1 && (
          <div className="fc-step-nav">
            <button type="button" className="fc-step-back" onClick={() => setStep(step - 1)}>
              Zpět
            </button>
          </div>
        )}

        <CtaBar
          qty={qty}
          onQtyChange={setQty}
          unitPrice={unitPrice}
          disabled={unitPrice <= 0 || !design?.logoDataUrl}
          // Lišta drží cenu, počet kusů i tlačítko v jednom řádku — kratší
          // popisek se tam vejde na desktopu stejně jako na mobilu.
          addLabel="Do košíku"
          onAdd={handleAdd}
        />
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />

      {editorOpen && (
        <FlagEditorModal
          shape={shape}
          hs={hs}
          sleeveColor={sleeveColor}
          initial={design}
          onSleeveColor={setSleeveColor}
          onSave={(d) => setDesign(d)}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {askNext && (
        <div className="editor-backdrop" onClick={() => setAskNext(false)}>
          <div className="ask-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="ask-check"><CheckMark /></div>
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
