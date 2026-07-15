"use client";

// Pozadí homepage: pomalu se prolínající fotky realizací, fixně přes celou obrazovku
// (stejně jako pevné pozadí na podstránkách). Obsah stránky plave nad ním.

import { useEffect, useState } from "react";
import { HERO_PHOTOS as PHOTOS, setLastHeroPhoto } from "@/lib/heroPhoto";

const INTERVAL = 30000;

export default function HeroSlideshow() {
  const [idx, setIdx] = useState(0);
  const [loadedAll, setLoadedAll] = useState(false);

  useEffect(() => {
    // ostatní fotky přednačteme až po zobrazení první
    const t = setTimeout(() => setLoadedAll(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loadedAll) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % PHOTOS.length), INTERVAL);
    return () => clearInterval(t);
  }, [loadedAll]);

  // aktuálně viditelnou fotku sdílíme, aby na ni mohla navázat i další stránka po kliknutí na dlaždici
  useEffect(() => {
    setLastHeroPhoto(PHOTOS[idx]);
  }, [idx]);

  return (
    <div className="home-bg" aria-hidden="true">
      <div className="home-bg-photos">
        {PHOTOS.map((src, i) =>
          i === 0 || loadedAll ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className={`home-bg-photo${i === idx ? " active" : ""}`} draggable={false} />
          ) : null
        )}
      </div>
      <div className="home-bg-shade" />
    </div>
  );
}
