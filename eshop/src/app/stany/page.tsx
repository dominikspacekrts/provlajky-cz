import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nůžkové stany s potiskem — PROVLAJKY.CZ",
  description: "Nůžkové (pop-up) stany s potiskem střechy a bočnic na míru. Rozložené za minutu.",
};

export default function StanyPage() {
  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <div className="page-panel reveal-stagger" style={{ maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ fontSize: 34 }}>Nůžkové stany s potiskem</h1>
        <p style={{ color: "var(--gray)", marginTop: 14, fontSize: 16, lineHeight: 1.65 }}>
          Pop-up stany 3×3 m s potiskem střechy, valance i bočnic podle vaší grafiky. Hliníková
          nůžková konstrukce se rozloží za minutu bez nářadí — ideální na sportovní akce, festivaly
          i prodejní stánky.
        </p>
        <p style={{ color: "var(--gray)", marginTop: 12, fontSize: 16, lineHeight: 1.65 }}>
          Konfigurátor stanů právě připravujeme. Do té doby nám napište, co potřebujete — připravíme
          nabídku a grafický náhled na míru.
        </p>
        <div style={{ marginTop: 26, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a href="mailto:info@provlajky.cz?subject=Poptávka – nůžkový stan" className="btn-yellow">
            Poptat stan na míru
          </a>
          <a href="tel:+420605981155" className="btn-outline">Zavolat nám</a>
        </div>
      </div>
    </div>
  );
}
