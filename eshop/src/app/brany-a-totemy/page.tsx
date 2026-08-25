import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nafukovací reklama — brány a totemy s potiskem — PROVLAJKY.CZ",
  description: "Nafukovací brány a totemy (nafukovací sloupy) s plnobarevným potiskem na míru.",
};

// Dvě samostatné vstupy — klikem na dlaždici se otevře jen ta jedna kategorie
// (přes existující /[category] výpis), stejný vzor jako /stany.
const GROUPS = [
  {
    href: "/totemy",
    title: "Nafukovací totemy",
    note: "Nafukovací sloupy s potiskem, vejdou se i do menšího prostoru.",
    img: "/produkty/nafukovaci-totem.jpg",
  },
  {
    href: "/nafukovaci-brany",
    title: "Nafukovací brány",
    note: "Startovní a cílové brány s plnobarevným potiskem na míru.",
    img: "/produkty/nafukovaci-brana.jpg",
  },
] as const;

export default function BranyATotemyPage() {
  return (
    <div className="container stany-page">
      <h1>Nafukovací reklama</h1>
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
