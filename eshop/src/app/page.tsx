import Link from "next/link";
import HeroSlideshow from "@/components/HeroSlideshow";
import HomeTiles from "@/components/HomeTiles";

const TRUST = [
  { t: "Ověřený výrobce", d: "Vyrábíme pod vlastní značkou, žádný překupník." },
  { t: "Kvalitní materiály", d: "Polyester 115 g/m² a PVC plachtoviny do každého počasí." },
  { t: "Výroba na míru", d: "Každý kus tiskneme a šijeme podle vašeho návrhu." },
  { t: "Rychlé dodání", d: "Standardní výroba do 7–10 pracovních dnů." },
];

export default function Home() {
  return (
    <div className="home2">
      <div className="home-top">
        <HeroSlideshow />
        <HomeTiles />
      </div>

      <section className="dark-strip">
        <div className="dark-strip-inner">
          <div className="dark-stats">
            <div>
              <div className="num">3 500+</div>
              <div className="label">vyrobených reklamních vlajek</div>
            </div>
            <div>
              <div className="num">10 000+</div>
              <div className="label">m² vyrobené reklamní plochy</div>
            </div>
            <div>
              <div className="num">250+</div>
              <div className="label">spokojených zákazníků</div>
            </div>
          </div>
          <div className="dark-trust">
            {TRUST.map((x) => (
              <div key={x.t} className="trust-item">
                <span className="check" aria-hidden="true">✓</span>
                <div>
                  <div className="tt">{x.t}</div>
                  <div className="td">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 64, paddingBottom: 24 }}>
        <h2 style={{ fontSize: 30, textAlign: "center" }}>Hledáte něco dalšího?</h2>
        <div className="more-grid">
          <Link href="/vlajky-na-zakazku" className="more-card">
            <h3>Vlajky na zakázku</h3>
            <p>Státní i firemní vlajky na klasickou žerď podle vaší grafiky.</p>
            <span className="tile-cta">Zjistit více →</span>
          </Link>
          <Link href="/prislusenstvi" className="more-card">
            <h3>Příslušenství a stojany</h3>
            <p>Zemní vruty, křížové stojany, závaží a náhradní tyče.</p>
            <span className="tile-cta">Zjistit více →</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
