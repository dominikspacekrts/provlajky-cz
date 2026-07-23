"use client";

// Alternativní homepage inspirovaná airdome.com — samostatná routa (/nova),
// hlavní "/" zůstává beze změny. Prvky převzaté z airdome:
//  - fixní logo lišta nahoře + tenký "trust" pruh úplně navrchu,
//  - velký nadpis ve stylu "Maximum Brand Visibility. Zero Setup Crew." (česky, jinak),
//  - reference značek (W8 LEX AUTO, Race the Streets, FPOWER…),
//  - dlaždice kategorií (zmenšené) a statistiky dole.

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import NovaCatalog from "@/components/NovaCatalog";
import CountUp from "@/components/CountUp";

const HERO_PHOTOS = [
  "/fotky/foto-01.jpg",
  "/fotky/foto-02.jpg",
  "/fotky/foto-03.jpg",
  "/fotky/foto-04.jpg",
];

const TRUST = [
  "Vše navrhnete online",
  "Materiály do každého počasí",
  "Vlastní potisk na míru",
  "Postaví to jeden člověk",
];

export default function NovaHome() {
  const { count } = useCart();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_PHOTOS.length), 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="lp">
      {/* Tenký trust pruh úplně nahoře (jako airdome) */}
      <div className="lp-topstrip">
        <div className="lp-topstrip-inner">
          {TRUST.map((t) => (
            <span key={t} className="lp-trust-item">
              <span className="lp-check" aria-hidden="true">✓</span>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Fixní logo lišta */}
      <header className="lp-header">
        <Link href="/nova" className="lp-logo" aria-label="PROVLAJKY.CZ">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" />
        </Link>
        <nav className="lp-nav">
          <a href="tel:+420605981155" className="lp-phone">
            +420 605 981 155
          </a>
          <Link href="/plazove-vlajky" className="lp-cta">
            Navrhnout vlajku
          </Link>
          <Link href="/kosik" className="lp-cart">
            Košík
            {count > 0 && <span className="lp-cart-count">{count}</span>}
          </Link>
        </nav>
      </header>

      {/* Hero s fotkou realizace + hlavní claim */}
      <section className="lp-hero">
        <div className="lp-hero-bg" aria-hidden="true">
          {HERO_PHOTOS.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className={`lp-hero-photo${i === idx ? " active" : ""}`} draggable={false} />
          ))}
          <div className="lp-hero-shade" />
        </div>

        <div className="lp-hero-content">
          <h1 className="lp-hero-title">
            MAXIMÁLNÍ VIDITELNOST VAŠÍ ZNAČKY.
            <br />
            NULOVÁ STAROST S VÝROBOU.
          </h1>
          <p className="lp-hero-sub">
            Reklamní vlajky, bannery a stany na míru. Navrhnete si je v našem editoru, my je vyrobíme a doručíme —
            a postavit je zvládne i jeden člověk.
          </p>
          <div className="lp-hero-actions">
            <Link href="/plazove-vlajky" className="lp-btn lp-btn-yellow">
              Navrhnout vlajku
            </Link>
            <a href="#lp-produkty" className="lp-btn lp-btn-ghost">
              Prohlédnout produkty
            </a>
          </div>
        </div>
      </section>

      {/* Dlaždice kategorií — zmenšené */}
      <section id="lp-produkty" className="lp-tiles">
        <div className="lp-section-head">
          <h2>Vyberte si produkt</h2>
          <p>Vlajky, bannery, nafukovací reklama i stany — vše navrhnete online.</p>
        </div>
        <NovaCatalog />
      </section>

      {/* Statistiky */}
      <section className="lp-stats">
        <div className="lp-stats-inner">
          <div>
            <CountUp target={3500} />
            <div className="lp-stats-label">vyrobených reklamních vlajek</div>
          </div>
          <div>
            <CountUp target={10000} />
            <div className="lp-stats-label">m² vyrobené reklamní plochy</div>
          </div>
          <div>
            <CountUp target={250} />
            <div className="lp-stats-label">spokojených zákazníků</div>
          </div>
        </div>
      </section>
    </div>
  );
}
