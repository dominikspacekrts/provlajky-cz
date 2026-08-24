import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { variantSizes, type Product } from "@/lib/types";
import TentFold from "@/components/TentFold";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nůžkové a nafukovací stany s potiskem — PROVLAJKY.CZ",
  description: "Skládací nůžkové stany a nafukovací stany s plnobarevným potiskem na míru.",
};

// Tři samostatné vstupy — klikem na dlaždici se otevře jen ta jedna skupina
// (přes existující /[category] výpis), ne všechno naráz pod sebou.
const GROUPS = [
  {
    href: "/nuzkove-stany",
    title: "Nůžkové stany",
    note: "Skládací hliníková konstrukce, rozložený za minutu.",
    img: "/stany/real-full.jpg",
  },
  {
    href: "/nafukovaci-stany",
    title: "Nafukovací stany",
    note: "Postaví jeden člověk, plnobarevný potisk stěn i střechy.",
    img: "/produkty/nafukovaci-stan.jpg",
  },
  {
    href: "/nahradni-dily",
    title: "Náhradní díly",
    note: "Rámy, plachty, dmychadla a další příslušenství ke stanům.",
    img: "/produkty/dily-stany.jpg",
  },
] as const;

export default async function StanyPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("category", "nuzkove-stany")
    .eq("active", true)
    .order("sort_order")
    .limit(1);
  const firstNuzkovy = (data?.[0] as Product | undefined) ?? undefined;
  const firstNuzkovySize = firstNuzkovy ? variantSizes(firstNuzkovy)[0] : undefined;

  return (
    <div className="container stany-page">
      <section className="stany-hero reveal-stagger">
        <div className="stany-hero-copy">
          <h1>Nůžkové stany s potiskem</h1>
          <p>
            Skládací pop-up stany s hliníkovou nůžkovou konstrukcí a plnobarevným potiskem střechy, valance i bočnic.
            Vyber velikost, pak konfiguraci stěn — rozloží se za minutu bez nářadí.
          </p>
          <div className="stany-hero-cta">
            {firstNuzkovy ? (
              <Link
                href={`/produkt/${firstNuzkovy.slug}${firstNuzkovySize ? `?size=${encodeURIComponent(firstNuzkovySize)}` : ""}`}
                className="btn-yellow"
              >
                Sestavit stan →
              </Link>
            ) : (
              <a href="mailto:info@provlajky.cz?subject=Poptávka – nůžkový stan" className="btn-yellow">
                Poptat stan na míru
              </a>
            )}
            <a href="tel:+420605981155" className="btn-outline">Zavolat nám</a>
          </div>
          <div className="stany-fold">
            <TentFold />
            <span>Nůžková konstrukce — složí a rozloží se za minutu</span>
          </div>
        </div>
        <div className="stany-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/stan-hero.jpg" alt="Nůžkový stan s potiskem" />
        </div>
      </section>

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
