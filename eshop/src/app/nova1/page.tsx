"use client";

/*
 * DIRECTION CONTRACT (/nova1 — replacement visual world, comp for review)
 *
 * THESIS: The product already IS a flag — this surface stops borrowing
 *   motorsport-adjacent photography and instead builds from the thing
 *   itself: international signal-flag geometry (solid field, stripe,
 *   cross, quarter, border, diagonal) structures the whole page, and the
 *   site's own real-time WebGL flag (FlagWave) is the hero's proof, not
 *   a decorative tile.
 * OWN-WORLD: navy ground, one signal red and one signal gold as full
 *   page-scale fields (Full palette, not restrained), Big Shoulders
 *   Stencil for every display line (stencil-cut, physical-signage
 *   lettering), Inter for body/UI. Every CTA is a pennant — a
 *   clip-path swallowtail, never a rectangle.
 * STORY: visitor sees a real flag ripple on load, reads the offer in
 *   one stencil line, picks a category by its signal pattern (not a
 *   product photo), lands in the same real configurator as today.
 * FIRST VIEWPORT: navy field split with a red pennant shape bottom-right;
 *   headline + dual pennant CTAs on the left, the live 3D flag stage on
 *   the right at full scale.
 * FORM: whole-world replacement, direction chosen directly from the
 *   design-scout research (motorsport/event energy, single committed
 *   accent, real product-in-action proof) at the user's request, no
 *   concept roll run this session — flagged and accepted by the user.
 * FINISH: unreviewed and undocumented is unfinished; this build ends
 *   with the finish review, the verdict, and DESIGN.md.
 */

import Link from "next/link";
import FlagWave from "@/components/FlagWave";
import CountUp from "@/components/CountUp";
import { useInView } from "@/components/NovaReveal";
import { PRODUCT_CATEGORIES } from "@/lib/types";

function Arrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.5 12h14M12.5 5.8l6.2 6.2-6.2 6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SIGNALS = [
  {
    id: "plazove-vlajky",
    title: "Plážové vlajky",
    href: "/plazove-vlajky",
    pattern: "n1-pat-diagonal",
    code: "A",
  },
  {
    id: "vlajky-na-zakazku",
    title: "Vlajky na zakázku",
    href: "/vlajky-na-zakazku",
    pattern: "n1-pat-solid-red",
    code: "B",
  },
  {
    id: "pvc-bannery",
    title: "PVC bannery a meshe",
    href: "/pvc-bannery",
    pattern: "n1-pat-stripe",
    code: "C",
  },
  {
    id: "nafukovaci",
    title: "Nafukovací reklama",
    href: "/nafukovaci-brany",
    pattern: "n1-pat-cross",
    code: "D",
  },
  {
    id: "nuzkove-stany",
    title: "Nůžkové stany",
    href: "/nuzkove-stany",
    pattern: "n1-pat-quarter",
    code: "E",
  },
  {
    id: "prislusenstvi",
    title: "Příslušenství a náhradní díly",
    href: "/nahradni-dily",
    pattern: "n1-pat-border",
    code: "F",
  },
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

export default function Nova1() {
  const code = useInView<HTMLElement>(0.08);
  const legend = useInView<HTMLElement>();
  const proof = useInView<HTMLDivElement>(0.3);
  const cta = useInView<HTMLDivElement>();

  return (
    <>
      <header className="n1-nav">
        <Link href="/nova1" className="n1-nav-logo" aria-label="PROVLAJKY.CZ — signální řada">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-bile.png" alt="PROVLAJKY.CZ" />
        </Link>
        <div className="n1-nav-right">
          <Link href="/" className="n1-nav-back">
            Aktuální provlajky.cz →
          </Link>
          <a href="#signaly" className="n1-btn n1-btn-gold">
            Vybrat produkt
            <Arrow className="n1-btn-arrow" />
          </a>
        </div>
      </header>

      <main>
        <section className="n1-hero">
          <div className="n1-hero-grain" aria-hidden="true" />

          <div className="n1-hero-body">
            <h1 className="n1-display n1-hero-title">
              Vaše barvy, <em>čitelné z dálky.</em>
            </h1>
            <p className="n1-hero-sub">
              Vyberete rozměr, nahrajete logo a hned vidíte cenu i náhled. Reklamní vlajky, bannery, nafukovací
              reklama a nůžkové stany na míru — objednávku potvrdíte na pár kliknutí.
            </p>
            <div className="n1-hero-actions">
              <a href="#signaly" className="n1-btn n1-btn-gold">
                Vybrat produkt
                <Arrow className="n1-btn-arrow" />
              </a>
              <a href="tel:+420605981155" className="n1-btn n1-btn-outline">
                +420 605 981 155
              </a>
            </div>
            <p className="n1-hero-proof">
              3&nbsp;500+ vyrobených vlajek · 10&nbsp;000+ m² reklamní plochy · 250+ zákazníků
            </p>
          </div>

          <div className="n1-hero-flag">
            <div className="n1-hero-flag-stage">
              <FlagWave
                shape="B"
                classic
                color="#ffbe0b"
                logoSrc="/logo/logo-tmave.png"
                logoPlate
                wind={0.22}
                interactive
              />
            </div>
            <span className="n1-hero-flag-hint">Živá vlajka — najeďte myší</span>
          </div>
        </section>

        <section
          id="signaly"
          ref={code.ref}
          className={`n1-code${code.inView ? " n1-in" : ""}`}
        >
          <div className="n1-code-head" data-reveal>
            <h2 className="n1-display n1-code-title">Šest rodin, šest signálů.</h2>
            <p className="n1-code-body">
              Každá kategorie má vlastní signální vzor, inspirovaný vlajkovou signalizací. Vyberte rodinu a
              rovnou se dostanete do konfigurátoru s tvarem, rozměrem i vlastní grafikou.
            </p>
          </div>

          <div className="n1-swatches">
            {SIGNALS.map((s, i) => (
              <Link
                key={s.id}
                href={s.href}
                className="n1-swatch"
                data-reveal
                style={{ "--rd": `${i * 70}ms` } as React.CSSProperties}
              >
                <span className={`n1-swatch-pattern ${s.pattern}`} aria-hidden="true" />
                <span className="n1-swatch-badge">{s.code}</span>
                <span className="n1-swatch-foot">
                  <span className="n1-swatch-t">{s.title}</span>
                  <span className="n1-swatch-n">
                    Vybrat
                    <Arrow className="n1-swatch-arrow" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section ref={legend.ref} className={`n1-legend${legend.inView ? " n1-in" : ""}`}>
          <h2 className="n1-display n1-legend-title" data-reveal>
            Objednání ve třech krocích.
          </h2>
          <div className="n1-legend-rows">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="n1-legend-row"
                data-reveal
                style={{ "--rd": `${100 + i * 100}ms` } as React.CSSProperties}
              >
                <div className="n1-legend-n">{s.n}</div>
                <h3 className="n1-legend-t">{s.t}</h3>
                <p className="n1-legend-d">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="n1-close">
          <div ref={proof.ref} className="n1-proof">
            {SCORE.map((s) => (
              <div key={s.label}>
                <div className="n1-proof-num">
                  {proof.inView ? <CountUp target={s.target} duration={1400} /> : <span>&nbsp;</span>}
                </div>
                <div className="n1-proof-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div ref={cta.ref} className={`n1-cta${cta.inView ? " n1-in" : ""}`}>
            <h2 className="n1-display n1-cta-title" data-reveal>
              Pojďme na to.
            </h2>
            <p className="n1-cta-body" data-reveal style={{ "--rd": "100ms" } as React.CSSProperties}>
              Vyberte si signál a nakonfigurujte si produkt online, nebo zavolejte a projdeme rozměr i materiál
              spolu.
            </p>
            <div className="n1-cta-actions" data-reveal style={{ "--rd": "190ms" } as React.CSSProperties}>
              <a href="#signaly" className="n1-btn n1-btn-gold">
                Vybrat produkt
                <Arrow className="n1-btn-arrow" />
              </a>
              <a href="mailto:info@provlajky.cz" className="n1-btn n1-btn-outline">
                info@provlajky.cz
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="n1-foot">
        <div className="n1-foot-grid">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo-bile.png" alt="PROVLAJKY.CZ" className="n1-foot-logo" />
            <p>
              <a href="tel:+420605981155">+420 605 981 155</a>
              <br />
              <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>
            </p>
            <p className="n1-foot-reg">
              ACTUAL PRO S.R.O.
              <br />
              nábřeží Míru 1055/82
              <br />
              737 01 Český Těšín
              <br />
              IČO 25882201 · DIČ CZ25882201
            </p>
          </div>
          <div>
            <h4>Nabízíme</h4>
            <ul>
              {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
                <li key={slug}>
                  <Link href={`/${slug}`}>{label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Důležité informace</h4>
            <ul>
              <li>
                <Link href="/obchodni-podminky">Obchodní podmínky</Link>
              </li>
              <li>
                <Link href="/ochrana-osobnich-udaju">Zásady ochrany osobních údajů</Link>
              </li>
              <li>
                <Link href="/kosik">Košík</Link>
              </li>
              <li>
                <Link href="/">Aktuální provlajky.cz</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="n1-bottom">© {new Date().getFullYear()} provlajky.cz — ACTUAL PRO S.R.O.</div>
      </footer>
    </>
  );
}
