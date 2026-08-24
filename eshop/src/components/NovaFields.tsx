"use client";

// Produktová mřížka pro /nova — dva sloupce velkých panelů podle vzoru
// apple.com: nahoře vycentrovaný název, jedna věta a jedna akce, pod tím
// fotka přes celou plochu panelu. Žádné karty, zaoblení ani stíny; panely
// drží pohromadě vláskové švy.
//
// Fotky se studiovým pozadím se liší: nafukovací brána a mesh mají pozadí
// čistě bílé (splynou s deskou → "contain"), stan a díly mají vlastní šedé
// studiové pozadí (musí vyplnit panel → "cover"), jinak by se kreslily jako
// nalepený obdélník.
//
// Panel bez fotky se vykreslí jako označený slot s cestou, kam fotku nahrát.

import Link from "next/link";
import { NovaArrow, useInView } from "./NovaReveal";
import type { ProductCategory } from "@/lib/types";

// Většina dlaždic má id shodné s reálnou kategorií produktu — jen "nafukovaci"
// je souhrn tří kategorií (brány, totemy, nafukovací stany), takže potřebuje
// vlastní mapování, aby šlo dohledat, jestli má ukázat slevovou plaketu.
const TILE_CATEGORIES: Record<string, ProductCategory[]> = {
  nafukovaci: ["nafukovaci-brany", "totemy", "nafukovaci-stany"],
};

type Tile = {
  id: string;
  title: string;
  note: string;
  href: string;
  cta: string;
  tone: "scene" | "studio" | "stage";
  fit?: "contain" | "cover";
  /** Kotva fotky uvnitř rámu (CSS object-position) — u "scene" dlaždic
   * s reálnou fotkou z akce potřebujeme vycentrovat na produkt (vlajky),
   * ne na střed kompozice. */
  objectPosition?: string;
  /** null = fotka zatím není, vykreslí se označený slot */
  img: string | null;
  slotPath?: string;
  slotHint?: string;
};

const TILES: Tile[] = [
  {
    id: "plazove-vlajky",
    title: "Plážové vlajky",
    note: "Šest tvarů, potisk na míru, žerď i základna podle terénu.",
    href: "/plazove-vlajky",
    cta: "Vybrat vlajku",
    tone: "scene",
    img: "/fotky/foto-01.jpg",
    objectPosition: "28% 30%",
  },
  {
    id: "vlajky-na-zakazku",
    title: "Vlajky na zakázku",
    note: "Státní i vlastní grafika, libovolný rozměr, oka podle potřeby.",
    href: "/vlajky-na-zakazku",
    cta: "Vybrat vlajku",
    tone: "scene",
    img: "/fotky/foto-02.jpg",
    objectPosition: "50% 32%",
  },
  {
    id: "pvc-bannery",
    title: "PVC bannery a meshe",
    note: "Cena za m², oka po obvodu, mesh tam, kde fouká.",
    href: "/pvc-bannery",
    cta: "Spočítat banner",
    tone: "studio",
    fit: "contain",
    img: "/produkty/mesh-banner.jpg",
  },
  {
    id: "nafukovaci",
    title: "Nafukovací reklama",
    note: "Brány, totemy i stany. Postaví to jeden člověk.",
    href: "/nafukovaci-brany",
    cta: "Vybrat produkt",
    tone: "studio",
    fit: "contain",
    img: "/produkty/nafukovaci-brana.jpg",
  },
  {
    id: "nuzkove-stany",
    title: "Nůžkové stany",
    note: "Rozložený za minutu, potisk střechy i stěn.",
    href: "/nuzkove-stany",
    cta: "Vybrat stan",
    tone: "studio",
    fit: "contain",
    img: "/stany/real-full.jpg",
  },
  {
    id: "prislusenstvi",
    title: "Příslušenství a náhradní díly",
    note: "Základny, stojany, žerdě, dmychadla, rámy.",
    href: "/nahradni-dily",
    cta: "Prohlédnout díly",
    tone: "studio",
    fit: "contain",
    img: "/produkty/dily-vlajky.jpg",
  },
];

export default function NovaFields({
  /** Sleva (%) podle reálné kategorie (nastavuje se v adminu u produktu). */
  salePctByCategory,
}: {
  salePctByCategory: Partial<Record<ProductCategory, number>>;
}) {
  const { ref, inView } = useInView<HTMLDivElement>(0.05);

  return (
    <div ref={ref} id="produkty" className={`nv-grid${inView ? " is-in" : ""}`}>
      {TILES.map((t, i) => {
        const categories = TILE_CATEGORIES[t.id] || [t.id as ProductCategory];
        const salePct = Math.max(0, ...categories.map((c) => salePctByCategory[c] || 0));
        return (
        <section
          key={t.id}
          id={t.id}
          className={`nv-tile is-${t.tone}${t.fit ? ` fit-${t.fit}` : ""}${t.img ? "" : " is-slot"}`}
          style={{ "--d": `${(i % 2) * 90 + Math.floor(i / 2) * 40}ms` } as React.CSSProperties}
        >
          <div className="nv-tile-head">
            {salePct > 0 && <span className="nv-tile-badge">−{salePct} %</span>}
            <h3 className="nv-tile-title">{t.title}</h3>
            <p className="nv-tile-note">{t.note}</p>
            <span className="nv-tile-cta">
              {t.cta}
              <NovaArrow />
            </span>
          </div>

          <div className="nv-tile-media">
            {t.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.img}
                alt=""
                draggable={false}
                loading="lazy"
                decoding="async"
                style={t.objectPosition ? { objectPosition: t.objectPosition } : undefined}
              />
            ) : (
              <p className="nv-slot-note">
                <b>Místo pro fotku</b>
                <span>{t.slotPath}</span>
                <span>{t.slotHint}</span>
              </p>
            )}
          </div>

          <span className="nv-tile-frame" aria-hidden="true" />
          <Link href={t.href} className="nv-tile-hit" aria-label={`${t.title} — ${t.cta}`} />
        </section>
        );
      })}
    </div>
  );
}
