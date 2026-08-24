"use client";

// Pravý sloupec konfigurátoru (plážové vlajky, vlajky na zakázku) — fotky
// hotových produktů z adminu (Konfigurace webu), proklikatelné do lightboxu.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ConfiguratorGallery({ photos }: { photos: { id: string; image: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- document.body only exists client-side, needed for the portal target
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenIdx(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx]);

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
          <div className="fc-lightbox" onClick={() => setOpenIdx(null)} role="dialog" aria-modal="true">
            <button type="button" className="fc-lightbox-close" onClick={() => setOpenIdx(null)} aria-label="Zavřít">
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[openIdx].image} alt="" className="fc-lightbox-img" onClick={(e) => e.stopPropagation()} />
          </div>,
          document.body
        )}
    </aside>
  );
}
