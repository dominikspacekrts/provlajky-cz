"use client";

/*
 * Homepage (`/`) — jednoduchý hero: nadpis "Vyberte, nahrajte logo,
 * hotovo." + text vpravo, pod tím reálné fotky z akcí ("Vlajky v akci"),
 * a hned pod tím tři ostré dlaždice pro hlavní produktové rodiny (stejný
 * vzor .group-tile jako na /stany — žádné diagonální švy, jen fotka +
 * titulek + CTA). Zbytek stránky (NovaFields mřížka, jak-na-to kroky,
 * registrace, závěrečná výzva) je beze změny.
 */

import Link from "next/link";
import NovaFields from "@/components/NovaFields";
import { NovaArrow, useInView } from "@/components/NovaReveal";
import RegisterForm from "@/components/RegisterForm";
import type { ProductCategory } from "@/lib/types";

// Tři hlavní produktové rodiny — ostré vstupní dlaždice hned pod herem.
const HOME_GROUPS = [
  {
    id: "vlajky",
    title: "Plážové vlajky",
    href: "/plazove-vlajky",
    note: "Šest tvarů, potisk na míru, cenu vidíte hned v konfigurátoru.",
    img: "/hero/plazove-vlajky.jpg",
  },
  {
    id: "bannery",
    title: "Bannery a meshe",
    href: "/pvc-bannery",
    note: "PVC i mesh, cena za m², oka po obvodu.",
    img: "/hero/bannery.jpg",
  },
  {
    id: "stany",
    title: "Nůžkové a nafukovací stany",
    href: "/stany",
    note: "Skládací i nafukovací konstrukce s potiskem na míru.",
    img: "/hero/nafukovaci-stan.jpg",
  },
] as const;

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

export default function Nova2Client({
  salePctByCategory,
}: {
  salePctByCategory: Partial<Record<ProductCategory, number>>;
}) {
  const lead = useInView<HTMLElement>();
  const gallery = useInView<HTMLElement>();
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
