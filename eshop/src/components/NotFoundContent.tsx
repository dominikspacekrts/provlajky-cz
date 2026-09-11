import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@/lib/types";

// Obsah stránky 404.
//
// Styly si nese s sebou schválně: adresu mimo routy vyřizuje Next na úrovni
// routingu, mimo root layout — globals.css se k ní nepřipojí (ověřeno i na
// produkčním buildu, kde se stylopis objeví jen jako <link rel="preload">).
// Bez vlastního <style> by tedy 404 vyšla úplně neostylovaná. Blok je proto
// soběstačný včetně barevných proměnných a nesahá na <body>, aby nerozbil
// případ, kdy se stejná komponenta renderuje uvnitř layoutu (notFound()
// zavolané z routy, třeba u neexistujícího produktu).

const styles = `
  .nf-wrap {
    --nf-yellow: #ffe701; --nf-ink: #08080a; --nf-gray: #56565c; --nf-border: rgba(8, 8, 10, 0.16);
    box-sizing: border-box; width: min(560px, 90vw); margin: 0 auto;
    padding: clamp(48px, 12vh, 96px) 0; text-align: center;
    color: var(--nf-ink);
    font-family: var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .nf-wrap * { box-sizing: border-box; }
  .nf-code {
    margin: 0; font-size: clamp(64px, 12vw, 128px); line-height: 0.9;
    font-weight: 700; letter-spacing: -0.05em; color: var(--nf-yellow);
    -webkit-text-stroke: 2px var(--nf-ink);
  }
  .nf-wrap h1 { margin: 8px 0 0; font-size: clamp(24px, 4vw, 30px); letter-spacing: -0.03em; line-height: 1.1; }
  .nf-lead { margin: 12px auto 0; max-width: 420px; color: var(--nf-gray); line-height: 1.6; font-size: 15px; }
  .nf-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 26px; }
  .nf-btn {
    display: inline-block; padding: 13px 22px; font-size: 14px; font-weight: 600;
    text-decoration: none; border: 1px solid var(--nf-ink); color: var(--nf-ink);
    transition: background 0.25s ease, color 0.25s ease;
  }
  .nf-btn-primary { background: var(--nf-yellow); }
  .nf-btn-primary:hover, .nf-btn-ghost:hover { background: var(--nf-ink); color: #fff; }
  .nf-links { margin-top: 40px; padding-top: 22px; border-top: 1px solid var(--nf-border); }
  .nf-links p { margin: 0 0 12px; font-size: 13px; color: var(--nf-gray); }
  .nf-links ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 10px; justify-content: center; }
  .nf-links a {
    display: inline-block; padding: 7px 13px; font-size: 13px; color: var(--nf-ink);
    border: 1px solid var(--nf-border); text-decoration: none;
    transition: border-color 0.25s ease, background 0.25s ease;
  }
  .nf-links a:hover { border-color: var(--nf-ink); background: var(--nf-yellow); }
`;

export default function NotFoundContent() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="nf-wrap">
        <p className="nf-code">404</p>
        <h1>Tahle stránka nikde nevlaje</h1>
        <p className="nf-lead">
          Odkaz je nejspíš starý nebo v adrese chybí písmenko. Zkuste to od začátku — nebo rovnou skočte do
          konfigurátoru.
        </p>

        <div className="nf-actions">
          <Link href="/" className="nf-btn nf-btn-primary">
            Zpět na úvod
          </Link>
          <Link href="/kontakt" className="nf-btn nf-btn-ghost">
            Napsat nám
          </Link>
        </div>

        <div className="nf-links">
          <p>Kam nejčastěji míříte:</p>
          <ul>
            {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
              <li key={slug}>
                <Link href={`/${slug}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
