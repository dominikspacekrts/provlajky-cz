"use client";

// Hero: pomalu se prolínající fotky realizací, uprostřed logo se stínem.

import { useEffect, useState } from "react";

const PHOTOS = [
  "/fotky/foto-01.jpg",
  "/fotky/foto-02.jpg",
  "/fotky/foto-03.jpg",
  "/fotky/foto-04.jpg",
  "/fotky/foto-05.jpg",
  "/fotky/foto-06.jpg",
  "/fotky/foto-07.jpg",
];

const INTERVAL = 5600;

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

  return (
    <section className="hero2" aria-label="PROVLAJKY.CZ — výroba reklamních vlajek a bannerů">
      <div className="hero2-photos">
        {PHOTOS.map((src, i) =>
          i === 0 || loadedAll ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className={`hero2-photo${i === idx ? " active" : ""}`} draggable={false} />
          ) : null
        )}
      </div>
      <div className="hero2-shade" />
      <div className="hero2-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-hero.png" alt="PROVLAJKY.CZ" className="hero2-logo" />
        <p className="hero2-tag">Reklamní vlajky, bannery a stany na míru. Navrhněte, my vyrobíme.</p>
      </div>
    </section>
  );
}
