"use client";

// Tři dlaždice: vlajka vlaje při hoveru, banner se natočí do prostoru,
// nůžkový stan se rozloží. Klik = dlaždice se zvětší přes obrazovku a naviguje.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import FlagWave from "./FlagWave";

type Zoom = { top: number; left: number; width: number; height: number; bg: string; img?: string };

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
  const navigatingRef = useRef(false);

  function go(e: React.MouseEvent<HTMLAnchorElement>, href: string, bg: string, img?: string) {
    if (e.metaKey || e.ctrlKey || navigatingRef.current) return;
    e.preventDefault();
    navigatingRef.current = true;
    const r = e.currentTarget.getBoundingClientRect();
    setZoom({ top: r.top, left: r.left, width: r.width, height: r.height, bg, img });
    requestAnimationFrame(() => requestAnimationFrame(() => setExpanded(true)));
    router.prefetch(href);
    setTimeout(() => router.push(href), 560);
  }

  return (
    <section className="tiles-wrap container" aria-label="Kategorie">
      <div className="tiles">
        <Link href="/plazove-vlajky" className="tile tile-flag" onClick={(e) => go(e, "/plazove-vlajky", "#f2f3f5")}>
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
          href="/pvc-bannery"
          className="tile tile-banner"
          onClick={(e) => go(e, "/pvc-bannery", "#191919", "/fotky/foto-01.jpg")}
        >
          <div className="tile-visual banner-persp">
            <div className="banner-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fotky/foto-01.jpg" alt="" draggable={false} />
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

        <Link href="/stany" className="tile tile-tent" onClick={(e) => go(e, "/stany", "#141414")}>
          <div className="tile-visual">
            <TentSvg />
          </div>
          <div className="tile-label">
            <h3>Nůžkové stany</h3>
            <p>Rozložený za minutu · potisk střechy</p>
            <span className="tile-cta">Vybrat stan →</span>
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
