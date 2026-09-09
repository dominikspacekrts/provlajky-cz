import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stany HEX a AIR — nůžkové a nafukovací stany s potiskem — PROVLAJKY.CZ",
  description: "Stany HEX s hliníkovou hexagonovou konstrukcí a nafukovací stany AIR s plnobarevným potiskem na míru.",
};

// Tři samostatné vstupy — klikem na dlaždici se otevře jen ta jedna skupina
// (přes existující /[category] výpis), ne všechno naráz pod sebou.
const GROUPS = [
  {
    href: "/nuzkove-stany",
    title: "Stany HEX",
    note: "Hliníková hexagonová konstrukce — nůžkový stan rozložený za minutu.",
    img: "/stany/nuzkovy-3x3.jpg",
  },
  {
    href: "/nafukovaci-stany",
    title: "Stany AIR",
    note: "Nafukovací konstrukce bez tyčí — postaví ji jeden člověk.",
    img: "/produkty/nafukovaci-stan.jpg",
  },
  {
    href: "/nahradni-dily",
    title: "Náhradní díly a příslušenství",
    note: "Rámy, plachty, dmychadla a další díly ke stanům HEX i AIR.",
    img: "/produkty/dily-stany.jpg",
  },
] as const;

export default function StanyPage() {
  return (
    <div className="container stany-page">
      <h1>Stany HEX a AIR</h1>
      <section className="stany-groups reveal-stagger">
        {GROUPS.map((g) => (
          <Link key={g.href} href={g.href} className="group-tile">
            <div className="group-tile-photo">
              <Image
                src={g.img}
                alt={g.title}
                width={640}
                height={480}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                unoptimized
              />
            </div>
            <div className="group-tile-body">
              <div className="group-tile-title">{g.title}</div>
              <p className="group-tile-note">{g.note}</p>
              <span className="group-tile-cta">Zobrazit →</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
