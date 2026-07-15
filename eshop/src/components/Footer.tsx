import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/types";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-contact">
        <a href="tel:+420605981155">📞 +420 605 981 155</a>
        <a href="mailto:info@provlajky.cz">✉️ info@provlajky.cz</a>
      </div>
      <div className="footer-grid">
        <div>
          <h4>Kontaktní informace</h4>
          <div style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.7 }}>
            ACTUAL PRO S.R.O.
            <br />
            nábřeží Míru 1055/82
            <br />
            737 01 Český Těšín
            <br />
            IČO: 25882201, DIČ: CZ25882201
          </div>
        </div>
        <div>
          <h4>Nabízíme</h4>
          {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
            <Link key={slug} href={`/${slug}`}>
              {label}
            </Link>
          ))}
        </div>
        <div>
          <h4>Důležité informace</h4>
          <Link href="/obchodni-podminky">Obchodní podmínky</Link>
          <Link href="/ochrana-osobnich-udaju">Zásady ochrany osobních údajů</Link>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} provlajky.cz. Všechna práva vyhrazena.</div>
    </footer>
  );
}
