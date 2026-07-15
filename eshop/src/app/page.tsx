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
      <HeroSlideshow />

      <div className="home-screen">
        <div className="hero2-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-hero.png" alt="PROVLAJKY.CZ" className="hero2-logo" />
          <p className="hero2-tag">Reklamní vlajky, bannery a stany na míru. Navrhněte, my vyrobíme.</p>
        </div>

        <HomeTiles />

        <section className="home-stats-card">
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
        </section>
      </div>
    </div>
  );
}
