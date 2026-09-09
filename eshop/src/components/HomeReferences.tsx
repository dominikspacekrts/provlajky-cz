"use client";

/*
 * Galerie referencí na homepage — nahradila statickou dvojici fotek
 * ("Vlajky v akci"). Jeden slide = fotka z akce + citace zákazníka, jehož
 * vlajky jsou na té fotce vidět. Posouvá se sám po 20 sekundách zprava
 * doleva; kdo chce, přepíná jménem firmy, šipkami nebo tahem prstem.
 *
 * POZOR — TEXTY CITACÍ JSOU NÁVRH, NE PŘEPIS SKUTEČNÉ RECENZE.
 * Firmy na fotkách jsou reální zákazníci, ale slova jsou vymyšlená jako
 * placeholder. Než tohle půjde na produkci, musí každý zákazník svoji
 * citaci potvrdit (fabrikovaná recenze = nekalá obchodní praktika,
 * § 4 a příloha 1 zákona o ochraně spotřebitele). Až přijdou skutečná
 * znění, stačí přepsat `quote`, `person` a `role` níž.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useInView } from "@/components/NovaReveal";

const AUTOPLAY_MS = 20000;

type Reference = {
  id: string;
  company: string;
  role: string;
  person: string;
  quote: string;
  photo: string;
  alt: string;
};

const REFERENCES: Reference[] = [
  {
    id: "rts",
    company: "Race the Streets",
    role: "Městské drift show",
    person: "Pořadatelský tým",
    quote:
      "Vlajky lemují celou trať a stojí venku od pátku do neděle, i když fouká. Po sezoně jsme nemuseli dokupovat ani jednu novou.",
    photo: "/fotky/foto-04.jpg",
    alt: "Řada plážových vlajek Race the Streets a Zápal to! nad divácky obsazenou tratí městské drift show",
  },
  {
    id: "zapal-to",
    company: "Zápal to! Crew",
    role: "Motoristické akce",
    person: "Produkce akcí",
    quote:
      "Grafiku jsme nahráli v editoru a hned viděli, jak bude vlajka vypadat. Nemuseli jsme čekat na nabídku ani na náhled od grafika.",
    photo: "/fotky/foto-02.jpg",
    alt: "Žlutá plážová vlajka Zápal to! Crew mezi dalšími vlajkami u okruhu, na trati projíždí safety car",
  },
  {
    id: "aretacni-pripravky",
    company: "Aretační přípravky",
    role: "aretacni-pripravky.cz",
    person: "Marketing",
    quote:
      "Objednávali jsme podruhé a barvy sedí přesně na první sérii. Přesně to jsme u potisku řešili nejvíc.",
    photo: "/fotky/foto-01.jpg",
    alt: "Bílé plážové vlajky aretacni-pripravky.cz nasvícené během večerní drift show",
  },
  {
    id: "pame-ostrava",
    company: "PAME-Ostrava s.r.o.",
    role: "Odtahová služba 24/7",
    person: "Vedení firmy",
    quote:
      "Rozměr jsme vybrali v konfigurátoru a cenu viděli okamžitě. Vlajky s námi jezdí na akce a stojí celý den bez hlídání.",
    photo: "/fotky/foto-03.jpg",
    alt: "Vlajka PAME-Ostrava v řadě reklamních vlajek u okruhu vedle nafukovací startovní brány",
  },
];

export default function HomeReferences() {
  const section = useInView<HTMLElement>();
  const [index, setIndex] = useState(0);
  // Autoposun běží, jen když na sekci nikdo nesahá a je vidět — jinak by
  // uživateli utekl slide zrovna při čtení.
  const [paused, setPaused] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const count = REFERENCES.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || !section.inView) return;
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, section.inView, count]);

  // Skrytá záložka: časovač by odtikal na pozadí a po návratu by stránka
  // skočila o několik slidů dál.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    dragStart.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Vodorovný tah delší než 44 px a zřetelně vodorovnější než svislý —
    // jinak jde o scrollování stránky, ne o přepnutí reference.
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    go(index + (dx < 0 ? 1 : -1));
  }

  const active = REFERENCES[index];

  return (
    <section
      ref={section.ref}
      className={`nv-refs${section.inView ? " nv-in" : ""}`}
      aria-roledescription="carousel"
      aria-label="Reference zákazníků"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      <div className="nv-refs-head" data-reveal>
        <h2 className="nv-refs-title">Stojí u trati, na okruhu i před provozovnou.</h2>
        <div className="nv-refs-nav">
          <button type="button" className="nv-refs-arrow" onClick={() => go(index - 1)} aria-label="Předchozí reference">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19.5 12h-14M11.5 5.8 5.3 12l6.2 6.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="nv-refs-count" aria-hidden="true">
            {String(index + 1).padStart(2, "0")} <i>/</i> {String(count).padStart(2, "0")}
          </span>
          <button type="button" className="nv-refs-arrow" onClick={() => go(index + 1)} aria-label="Další reference">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M4.5 12h14M12.5 5.8l6.2 6.2-6.2 6.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="nv-refs-window" data-reveal style={{ "--rd": "120ms" } as React.CSSProperties}>
        <div
          className="nv-refs-track"
          style={{ "--i": index } as React.CSSProperties}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (dragStart.current = null)}
        >
          {REFERENCES.map((r, i) => (
            <article
              key={r.id}
              className="nv-refs-slide"
              aria-roledescription="snímek"
              aria-label={`${i + 1} z ${count}: ${r.company}`}
              aria-hidden={i === index ? undefined : true}
            >
              <div className="nv-refs-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photo} alt={r.alt} loading={i === 0 ? "eager" : "lazy"} draggable={false} />
              </div>
              <div className="nv-refs-copy">
                <blockquote className="nv-refs-quote">{r.quote}</blockquote>
                <div className="nv-refs-by">
                  <span className="nv-refs-company">{r.company}</span>
                  <span className="nv-refs-role">
                    {r.person} — {r.role}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="nv-refs-tabs" role="tablist" aria-label="Vyberte referenci">
        {REFERENCES.map((r, i) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            id={`ref-tab-${r.id}`}
            aria-selected={i === index}
            tabIndex={i === index ? 0 : -1}
            className={`nv-refs-tab${i === index ? " is-active" : ""}`}
            onClick={() => go(i)}
          >
            <span>{r.company}</span>
            {i === index && (
              <i
                key={`${r.id}-${index}`}
                className={`nv-refs-progress${paused || !section.inView ? " is-paused" : ""}`}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </div>

      <p className="nv-refs-live" aria-live="polite">
        {active.company}: {active.quote}
      </p>
    </section>
  );
}
