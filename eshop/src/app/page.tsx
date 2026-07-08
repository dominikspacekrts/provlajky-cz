import Link from "next/link";
import Image from "next/image";
import { PRODUCT_CATEGORIES } from "@/lib/types";

const CATEGORY_BLURB: Record<string, string> = {
  "plazove-vlajky": "6 tvarů, 4 velikosti, potisk podle vašeho designu.",
  "vlajky-na-zakazku": "Státní vlajka nebo vlastní grafika na klasické vlajce.",
  "pvc-bannery": "Odolné venkovní bannery na míru libovolné velikosti.",
  prislusenstvi: "Stojany, závaží a doplňky ke všem typům vlajek.",
};

export default function Home() {
  return (
    <div>
      <section className="container" style={{ paddingTop: 56, paddingBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: 48, lineHeight: 1.08 }}>
              Vytvořte si originální design, který zaujme na venkovních akcích
            </h1>
            <p style={{ color: "var(--gray)", fontSize: 17, lineHeight: 1.6, marginTop: 18, maxWidth: 480 }}>
              Plážové vlajky, vlajky na zakázku a PVC bannery v různých velikostech, tvarech a materiálech pro
              zvýšení viditelnosti vaší značky. Každý kus vyrábíme na míru, aby skvěle vypadal a dlouho vydržel.
            </p>
            <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
              <Link href="/plazove-vlajky" className="btn-pill dark">
                Plážové vlajky
              </Link>
              <Link href="/vlajky-na-zakazku" className="btn-pill light" style={{ border: "1.5px solid #e5e7eb" }}>
                Vlajky na zakázku
              </Link>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {["A", "C", "E"].map((s) => (
              <div key={s} style={{ aspectRatio: "3/5", borderRadius: 16, overflow: "hidden", background: "#f4f5f7" }}>
                <Image src={`/shapes/${s}.jpg`} alt={`Tvar ${s}`} width={300} height={500} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="stats-bar-inner">
          <div>
            <div className="num">3 500+</div>
            <div className="label">Počet vyrobených reklamních vlajek</div>
          </div>
          <div>
            <div className="num">10 000+</div>
            <div className="label">Počet m² vyrobené reklamy</div>
          </div>
          <div>
            <div className="num">100 %</div>
            <div className="label">Počet spokojených klientů</div>
          </div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 56, paddingBottom: 60 }}>
        <h2 style={{ fontSize: 32, textAlign: "center" }}>Co u nás najdete</h2>
        <p style={{ color: "var(--gray)", textAlign: "center", maxWidth: 640, margin: "14px auto 0" }}>
          Nabízíme různé velikosti, tvary i materiály, které zaručují vysokou kvalitu a odolnost. Vyberte si
          kategorii a nakonfigurujte si vlastní design.
        </p>

        <div className="category-grid" style={{ marginTop: 36 }}>
          {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
            <Link key={slug} href={`/${slug}`} className="category-card">
              <div className="thumb">
                {slug === "prislusenstvi" ? (
                  <span style={{ fontSize: 52 }}>⚓</span>
                ) : (
                  <Image
                    src={`/shapes/${slug === "vlajky-na-zakazku" ? "F" : slug === "pvc-bannery" ? "D" : "B"}.jpg`}
                    alt={label}
                    width={240}
                    height={240}
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: 16 }}
                  />
                )}
              </div>
              <div className="body">
                <div className="name">{label}</div>
                <div className="price">{CATEGORY_BLURB[slug]}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
