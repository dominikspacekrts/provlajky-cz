import { escapeHtml } from "@/lib/email-templates";
import { formatDiscountInText, formatPromoDiscountLabel } from "./promo-code";
import type { NewsletterProductCard } from "./types";

function fmtPrice(n: number): string {
  return (
    Math.round(n).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " Kč"
  );
}

export type IntroVars = { jmeno?: string; firma?: string; sleva?: string };

/** Řádek, na jehož místo se vloží box s osobním slevovým kódem. */
export const CODE_MARKER = "{kod}";

/**
 * Text mailu se v adminu píše jako obyčejný text: prázdný řádek = nový odstavec,
 * Enter = zalomení, **tučně**. Starší kampaně mají uložené HTML (<p>…) — to se
 * pouští beze změny. Zástupné {jmeno}, {firma} a {sleva} se nahradí za příjemce.
 */
export function introToHtml(intro: string, vars: IntroVars): string {
  const raw = (intro || "").trim();
  if (!raw) return "";
  const fill = (s: string, escape: boolean) =>
    s.replace(/\{(jmeno|firma|sleva)\}/gi, (_, key: string) => {
      const v = vars[key.toLowerCase() as keyof IntroVars] || "";
      return escape ? escapeHtml(v) : v;
    });
  if (/<(p|br|strong|b|a|ul|div)\b/i.test(raw)) return fill(raw, true);
  return raw
    .split(/\n\s*\n/)
    .map((para) => {
      const html = fill(escapeHtml(para.trim()), false)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("\n");
}

function productCardsHtml(products: NewsletterProductCard[], heading: string): string {
  if (!products.length) return "";
  const cells = products.map((p) => {
    const img = p.imageUrl
      ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="150" style="display:block;width:150px;max-width:100%;height:auto;border-radius:6px;margin:0 auto 10px">`
      : `<div style="width:150px;height:100px;background:#f3f4f6;border-radius:6px;margin:0 auto 10px"></div>`;
    return `<td width="33%" style="width:33%;padding:6px;vertical-align:top">
  <a href="${escapeHtml(p.url)}" style="display:block;text-decoration:none;color:#1f2329;border:1px solid #e5e7eb;border-radius:8px;padding:12px 10px 14px;text-align:center">
    ${img}
    <div style="font-size:13px;font-weight:bold;line-height:1.35;margin-bottom:6px">${escapeHtml(p.name)}</div>
    <div style="font-size:13px;color:#1f2329">od <strong>${fmtPrice(p.fromPrice)}</strong></div>
    <div style="font-size:11px;color:#9ca3af">bez DPH</div>
  </a>
</td>`;
  });

  // Po 3 produktech zalomit řádek; neúplný řádek doplnit prázdnými buňkami, ať karty drží šířku.
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    const row = cells.slice(i, i + 3);
    while (row.length < 3 && cells.length > 3) row.push(`<td width="33%" style="width:33%;padding:6px"></td>`);
    rows.push(`<tr>${row.join("")}</tr>`);
  }
  return `<p style="margin:26px 0 4px;font-size:15px;font-weight:bold">${escapeHtml(heading)}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:4px -6px 8px">${rows.join("")}</table>`;
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
  /** Oslovení pro {jmeno} v textu (CZ v 5. pádě). */
  firstName?: string;
};

function codeBlockHtml(opts: { lead: string; code: string; howTo: string; validUntil: string | null }): string {
  const validLine = opts.validUntil
    ? `<br>Platnost do <strong>${escapeHtml(new Date(opts.validUntil).toLocaleDateString("cs-CZ"))}</strong>.`
    : "";
  return `<p style="text-align:center;margin:28px 0 8px;font-size:14px;color:#4b5563">${opts.lead}</p>
<p style="text-align:center;margin:8px 0 20px">
  <span style="display:inline-block;font-size:26px;font-weight:bold;letter-spacing:3px;background:#f4d03f;color:#1f2329;padding:14px 26px;border-radius:8px">${escapeHtml(opts.code)}</span>
</p>
<p style="background:#f7f8f9;border-left:3px solid #f4d03f;padding:12px 14px;margin:16px 0;color:#444">
${opts.howTo}${validLine}
</p>`;
}

function ctaHtml(url: string, label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:22px auto"><tr><td style="background:#f4d03f;border-radius:6px">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;color:#1f2329;font-weight:bold;text-decoration:none;font-size:15px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/**
 * Poskládá mail: oslovení → text nad kódem → produkty → kód → tlačítko → text pod kódem.
 * Když text neobsahuje {kod}, jde kód za celý text a na konec se přidá výchozí rozloučení.
 */
function composeBody(opts: {
  greeting: string;
  text: string;
  vars: IntroVars;
  defaultIntro: string;
  defaultClosing: string;
  products: NewsletterProductCard[];
  productsHeading: string;
  codeBlock: string;
  cta: string;
}): string {
  const raw = (opts.text || "").trim();
  const markerAt = raw.toLowerCase().indexOf(CODE_MARKER);
  const before = markerAt >= 0 ? raw.slice(0, markerAt) : raw;
  const after = markerAt >= 0 ? raw.slice(markerAt + CODE_MARKER.length) : "";
  const intro = introToHtml(before, opts.vars) || opts.defaultIntro;
  const closing = markerAt >= 0 ? introToHtml(after, opts.vars) : opts.defaultClosing;

  return `<p>${escapeHtml(opts.greeting)}</p>
${intro}
${productCardsHtml(opts.products, opts.productsHeading)}
${opts.codeBlock}
${opts.cta}
${closing}`;
}

/**
 * Tělo newsletteru (bez wrapEmailHtml) — stejný vizuální jazyk jako
 * potvrzení objednávky: žlutý box, tabulky, čisté Arial.
 */
export function buildNewsletterBodyHtml(input: NewsletterBodyInput): string {
  const sleva = formatDiscountInText(input.discountType, input.discountValue);
  return composeBody({
    greeting: input.greeting,
    text: input.introHtml,
    vars: { jmeno: input.firstName, sleva },
    defaultIntro: `<p>děkujeme, že jezdíš s RTS. Připravili jsme pro tebe slevu na reklamu od PROVLAJKY — plážové vlajky, stany i bannery vyrábíme na míru.</p>`,
    defaultClosing: `<p>Máš dotaz k rozměrům nebo grafice? Stačí odpovědět na tento e-mail.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`,
    products: input.products,
    productsHeading: "Vybrali jsme pro tebe",
    codeBlock: codeBlockHtml({
      lead: "Tvůj slevový kód:",
      code: input.code,
      howTo: `Kód zadej v objednávce na <a href="${escapeHtml(input.ctaUrl)}" style="color:#1f2329;font-weight:bold">provlajky.cz</a> a klikni na „Uplatnit“. Kód je jen tvůj.`,
      validUntil: input.validUntil,
    }),
    cta: ctaHtml(input.ctaUrl, input.ctaLabel || "Vybrat na Provlajky.cz"),
  });
}

/** Coldcall varianta — formálnější oslovení, individuální nabídka. */
export function buildColdcallBodyHtml(input: NewsletterBodyInput & { companyName: string }): string {
  const discountLabel = formatPromoDiscountLabel(input.discountType, input.discountValue);
  const sleva = formatDiscountInText(input.discountType, input.discountValue);
  return composeBody({
    greeting: "Dobrý den,",
    text: input.introHtml,
    vars: { firma: input.companyName, sleva },
    defaultIntro: `<p>ozýváme se z PROVLAJKY — vyrábíme plážové vlajky, nůžkové/nafukovací stany a bannery na míru. Pro <strong>${escapeHtml(input.companyName)}</strong> jsme připravili individuální nabídku.</p>`,
    defaultClosing: `<p>Rádi připravíme i cenovou nabídku na míru — stačí odpovědět na tento e-mail.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`,
    products: input.products,
    productsHeading: "Co pro vás vyrábíme",
    codeBlock: codeBlockHtml({
      lead: `Váš slevový kód na <strong>${escapeHtml(discountLabel)}</strong>:`,
      code: input.code,
      howTo: `Kód zadejte v objednávce na <a href="${escapeHtml(input.ctaUrl)}" style="color:#1f2329;font-weight:bold">provlajky.cz</a>.`,
      validUntil: input.validUntil,
    }),
    cta: ctaHtml(input.ctaUrl, input.ctaLabel || "Otevřít e-shop"),
  });
}
