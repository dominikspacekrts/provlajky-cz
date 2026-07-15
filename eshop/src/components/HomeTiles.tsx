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

function ZakazkaSvg() {
  return (
    <svg viewBox="0 0 140 110" className="zakazka-svg" aria-hidden="true">
      <defs>
        {/* vlnění látky: animovaný šum posouvá pixely vlajky = poryvy větru */}
        <filter id="zakazkaCloth" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.022" numOctaves="2" seed="7" result="noise">
            <animate attributeName="baseFrequency" dur="10s" values="0.01 0.022;0.014 0.03;0.01 0.022" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" xChannelSelector="R" yChannelSelector="G" scale="9">
            <animate attributeName="scale" dur="7s" values="6;13;6" repeatCount="indefinite" />
          </feDisplacementMap>
        </filter>
      </defs>
      <rect x="16" y="2" width="7" height="106" rx="3" fill="#3d3d42" />
      <g className="zakazka-cloth" filter="url(#zakazkaCloth)">
        <path d="M23 10 L128 6 L124 50 L128 94 L23 90 Z" fill="#ffe701" />
        {/* logo je součástí látky, takže se vlní spolu s vlajkou */}
        <image href="/logo/logo-tmave.png" x="44" y="30" width="64" height="40" preserveAspectRatio="xMidYMid meet" />
      </g>
    </svg>
  );
}

function TentSvg() {
  return (
    <svg viewBox="0 0 220 210" className="tent-svg" aria-hidden="true">
      <g className="tent-legs">
        <line x1="38" y1="92" x2="38" y2="196" stroke="#3d3d42" strokeWidth="5" strokeLinecap="round" />
        <line x1="182" y1="92" x2="182" y2="196" stroke="#3d3d42" strokeWidth="5" strokeLinecap="round" />
        <line x1="38" y1="104" x2="182" y2="168" stroke="#55555c" strokeWidth="3.4" strokeLinecap="round" />
        <line x1="182" y1="104" x2="38" y2="168" stroke="#55555c" strokeWidth="3.4" strokeLinecap="round" />
        <line x1="38" y1="168" x2="182" y2="196" stroke="#55555c" strokeWidth="3.4" strokeLinecap="round" opacity="0.55" />
        <line x1="182" y1="168" x2="38" y2="196" stroke="#55555c" strokeWidth="3.4" strokeLinecap="round" opacity="0.55" />
      </g>
      <g className="tent-canopy">
        <polygon points="110,14 196,86 24,86" fill="#ffe701" />
        <polygon points="110,14 196,86 110,86" fill="#e6cf00" />
        <rect x="24" y="86" width="172" height="22" rx="3" fill="#1c1c1f" />
        <text x="110" y="102" textAnchor="middle" fill="#ffe701" fontSize="13" fontWeight="700" fontFamily="inherit" letterSpacing="1.5">
          PROVLAJKY.CZ
        </text>
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
            <FlagWave shape="B" color="#ffe701" logoSrc="/logo/logo-tmave.png" wind={0.14} />
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
            <ZakazkaSvg />
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
            <div className="banner-card banner-card-yellow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/logo-tmave.png" alt="" className="banner-logo" draggable={false} />
              <div className="banner-eyelets" aria-hidden="true">
                <i /><i /><i /><i />
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
          onClick={(e) => go(e, "/stany", "#141414")}
        >
          <div className="tile-visual">
            <TentSvg />
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
