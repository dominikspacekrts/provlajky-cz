"use client";

/*
 * DIRECTION CONTRACT (homepage — dřív /nova, struktura podle apple.com)
 *
 * THESIS: Nabídka napřed, cesta k objednávce co nejkratší. Nahoře jedna
 *   letní akce, pod ní jedna věta, pak dva sloupce produktových panelů —
 *   žádný katalog, žádné zaoblené dlaždice s ikonou a šipkou.
 * OWN-WORLD: Značení u trati v drahém provedení. Nulové zaoblení, vláskové
 *   švy, hluboká čerň s jemným zrnem, papírová deska, Archivo s proměnnou
 *   šířkou. Signální žlutá #ffe701 je jediná barva akce.
 * STORY: Návštěvník vidí letní slevu, klikne na „Vyberte si svůj produkt",
 *   spadne do mřížky šesti panelů, z panelu jde rovnou do konfigurátoru.
 * FIRST VIEWPORT: Fotka z akce přes celou obrazovku, vlevo dole nadpis
 *   s letní slevou a primární tlačítko do produktů, u spodní hrany vstupní
 *   lišta se šesti rodinami.
 * FORM: Struktura připnutá uživatelem (apple.com/cz), vizuální svět
 *   motorsport/paddock. Postaveno z vlastních fotek a copy PROVLAJKY.
 *   ŽÁDNÁ tvrzení o původu zboží ani o vlastní výrobě — uživatel je
 *   výslovně označil za nepravdivá.
 * FINISH: unreviewed and undocumented is unfinished; this build ends
 *   with the finish review, the verdict, and DESIGN.md.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import NovaFields from "@/components/NovaFields";
import { NovaArrow, useInView } from "@/components/NovaReveal";
import CountUp from "@/components/CountUp";
import { SALE, saleBadge } from "@/lib/sale";

const HERO_PHOTOS = ["/fotky/foto-04.jpg", "/fotky/foto-01.jpg", "/fotky/foto-02.jpg", "/fotky/foto-03.jpg"];

const ENTRY = [
  { href: "/plazove-vlajky", label: "Plážové vlajky" },
  { href: "/vlajky-na-zakazku", label: "Vlajky na zakázku" },
  { href: "/pvc-bannery", label: "PVC bannery a meshe" },
  { href: "/nafukovaci-brany", label: "Nafukovací reklama" },
  { href: "/nuzkove-stany", label: "Nůžkové stany" },
  { href: "/nahradni-dily", label: "Příslušenství" },
];

const STEPS = [
  {
    n: "01",
    t: "Vyberte produkt",
    d: "Kliknete na kategorii a v konfigurátoru zvolíte tvar, rozměr a materiál. Cenu vidíte rovnou, bez poptávky.",
  },
  {
    n: "02",
    t: "Nahrajte logo",
    d: "Vlastní grafiku nahrajete přímo v editoru a hned vidíte, jak bude hotový produkt vypadat.",
  },
  {
    n: "03",
    t: "Objednejte",
    d: "Objednávku potvrdíte online. Doručujeme vlastní dopravou; u zboží dováženého vlakem počítejte s dodáním do 2 měsíců.",
  },
];

const SCORE = [
  { target: 3500, label: "vyrobených reklamních vlajek" },
  { target: 10000, label: "m² vyrobené reklamní plochy" },
  { target: 250, label: "spokojených zákazníků" },
];

export default function Home() {
  const [idx, setIdx] = useState(0);

  const lead = useInView<HTMLElement>();
  const how = useInView<HTMLElement>();
  const score = useInView<HTMLDivElement>(0.3);
  const call = useInView<HTMLDivElement>();

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_PHOTOS.length), 7500);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <section className="nv-hero">
        <div className="nv-hero-bg" aria-hidden="true">
          {HERO_PHOTOS.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className={`nv-hero-photo${i === idx ? " is-active" : ""}`}
              draggable={false}
              fetchPriority={i === 0 ? "high" : "low"}
            />
          ))}
          <div className="nv-hero-shade" />
          <div className="nv-grain" />
        </div>

        <div className="nv-hero-body">
          {SALE.active ? (
            <>
              <h1 className="nv-hero-title">
                <span className="nv-mask" style={{ "--d": "120ms" } as React.CSSProperties}>
                  <i>{SALE.title}</i>
                </span>
                <span className="nv-mask" style={{ "--d": "220ms" } as React.CSSProperties}>
                  <i>se slevou {SALE.percent} %.</i>
                </span>
              </h1>
              <p className="nv-hero-sub">
                <span>
                  Akce platí do {SALE.until}.
                  {SALE.code ? ` Kód ${SALE.code} zadáte v košíku.` : ""} Rozměr, tvar i vlastní grafiku si
                  nastavíte v konfigurátoru a cenu vidíte hned.
                </span>
              </p>
            </>
          ) : (
            <>
              <h1 className="nv-hero-title">
                <span className="nv-mask" style={{ "--d": "120ms" } as React.CSSProperties}>
                  <i>Vaše značka</i>
                </span>
                <span className="nv-mask" style={{ "--d": "220ms" } as React.CSSProperties}>
                  <i>na míru, bez papírování.</i>
                </span>
              </h1>
              <p className="nv-hero-sub">
                <span>
                  Vyberete rozměr, nahrajete logo a hned vidíte cenu i náhled. Objednávku potvrdíte na pár
                  kliknutí.
                </span>
              </p>
            </>
          )}
          <div className="nv-hero-actions">
            <a href="#produkty" className="nv-btn nv-btn-yellow nv-btn-lg">
              <span className="nv-btn-l">
                Vyberte si svůj produkt
                <NovaArrow />
              </span>
            </a>
          </div>
        </div>

        <nav className="nv-entry" aria-label="Produktové rodiny">
          {ENTRY.map((e) => (
            <Link key={e.href + e.label} href={e.href}>
              <span>{e.label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section ref={lead.ref} className={`nv-lead${lead.inView ? " nv-in" : ""}`}>
        <h2 className="nv-lead-title" data-reveal>
          Vyberte, nahrajte logo, hotovo.
        </h2>
        <p className="nv-lead-body" data-reveal style={{ "--rd": "120ms" } as React.CSSProperties}>
          Všechno si nakonfigurujete online — tvar, rozměr, materiál i vlastní grafiku. Cenu vidíte hned, žádná
          poptávka ani čekání na nabídku.
        </p>
      </section>

      <NovaFields saleBadge={saleBadge} saleId={SALE.tileId} />

      <section ref={how.ref} className={`nv-how${how.inView ? " nv-in" : ""}`}>
        <h2 className="nv-how-title" data-reveal>
          Objednání ve třech krocích
        </h2>
        <div className="nv-how-table">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="nv-how-row"
              data-reveal
              style={{ "--rd": `${100 + i * 110}ms` } as React.CSSProperties}
            >
              <div className="nv-how-n">{s.n}</div>
              <h3 className="nv-how-t">{s.t}</h3>
              <p className="nv-how-d">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tmavý závěr homepage — plynule navazuje na patičku v layoutu. */}
      <section className="nv-close nv-close-lead">
        <div className="nv-grain" aria-hidden="true" />

        <div ref={score.ref} className="nv-score">
          {SCORE.map((s) => (
            <div key={s.label} className="nv-score-item">
              <div className="nv-score-num">
                {score.inView ? <CountUp target={s.target} duration={1500} /> : <div className="num">&nbsp;</div>}
              </div>
              <div className="nv-score-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div ref={call.ref} className={`nv-call${call.inView ? " nv-in" : ""}`}>
          <h2 className="nv-call-title" data-reveal>
            Pojďme na to.
          </h2>
          <p className="nv-call-body" data-reveal style={{ "--rd": "110ms" } as React.CSSProperties}>
            Vyberte si produkt a nakonfigurujte si ho online, nebo zavolejte a projdeme rozměr i materiál spolu.
          </p>
          <div className="nv-call-actions" data-reveal style={{ "--rd": "200ms" } as React.CSSProperties}>
            <a href="#produkty" className="nv-btn nv-btn-yellow nv-btn-lg">
              <span className="nv-btn-l">
                Vyberte si svůj produkt
                <NovaArrow />
              </span>
            </a>
            <a href="mailto:info@provlajky.cz" className="nv-btn nv-btn-ghost nv-btn-lg">
              <span className="nv-btn-l">info@provlajky.cz</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
