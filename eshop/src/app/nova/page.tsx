"use client";

/*
 * DIRECTION CONTRACT (/nova — akční verze podle vzoru apple.com)
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
import { useCart } from "@/lib/cart";
import NovaFields from "@/components/NovaFields";
import { NovaArrow, useInView } from "@/components/NovaReveal";
import CountUp from "@/components/CountUp";

/* ---------------------------------------------------------------------
   LETNÍ AKCE — jediné místo, kde se akce nastavuje.
   `active: false` akci schová celou (pruh nahoře i nadpis v heru) a hero
   se vrátí k neutrálnímu nadpisu. Po 30. 9. 2026 stačí přepnout na false.
   `code` vyplň jen tehdy, když se sleva uplatňuje kódem v košíku;
   prázdný řetězec = sleva je už započítaná v ceně v konfigurátoru.
   --------------------------------------------------------------------- */
const SALE = {
  active: true,
  percent: 10,
  title: "Plážové vlajky",
  what: "plážové vlajky",
  until: "30. 9. 2026",
  href: "/plazove-vlajky",
  code: "",
};

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

/** Tlačítko s výplní, která při najetí vyjede zdola. */
function NovaBtn({
  href,
  tone,
  size,
  arrow,
  children,
  external,
}: {
  href: string;
  tone: "yellow" | "ghost";
  size?: "lg";
  arrow?: boolean;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls = `nv-btn nv-btn-${tone}${size === "lg" ? " nv-btn-lg" : ""}`;
  const inner = (
    <span className="nv-btn-l">
      {children}
      {arrow && <NovaArrow />}
    </span>
  );
  if (external) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export default function NovaHome() {
  const { count } = useCart();
  const [idx, setIdx] = useState(0);
  const [stuck, setStuck] = useState(false);

  const lead = useInView<HTMLElement>();
  const how = useInView<HTMLElement>();
  const score = useInView<HTMLDivElement>(0.3);
  const call = useInView<HTMLDivElement>();

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_PHOTOS.length), 7500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="nv">
      {/* Pruh s akcí úplně nahoře — odscrolluje pryč, nedrží se u kraje. */}
      {SALE.active && (
        <Link href={SALE.href} className="nv-promo">
          <span className="nv-promo-l">
            <b>Letní akce</b>
            <span>
              Sleva {SALE.percent} % na {SALE.what} — do {SALE.until}.
            </span>
            <NovaArrow />
          </span>
        </Link>
      )}

      <header className={`nv-nav${stuck ? " is-stuck" : ""}`}>
        <Link href="/nova" className="nv-logo" aria-label="PROVLAJKY.CZ">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-bile.png" alt="PROVLAJKY.CZ" />
        </Link>
        <div className="nv-nav-right">
          <a href="tel:+420605981155" className="nv-nav-phone">
            <span>+420 605 981 155</span>
          </a>
          <NovaBtn href="#produkty" tone="yellow" external>
            Vyberte si svůj produkt
          </NovaBtn>
          <Link href="/kosik" className="nv-nav-cart">
            <span className="nv-btn-l">
              Košík
              {count > 0 && <em className="nv-nav-count">{count}</em>}
            </span>
          </Link>
        </div>
      </header>

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
            <NovaBtn href="tel:+420605981155" tone="ghost" size="lg" external>
              +420 605 981 155
            </NovaBtn>
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

      <NovaFields saleBadge={SALE.active ? `−${SALE.percent} %` : null} saleId="plazove-vlajky" />

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

      <footer className="nv-close">
        <div className="nv-grain" />

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
            <NovaBtn href="tel:+420605981155" tone="ghost" size="lg" external>
              +420 605 981 155
            </NovaBtn>
            <NovaBtn href="mailto:info@provlajky.cz" tone="ghost" size="lg" external>
              info@provlajky.cz
            </NovaBtn>
          </div>
        </div>

        <div className="nv-colophon">
          <div>
            <h4>Kontaktní údaje</h4>
            <p>
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
              {ENTRY.map((e) => (
                <li key={e.href + e.label}>
                  <Link href={e.href}>{e.label}</Link>
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
            </ul>
          </div>
        </div>

        <div className="nv-bottom">© {new Date().getFullYear()} provlajky.cz — ACTUAL PRO S.R.O.</div>
      </footer>
    </div>
  );
}
