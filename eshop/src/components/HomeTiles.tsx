"use client";

// Dlaždice kategorií: vlajka vlaje při hoveru, banner se natočí do prostoru,
// nůžkový stan se rozloží. Klik = dlaždice se zvětší přes obrazovku a naviguje.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import FlagWave from "./FlagWave";

type Zoom = { top: number; left: number; width: number; height: number; bg: string; img?: string };

export default function HomeTiles() {
  const router = useRouter();
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [clickedHref, setClickedHref] = useState<string | null>(null);
  const navigatingRef = useRef(false);

  // Nůžkový stan v dlaždici = realistické video (Viewmax) přehrávané podle myši.
  // Klip jde od složeného stanu (0 s) po rozložený (konec). Myší najedeš → čas
  // se plynule posouvá k rozloženému; odjedeš → zpět ke složenému. Scrubování
  // (ne autoplay), takže se stan reálně „rozloží a složí" tam a zpět.
  const tentVideoRef = useRef<HTMLVideoElement | null>(null);
  const tentLinkRef = useRef<HTMLAnchorElement | null>(null);
  const tentHoverRef = useRef(false);
  useEffect(() => {
    const v = tentVideoRef.current;
    const link = tentLinkRef.current;
    if (!v || !link) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Nativní listenery (spolehlivější než React onMouseEnter) — otevři na hover,
    // na dotyku přepínej. Cíl scrubování: 0 = složeno, dur = rozloženo.
    const enter = () => {
      tentHoverRef.current = true;
    };
    const leave = () => {
      tentHoverRef.current = false;
    };
    const toggle = () => {
      tentHoverRef.current = !tentHoverRef.current;
    };
    link.addEventListener("pointerenter", enter);
    link.addEventListener("pointerleave", leave);
    link.addEventListener("touchstart", toggle, { passive: true });

    let raf = 0;
    const tick = () => {
      const dur = v.duration || 0;
      if (dur) {
        const target = tentHoverRef.current ? dur : 0;
        const cur = v.currentTime;
        const diff = target - cur;
        if (Math.abs(diff) > 0.02) {
          try {
            v.currentTime = cur + diff * 0.15;
          } catch {
            /* seek než je klip seekovatelný */
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      try {
        v.pause();
      } catch {
        /* noop */
      }
      raf = requestAnimationFrame(tick);
    };
    if (v.readyState >= 1) startLoop();
    else v.addEventListener("loadedmetadata", startLoop, { once: true });

    return () => {
      cancelAnimationFrame(raf);
      link.removeEventListener("pointerenter", enter);
      link.removeEventListener("pointerleave", leave);
      link.removeEventListener("touchstart", toggle);
    };
  }, []);

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
          onClick={(e) => go(e, "/pvc-bannery", "#f2f3f5")}
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
            <h3>PVC bannery / Meshe</h3>
            <p>Libovolný rozměr · plachta i mesh</p>
            <span className="tile-cta">Vybrat banner →</span>
          </div>
        </Link>

        <Link
          href="/stany"
          className={tileClass("tile-tent", "/stany")}
          ref={tentLinkRef}
          onClick={(e) => go(e, "/stany", "#f2f3f5")}
        >
          <div className="tile-visual tile-tent-visual">
            <video
              ref={tentVideoRef}
              className="tent-video"
              src="/stan-unfold.mp4"
              poster="/stan-folded.jpg"
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
            />
          </div>
          <div className="tile-label">
            <h3>Nůžkové a nafukovací stany</h3>
            <p>Rozložený za minutu · potisk střechy</p>
            <span className="tile-cta">Vybrat stan →</span>
          </div>
        </Link>

        <Link
          href="/stany#totemy"
          className={tileClass("tile-inflatable", "/stany#totemy")}
          onClick={(e) => go(e, "/stany#totemy", "#f2f3f5")}
        >
          <div className="tile-visual tile-inflatable-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/produkty/nafukovaci-brana.jpg" alt="" className="inflatable-photo" draggable={false} />
          </div>
          <div className="tile-label">
            <h3>Nafukovací reklamní předměty</h3>
            <p>Brány a totemy · potisk na míru</p>
            <span className="tile-cta">Vybrat produkt →</span>
          </div>
        </Link>

        <Link
          href="/prislusenstvi"
          className={tileClass("tile-accessory", "/prislusenstvi")}
          onClick={(e) => go(e, "/prislusenstvi", "#f2f3f5")}
        >
          <div className="tile-visual tile-accessory-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/prislusenstvi/tezka-zelezna-zakladna.jpg" alt="" className="accessory-photo" draggable={false} />
          </div>
          <div className="tile-label">
            <h3>Příslušenství</h3>
            <p>Stojany, závaží a zápichy</p>
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
