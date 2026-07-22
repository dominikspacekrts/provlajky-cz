"use client";

// Katalog produktů pro /nova — rozdělený podle jednotlivých produktů (vlajky,
// bannery, mesh, nafukovací reklama, stany) + sekce příslušenství s náhradními
// díly rozdělenými do tří kategorií. Odkazy míří na existující routy /[category].

import Link from "next/link";
import FlagWave from "./FlagWave";

type Visual = "flag-b" | "flag-classic" | "banner" | "photo";

type Item = {
  href: string;
  name: string;
  sub: string;
  visual: Visual;
  img?: string;
  cta: string;
};

// Skupiny produktů — každá dostane nadpis a vlastní mřížku dlaždic.
const GROUPS: { title: string; note: string; items: Item[] }[] = [
  {
    title: "Vlajky a bannery",
    note: "Klasika pro maximální viditelnost značky.",
    items: [
      { href: "/plazove-vlajky", name: "Plážové vlajky", sub: "6 tvarů · 4 velikosti · vlastní potisk", visual: "flag-b", cta: "Vybrat vlajku" },
      { href: "/vlajky-na-zakazku", name: "Vlajky na zakázku", sub: "Klasická žerď · vlastní grafika", visual: "flag-classic", cta: "Vybrat vlajku" },
      { href: "/pvc-bannery", name: "PVC bannery", sub: "Libovolný rozměr · oka po obvodu", visual: "banner", cta: "Vybrat banner" },
      { href: "/pvc-bannery", name: "Meshe", sub: "Prodyšná síťovina odolná větru", visual: "photo", img: "/produkty/mesh-banner.jpg", cta: "Vybrat mesh" },
    ],
  },
  {
    title: "Nafukovací reklama",
    note: "Rychlá stavba, maximální plocha, viditelnost z dálky.",
    items: [
      { href: "/nafukovaci-stany", name: "Nafukovací stany", sub: "Postavené během chvíle · potisk na míru", visual: "photo", img: "/produkty/nafukovaci-stan.jpg", cta: "Prohlédnout" },
      { href: "/totemy", name: "Nafukovací totemy", sub: "Vysoké sloupy viditelné z dálky", visual: "photo", img: "/produkty/nafukovaci-totem.jpg", cta: "Prohlédnout" },
      { href: "/nafukovaci-brany", name: "Nafukovací brány", sub: "Start a cíl závodů i akcí", visual: "photo", img: "/produkty/nafukovaci-brana.jpg", cta: "Prohlédnout" },
    ],
  },
  {
    title: "Nůžkové stany",
    note: "Rozložené za minutu, potisk střechy i stěn.",
    items: [
      { href: "/nuzkove-stany", name: "Nůžkové stany", sub: "Rozložený za minutu · potisk střechy", visual: "photo", img: "/stany/real-full.jpg", cta: "Vybrat stan" },
    ],
  },
];

// Příslušenství = všechny náhradní díly rozdělené do tří kategorií.
const PARTS: Item[] = [
  { href: "/nahradni-dily", name: "Náhradní díly pro vlajky", sub: "Žerdě, tunely, základny a zápichy", visual: "photo", img: "/produkty/dily-vlajky.jpg", cta: "Prohlédnout" },
  { href: "/nahradni-dily", name: "Náhradní díly pro nafukovací předměty", sub: "Dmychadla, opravné sady, kotvení", visual: "photo", img: "/produkty/dily-nafukovaci.jpg", cta: "Prohlédnout" },
  { href: "/nahradni-dily", name: "Náhradní díly pro nůžkové stany", sub: "Konstrukce, střechy a stěny", visual: "photo", img: "/produkty/dily-stany.jpg", cta: "Prohlédnout" },
];

function CatVisual({ item }: { item: Item }) {
  switch (item.visual) {
    case "flag-b":
      return (
        <div className="lp-cat-visual lp-cat-flag">
          <FlagWave shape="B" color="#ffe701" logoSrc="/logo/logo-tmave.png" logoPlate wind={0.14} />
        </div>
      );
    case "flag-classic":
      return (
        <div className="lp-cat-visual lp-cat-flag">
          <FlagWave shape="D" classic color="#ffe701" logoSrc="/logo/logo-tmave.png" logoPlate wind={0.14} />
        </div>
      );
    case "banner":
      return (
        <div className="lp-cat-visual lp-cat-banner">
          <div className="banner-persp">
            <div className="banner-card">
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
        </div>
      );
    default:
      return (
        <div className="lp-cat-visual lp-cat-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.img} alt={item.name} draggable={false} />
        </div>
      );
  }
}

function Card({ item }: { item: Item }) {
  return (
    <Link href={item.href} className="lp-cat-card">
      <CatVisual item={item} />
      <div className="lp-cat-body">
        <h3>{item.name}</h3>
        <p>{item.sub}</p>
        <span className="lp-cat-cta">{item.cta} →</span>
      </div>
    </Link>
  );
}

export default function NovaCatalog() {
  return (
    <div className="lp-catalog">
      {GROUPS.map((g) => (
        <div key={g.title} className="lp-cat-group">
          <div className="lp-cat-grouphead">
            <h3>{g.title}</h3>
            <p>{g.note}</p>
          </div>
          <div className="lp-cat-grid" data-count={g.items.length}>
            {g.items.map((it) => (
              <Card key={it.name} item={it} />
            ))}
          </div>
        </div>
      ))}

      <div className="lp-cat-group">
        <div className="lp-cat-grouphead">
          <h3>Příslušenství a náhradní díly</h3>
          <p>Vše na doplnění a opravy — rozdělené podle typu produktu.</p>
        </div>
        <div className="lp-cat-grid" data-count={PARTS.length}>
          {PARTS.map((it) => (
            <Card key={it.name} item={it} />
          ))}
        </div>
      </div>
    </div>
  );
}
