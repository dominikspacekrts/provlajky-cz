"use client";

// Pravý sloupec konfigurátoru (plážové vlajky, vlajky na zakázku) — fotky
// hotových produktů z adminu (Konfigurace webu), proklikatelné do lightboxu.
//
// Na mobilu se ze sloupce stane úzká lišta čipů podél levé hrany náhledu
// (variant="rail" řeší CSS, DOM zůstává stejný) — na půlce obrazovky není
// místo na sloupec, ale fotky realizací prodávají, tak ať jsou po ruce.
//
// V lightboxu se listuje šipkami (na obrazovce i na klávesnici) a swipem,
// takže se zákazník nemusí po každé fotce vracet do mřížky.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function ConfiguratorGallery({ photos }: { photos: { id: string; image: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const touchX = useRef<number | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- document.body only exists client-side, needed for the portal target
  useEffect(() => setMounted(true), []);

  const step = useCallback(
    (dir: number) => setOpenIdx((i) => (i === null ? i : (i + dir + photos.length) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx, step]);

  if (!photos.length) return null;

  return (
    <aside className="fc-gallery">
      <div className="fc-gallery-head">Hotové realizace</div>
      <div className="fc-gallery-grid">
        {photos.map((p, i) => (
          <button key={p.id} type="button" className="fc-gallery-item" onClick={() => setOpenIdx(i)} aria-label="Zvětšit fotku">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt="" loading="lazy" />
          </button>
        ))}
      </div>

      {/* Portál do document.body — .fc-gallery má backdrop-filter, a to
          (stejně jako transform) založí nový "containing block" pro
          position:fixed potomky, takže by se lightbox bez portálu vykreslil
          jen uvnitř sloupce galerie místo přes celou obrazovku. */}
      {mounted && openIdx !== null &&
        createPortal(
          <div
            className="fc-lightbox"
            onClick={() => setOpenIdx(null)}
            role="dialog"
            aria-modal="true"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              const from = touchX.current;
              touchX.current = null;
              if (from === null) return;
              const dx = e.changedTouches[0].clientX - from;
              if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            }}
          >
            <button type="button" className="fc-lightbox-close" onClick={() => setOpenIdx(null)} aria-label="Zavřít">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
            </button>

            {photos.length > 1 && (
              <button
                type="button"
                className="fc-lightbox-nav is-prev"
                onClick={(e) => { e.stopPropagation(); step(-1); }}
                aria-label="Předchozí fotka"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4L7 12l8 8" /></svg>
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={photos[openIdx].id} src={photos[openIdx].image} alt="" className="fc-lightbox-img" onClick={(e) => e.stopPropagation()} />

            {photos.length > 1 && (
              <button
                type="button"
                className="fc-lightbox-nav is-next"
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label="Další fotka"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8" /></svg>
              </button>
            )}

            {photos.length > 1 && (
              <div className="fc-lightbox-count">
                {openIdx + 1} / {photos.length}
              </div>
            )}
          </div>,
          document.body
        )}
    </aside>
  );
}
