"use client";

// Dlaždice kategorií: vlajka vlaje při hoveru, banner se natočí do prostoru,
// nůžkový stan se rozloží. Klik = dlaždice se zvětší přes obrazovku a naviguje.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import FlagWave from "./FlagWave";

type Zoom = { top: number; left: number; width: number; height: number; bg: string; img?: string };

function AccessoryIcons() {
  return (
    <>
      <svg viewBox="0 0 60 100" className="accessory-icon" aria-hidden="true">
        <path d="M30 4 L44 60 L30 96 L16 60 Z" fill="currentColor" opacity="0.85" />
        <rect x="26" y="0" width="8" height="14" rx="2" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 60 100" className="accessory-icon" aria-hidden="true">
        <rect x="26" y="4" width="8" height="92" rx="3" fill="currentColor" />
        <circle cx="30" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="4.5" />
      </svg>
      <svg viewBox="0 0 60 100" className="accessory-icon" aria-hidden="true">
        <path d="M10 40 L50 40 L44 90 Q30 98 16 90 Z" fill="currentColor" opacity="0.85" />
        <line x1="10" y1="40" x2="50" y2="40" stroke="currentColor" strokeWidth="4" />
      </svg>
    </>
  );
}

// Nůžkový stan v dlaždici — v klidu složený (nohy stažené k sobě do úzkého
// stojícího balíku), na hover se rozloží. Ovládá to `.tile-tent:hover` v CSS,
// takže při odjetí myší se plynule složí zpět. Stan zůstává stát, nerozpadne se.
function TentTileSvg() {
  const legs = [36, 92, 148, 204];
  return (
    <svg viewBox="0 0 240 210" className="ttile" aria-hidden="true">
      <ellipse className="tt-shadow" cx="120" cy="200" rx="92" ry="7" />
      <g className="tt-tent">
        <g className="tt-frame">
          {/* nůžkové X mezi sousedními nohami */}
          {[0, 1, 2].map((i) => {
            const a = legs[i];
            const b = legs[i + 1];
            return (
              <g key={i} className="tt-x">
                <line x1={a} y1="104" x2={b} y2="170" />
                <line x1={b} y1="104" x2={a} y2="170" />
                <line x1={a} y1="150" x2={b} y2="196" />
                <line x1={b} y1="150" x2={a} y2="196" />
              </g>
            );
          })}
          {/* nohy + patky */}
          {legs.map((x) => (
            <g key={x}>
              <line className="tt-leg" x1={x} y1="98" x2={x} y2="196" />
              <rect className="tt-foot" x={x - 5} y="194" width="10" height="5" rx="2" />
            </g>
          ))}
        </g>
        <g className="tt-canopy">
          <polygon className="tt-roof" points="120,16 212,92 28,92" />
          <polygon className="tt-roof-shade" points="120,16 212,92 120,92" />
          <rect className="tt-valance" x="28" y="92" width="184" height="22" rx="3" />
          <image href="/logo/logo-tmave.png" x="82" y="95" width="76" height="16" preserveAspectRatio="xMidYMid meet" />
        </g>
      </g>
    </svg>
  );
}

export default function HomeTiles() {
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [clickedHref, setClickedHref] = useState<string | null>(null);
  const navigatingRef = useRef(false);

  function go(e: React.MouseEvent<HTMLAnchorElement>, href: string, bg: string, img?: string) {
    if (e.metaKey || e.ctrlKey || navigatingRef.current) return;
    e.preventDefault();
    navigatingRef.current = true;
    const r = e.currentTarget.getBoundingClientRect();
    setClickedHref(href);
    setZoom({ top: r.top, left: r.left, width: r.width, height: r.height, bg, img });
    requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)));
    router.prefetch(href);
    setTimeout(() => router.push(href), 850);
  }

  function tileClass(base: string, href: string) {
    return `tile ${base}${clickedHref === href ? " tile-clicked" : ""}`;
  }

  return (
    <section className="tiles-wrap" aria-label="Kategorie">
      <div className="tiles">
        <Link
          href="/plazove-vlajky"
          className={tileClass("tile-flag", "/plazove-vlajky")}
          onClick={(e) => go(e, "/plazove-vlajky", "#f2f3f5")}
        >
          <div className="tile-visual">
            <FlagWave shape="B" color="#ffe701" logoSrc="/logo/logo-tmave.png" logoPlate wind={0.14} />
          </div>
          <div className="tile-label">
            <h3>Plážové vlajky</h3>
            <p>6 tvarů · 4 velikosti · vlastní potisk</p>
            <span className="tile-cta">Vybrat vlajku →</span>
          </div>
        </Link>

        <Link
          href="/vlajky-na-zakazku"
          className={tileClass("tile-zakazka", "/vlajky-na-zakazku")}
          onClick={(e) => go(e, "/vlajky-na-zakazku", "#f2f3f5")}
        >
          <div className="tile-visual">
            <FlagWave shape="D" classic color="#ffe701" logoSrc="/logo/logo-tmave.png" logoPlate wind={0.14} />
          </div>
          <div className="tile-label">
            <h3>Vlajky na zakázku</h3>
            <p>Klasická žerď · vlastní grafika</p>
            <span className="tile-cta">Vybrat vlajku →</span>
          </div>
        </Link>

        <Link
          href="/pvc-bannery"
          className={tileClass("tile-banner", "/pvc-bannery")}
          onClick={(e) => go(e, "/pvc-bannery", "#ffe701")}
        >
          <div className="tile-visual banner-persp">
            <div className="banner-card">
              <div className="banner-cords" aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </div>
              <div className="banner-wrinkles" aria-hidden="true" />
              <div className="banner-plate">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo/logo-tmave.png" alt="" className="banner-logo" draggable={false} />
              </div>
              <div className="banner-eyelets" aria-hidden="true">
                <i /><i /><i /><i /><i /><i />
              </div>
            </div>
          </div>
          <div className="tile-label">
            <h3>PVC bannery</h3>
            <p>Libovolný rozměr · oka po obvodu</p>
            <span className="tile-cta">Vybrat banner →</span>
          </div>
        </Link>

        <Link
          href="/stany"
          className={tileClass("tile-tent", "/stany")}
          onClick={(e) => go(e, "/stany", "#f2f3f5")}
        >
          <div className="tile-visual tile-tent-visual">
            <TentTileSvg />
          </div>
          <div className="tile-label">
            <h3>Nůžkové stany</h3>
            <p>Rozložený za minutu · potisk střechy</p>
            <span className="tile-cta">Vybrat stan →</span>
          </div>
        </Link>

        <Link
          href="/prislusenstvi"
          className={tileClass("tile-accessory", "/prislusenstvi")}
          onClick={(e) => go(e, "/prislusenstvi", "#f2f3f5")}
        >
          <div className="tile-visual">
            <AccessoryIcons />
          </div>
          <div className="tile-label">
            <h3>Příslušenství</h3>
            <p>Stojany, vruty a závaží</p>
            <span className="tile-cta">Vybrat produkt →</span>
          </div>
        </Link>
      </div>

      {zoom && (
        <div
          className={`tile-zoom${expanded ? " expanded" : ""}`}
          style={
            expanded
              ? { top: 0, left: 0, width: "100vw", height: "100vh", background: zoom.bg }
              : { top: zoom.top, left: zoom.left, width: zoom.width, height: zoom.height, background: zoom.bg }
          }
        >
          {zoom.img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={zoom.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
          )}
        </div>
      )}
    </section>
  );
}
