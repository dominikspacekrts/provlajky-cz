import { escapeHtml } from "@/lib/email-templates";
import { formatPromoDiscountLabel } from "./promo-code";
import type { NewsletterProductCard } from "./types";

function fmtPrice(n: number): string {
  return (
    Math.round(n).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " Kč"
  );
}

function productCardsHtml(products: NewsletterProductCard[]): string {
  if (!products.length) return "";
  const cells = products
    .map((p) => {
      const img = p.imageUrl
        ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="160" style="display:block;width:160px;max-width:100%;height:auto;border-radius:8px;margin:0 auto 10px">`
        : `<div style="width:160px;height:100px;background:#f3f4f6;border-radius:8px;margin:0 auto 10px"></div>`;
      return `<td style="width:33%;padding:8px;vertical-align:top;text-align:center">
  <a href="${escapeHtml(p.url)}" style="text-decoration:none;color:#1f2937">
    ${img}
    <div style="font-size:13px;font-weight:bold;line-height:1.35;margin-bottom:4px">${escapeHtml(p.name)}</div>
    <div style="font-size:13px;color:#4b5563">od ${fmtPrice(p.fromPrice)} <span style="color:#9ca3af">bez DPH</span></div>
  </a>
</td>`;
    })
    .join("");

  // Po 3 produktech zalomit řádek.
  const rows: string[] = [];
  const parts = cells.match(/<td[\s\S]*?<\/td>/g) || [];
  for (let i = 0; i < parts.length; i += 3) {
    rows.push(`<tr>${parts.slice(i, i + 3).join("")}</tr>`);
  }
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px">${rows.join("")}</table>`;
}

export type NewsletterBodyInput = {
  greeting: string;
  introHtml: string;
  products: NewsletterProductCard[];
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  validUntil: string | null;
  ctaUrl: string;
  ctaLabel?: string;
};

/**
 * Tělo newsletteru (bez wrapEmailHtml) — stejný vizuální jazyk jako
 * potvrzení objednávky: žlutý box, tabulky, čisté Arial.
 */
export function buildNewsletterBodyHtml(input: NewsletterBodyInput): string {
  const discountLabel = formatPromoDiscountLabel(input.discountType, input.discountValue);
  const validLine = input.validUntil
    ? `<br>Platnost do <strong>${escapeHtml(
        new Date(input.validUntil).toLocaleDateString("cs-CZ")
      )}</strong>.`
    : "";

  const intro = (input.introHtml || "").trim() ||
    `<p>děkujeme, že jezdíš s RTS. Připravili jsme pro tebe slevu na reklamu od PROVLAJKY — plážové vlajky, stany i bannery vyrábíme na míru.</p>`;

  return `<p>${escapeHtml(input.greeting)}</p>
${intro}
${productCardsHtml(input.products)}
<p style="text-align:center;margin:24px 0 8px;font-size:14px;color:#4b5563">Tvůj slevový kód na <strong>${escapeHtml(discountLabel)}</strong>:</p>
<p style="text-align:center;margin:8px 0 20px">
  <span style="display:inline-block;font-size:26px;font-weight:bold;letter-spacing:4px;background:#f4d03f;color:#1f2329;padding:14px 26px;border-radius:8px">${escapeHtml(input.code)}</span>
</p>
<p style="background:#f7f8f9;border-left:3px solid #f4d03f;padding:12px 14px;margin:16px 0;color:#444">
Kód zadej v objednávce na <a href="${escapeHtml(input.ctaUrl)}" style="color:#1f2329;font-weight:bold">provlajky.cz</a> a klikni na „Uplatnit“.${validLine}
</p>
<table cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:#f4d03f;border-radius:6px">
<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:14px 26px;color:#1f2329;font-weight:bold;text-decoration:none;font-size:15px">${escapeHtml(input.ctaLabel || "Prohlédnout produkty")}</a>
</td></tr></table>
<p>Máš dotaz k rozměrům nebo grafice? Stačí odpovědět na tento e-mail.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`;
}

/** Coldcall varianta — formálnější oslovení, individuální nabídka. */
export function buildColdcallBodyHtml(input: NewsletterBodyInput & { companyName: string }): string {
  const discountLabel = formatPromoDiscountLabel(input.discountType, input.discountValue);
  const validLine = input.validUntil
    ? `<br>Platnost do <strong>${escapeHtml(
        new Date(input.validUntil).toLocaleDateString("cs-CZ")
      )}</strong>.`
    : "";
  const intro =
    (input.introHtml || "").trim() ||
    `<p>ozýváme se z PROVLAJKY — vyrábíme plážové vlajky, nůžkové/nafukovací stany a bannery na míru. Pro <strong>${escapeHtml(input.companyName)}</strong> jsme připravili individuální nabídku.</p>`;

  return `<p>Dobrý den,</p>
${intro}
${productCardsHtml(input.products)}
<p style="text-align:center;margin:24px 0 8px;font-size:14px;color:#4b5563">Váš slevový kód na <strong>${escapeHtml(discountLabel)}</strong>:</p>
<p style="text-align:center;margin:8px 0 20px">
  <span style="display:inline-block;font-size:26px;font-weight:bold;letter-spacing:4px;background:#f4d03f;color:#1f2329;padding:14px 26px;border-radius:8px">${escapeHtml(input.code)}</span>
</p>
<p style="background:#f7f8f9;border-left:3px solid #f4d03f;padding:12px 14px;margin:16px 0;color:#444">
Kód zadejte v objednávce na <a href="${escapeHtml(input.ctaUrl)}" style="color:#1f2329;font-weight:bold">provlajky.cz</a>.${validLine}
</p>
<table cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="background:#f4d03f;border-radius:6px">
<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:14px 26px;color:#1f2329;font-weight:bold;text-decoration:none;font-size:15px">${escapeHtml(input.ctaLabel || "Otevřít e-shop")}</a>
</td></tr></table>
<p>Rádi připravíme i cenovou nabídku na míru — stačí odpovědět na tento e-mail.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`;
}
