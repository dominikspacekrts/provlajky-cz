"use client";

// Dlaždice kategorií: vlajka vlaje při hoveru, banner se natočí do prostoru,
// nůžkový stan se rozloží. Klik = rovnou navigace, bez přechodové animace.

import Link from "next/link";
import { useEffect, useRef } from "react";
import FlagWave from "./FlagWave";

export default function HomeTiles() {
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

  return (
    <section className="tiles-wrap" aria-label="Kategorie">
      <div className="tiles">
        <Link
          href="/plazove-vlajky"
          className="tile tile-flag"
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
          className="tile tile-zakazka"
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
          className="tile tile-banner"
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
          className="tile tile-tent"
          ref={tentLinkRef}
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
          className="tile tile-inflatable"
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
          className="tile tile-accessory"
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
    </section>
  );
}
