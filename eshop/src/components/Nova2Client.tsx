"use client";

/*
 * Homepage (`/`) — jednoduchý hero: nadpis "Vyberte, nahrajte logo,
 * hotovo." + text vpravo, pod tím tři ostré dlaždice pro hlavní produktové
 * rodiny (stejný vzor .group-tile jako na /stany — jen fotka + titulek +
 * CTA), čísla a hned za nimi galerie referencí (HomeReferences), která
 * nahradila statické fotky "Vlajky v akci". Zbytek stránky (NovaFields
 * mřížka, jak-na-to kroky, registrace, závěrečná výzva) je beze změny.
 */

import Link from "next/link";
import HomeReferences from "@/components/HomeReferences";
import NovaFields from "@/components/NovaFields";
import { NovaArrow, useInView } from "@/components/NovaReveal";
import RegisterForm from "@/components/RegisterForm";
import type { ProductCategory } from "@/lib/types";

// Tři hlavní produktové rodiny — ostré vstupní dlaždice hned pod herem.
// Všechny tři používají studiové produktové snímky na světlém pozadí, aby
// řada držela jednotný vzhled. Dlaždice "stany" je šikmá kombinace nůžkového
// a nafukovacího stanu (skládá se lokálně, viz public/stany).
const HOME_GROUPS = [
  {
    id: "vlajky",
    title: "Plážové vlajky",
    href: "/plazove-vlajky",
    note: "Šest tvarů, potisk na míru, cenu vidíte hned v konfigurátoru.",
    img: "/produkty/plazova-vlajka-sirka.jpg",
  },
  {
    id: "bannery",
    title: "Bannery a meshe",
    href: "/pvc-bannery",
    note: "PVC i mesh, cena za m², oka po obvodu.",
    img: "/produkty/mesh-banner.jpg",
  },
  {
    id: "stany",
    title: "Stany HEX a AIR",
    href: "/stany",
    note: "Hliníková hexagonová i nafukovací konstrukce s potiskem na míru.",
    img: "/stany/nuzkovy-nafukovaci.jpg",
  },
] as const;

// Čísla jsou orientační odhad (skutečná produkce se v adminu nesleduje) —
// až budou přesná čísla, stačí je tu přepsat.
const STATS = [
  { num: "2500+", label: "vyrobených plážových vlajek" },
  { num: "600+", label: "vytištěných bannerů a meshů" },
  { num: "180+", label: "postavených stanů" },
] as const;

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

export default function Nova2Client({
  salePctByCategory,
}: {
  salePctByCategory: Partial<Record<ProductCategory, number>>;
}) {
  const lead = useInView<HTMLElement>();
  const how = useInView<HTMLElement>();
  const register = useInView<HTMLElement>();
  const call = useInView<HTMLDivElement>();

  return (
    <>
      <section ref={lead.ref} className={`nv-lead${lead.inView ? " nv-in" : ""}`}>
        <h1 className="nv-lead-title" data-reveal>
          Vyberte, nahrajte logo, hotovo.
        </h1>
        <p className="nv-lead-body" data-reveal style={{ "--rd": "120ms" } as React.CSSProperties}>
          Všechno si nakonfigurujete online — tvar, rozměr, materiál i vlastní grafiku. Cenu vidíte hned, žádná
          poptávka ani čekání na nabídku.
        </p>
      </section>

      <section className="nv-groups">
        <div className="nv-groups-grid reveal-stagger">
          {HOME_GROUPS.map((g) => (
            <Link key={g.id} href={g.href} className="group-tile">
              <div className="group-tile-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.img}
                  alt={g.title}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <div className="group-tile-body">
                <div className="group-tile-title">{g.title}</div>
                <p className="group-tile-note">{g.note}</p>
                <span className="group-tile-cta">
                  Zobrazit
                  <NovaArrow className="nv-arrow" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="nv-stats">
        <div className="nv-stats-grid reveal-stagger">
          {STATS.map((s) => (
            <div key={s.label} className="nv-stats-item">
              <div className="nv-stats-num">{s.num}</div>
              <div className="nv-stats-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <HomeReferences />

      <NovaFields salePctByCategory={salePctByCategory} />

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
