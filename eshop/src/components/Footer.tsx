// Patička celého webu: tmavá plocha s jemným zrnem, kontakt, rozcestník
// a povinné údaje. Blok s čísly a velkým CTA („Pojďme na to.") patří jen
// homepage — je v `app/page.tsx`, ne tady.

import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/types";

export default function Footer() {
  return (
    <footer className="nv-close">
      <div className="nv-grain" aria-hidden="true" />

      <div className="nv-colophon">
        <div>
          <h4>Kontakt</h4>
          <p>
            <a href="tel:+420605981155">+420 605 981 155</a>
            <br />
            <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>
          </p>
          <p className="nv-colophon-reg">
            ACTUAL PRO S.R.O.
            <br />
            nábřeží Míru 1055/82
            <br />
            737 01 Český Těšín
            <br />
            IČO 25882201 · DIČ CZ25882201
          </p>
        </div>
        <div>
          <h4>Nabízíme</h4>
          <ul>
            {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
              <li key={slug}>
                <Link href={`/${slug}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Důležité informace</h4>
          <ul>
            <li>
              <Link href="/obchodni-podminky">Obchodní podmínky</Link>
            </li>
            <li>
              <Link href="/ochrana-osobnich-udaju">Zásady ochrany osobních údajů</Link>
            </li>
            <li>
              <Link href="/kosik">Košík</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="nv-bottom">© {new Date().getFullYear()} provlajky.cz — ACTUAL PRO S.R.O.</div>
    </footer>
  );
}
