"use client";

/*
 * DIRECTION CONTRACT (/nova2 — refinement of the committed homepage `/`)
 *
 * THESIS: Keep the incumbent world (paddock signage, deep black, signal
 *   yellow, Archivo, liquid-glass buttons) exactly as it is, but replace
 *   the single full-bleed photo hero with three asymmetric fractured
 *   panels — one per major product family — each a direct, credible
 *   entry point: real photo, real starting price from Supabase, one
 *   click to the category. No more single CTA + a 6-column nav strip
 *   underneath it; the hero itself IS the navigation.
 * OWN-WORLD: unchanged palette/type/motion/components (Header, Footer,
 *   NovaFields, liquid-glass .nv-btn) — only the hero region is new.
 * STORY: visitor lands, sees three real product scenes split by
 *   diagonal "crack" seams, each labelled with its family and a real
 *   "od X Kč" price, picks one, lands in that category/config flow.
 * FIRST VIEWPORT: full-bleed hero split into 3 trapezoid shards
 *   (asymmetric: middle "Nafukovací a nůžkové stany" widest), each a
 *   full-height clickable link with its own photo + shade + label.
 * FORM: extension of the incumbent world per user's explicit direction
 *   ("zachovej vizuál původní hero stránky") — no concept roll, no new
 *   type/color system introduced.
 * FINISH: unreviewed and undocumented is unfinished; this build ends
 *   with the finish review, the verdict, and DESIGN.md.
 */

import Link from "next/link";
import NovaFields from "@/components/NovaFields";
import { NovaArrow, useInView } from "@/components/NovaReveal";
import RegisterForm from "@/components/RegisterForm";
import { SALE, saleBadge } from "@/lib/sale";
import { HERO_GROUPS } from "@/lib/heroGroups";
import { fmtMoney } from "@/lib/money";
import type { ProductCategory } from "@/lib/types";

// Reálná čísla za rodinu — jedno na dlaždici (viz PRODUCT.md, potvrzeno uživatelem).
const HERO_STATS: Record<string, string> = {
  vlajky: "300+ dodaných plážových vlajek",
  stany: "60+ nůžkových a nafukovacích stanů",
  bannery: "1300+ m² reklamní plochy",
};

// foto-01/foto-02 se používají jako fotky dlaždic v NovaFields níž na téže stránce —
// tady jen ty dvě, co se jinde neopakují, ať se galerie nekryje se stejnými snímky.
const GALLERY_PHOTOS = ["/fotky/foto-03.jpg", "/fotky/foto-04.jpg"];

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

export default function Nova2Client({ prices }: { prices: Record<string, number | null> }) {
  const lead = useInView<HTMLElement>();
  const gallery = useInView<HTMLElement>();
  const how = useInView<HTMLElement>();
  const register = useInView<HTMLElement>();
  const call = useInView<HTMLDivElement>();

  return (
    <>
      <section className="nv-hero3" aria-label="Hlavní produktové rodiny">
        <div className="nv-grain" aria-hidden="true" />
        {/* Tlusté černé švy — šev A přes celou výšku (58 %→8 %, strmější
            úhel než dřív, prostřední panel má víc místa), šev B jen od
            průsečíku s A dolů (42,2 %/31,5 % → 82 %/100 %); nad
            průsečíkem leží šev B pod panelem 0, takže tam není vidět a
            nekreslí se. Clip-path sám o sobě žádnou hranici nekreslí,
            takže se kreslí samostatně jako overlay nad fotkami. */}
        <svg className="nv-hero3-seams" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="58,0 8,100" />
          <polyline points="42.24,31.52 82,100" />
        </svg>
        {HERO_GROUPS.map((g, i) => {
          const price = prices[g.id];
          const showSaleBadge =
            SALE.active && !!SALE.tileId && g.categories.includes(SALE.tileId as ProductCategory);
          return (
            <Link key={g.id} href={g.href} className={`nv-shard nv-shard-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.image} alt="" className="nv-shard-photo" draggable={false} loading={i === 0 ? "eager" : "lazy"} />
              <span className="nv-shard-shade" aria-hidden="true" />
              <span className="nv-shard-body">
                {showSaleBadge && <span className="nv-shard-badge">−{SALE.percent} %</span>}
                <span className="nv-shard-title">{g.title}</span>
                <span className="nv-shard-price">
                  {price != null ? (
                    <>
                      od {fmtMoney(price)} <em>bez DPH</em>
                    </>
                  ) : (
                    "cena na dotaz"
                  )}
                </span>
                {HERO_STATS[g.id] && <span className="nv-shard-stat">{HERO_STATS[g.id]}</span>}
                <span className="nv-shard-cta">
                  Konfigurovat
                  <NovaArrow className="nv-arrow" />
                </span>
              </span>
            </Link>
          );
        })}
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

      <section ref={gallery.ref} className={`nv-gallery${gallery.inView ? " nv-in" : ""}`}>
        <div className="nv-gallery-head" data-reveal>
          <span className="nv-gallery-kicker">Vlajky v akci</span>
          <p className="nv-gallery-note">
            Fotky přímo z akcí, kam jsme vlajky dodali — Zápal to!, Race the Streets a Dolní Vítkovice.
          </p>
        </div>
        <div className="nv-gallery-grid">
          {GALLERY_PHOTOS.map((src, i) => (
            <div
              key={src}
              className="nv-gallery-item"
              data-reveal
              style={{ "--rd": `${i * 90}ms` } as React.CSSProperties}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Vlajky PROVLAJKY.CZ nasazené na motoristické akci" loading="lazy" />
            </div>
          ))}
        </div>
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

      <section id="registrace" ref={register.ref} className={`nv-register${register.inView ? " nv-in" : ""}`}>
        <div className="nv-register-copy">
          <h2 className="nv-register-title" data-reveal>
            Zaregistrujte se a získejte 10 % slevu.
          </h2>
          <p className="nv-register-body" data-reveal style={{ "--rd": "110ms" } as React.CSSProperties}>
            Kód na první objednávku vám pošleme e-mailem.
          </p>
        </div>
        <RegisterForm />
      </section>

      {/* Tmavý závěr homepage — plynule navazuje na patičku v layoutu. */}
      <section className="nv-close nv-close-lead">
        <div className="nv-grain" aria-hidden="true" />

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
            <a href="tel:+420605981155" className="nv-btn nv-btn-ghost nv-btn-lg">
              <span className="nv-btn-l">+420 605 981 155</span>
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
