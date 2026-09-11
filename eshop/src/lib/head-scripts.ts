import { CONSENT_COOKIE, CONSENT_VERSION } from "./consent";
import { GTM_ID, SITE_ENV } from "./site";

// Skripty do <head> v přesně daném pořadí. Pořadí je celé jádro Consent Mode v2:
//
//   1) consent default (všechno denied) — MUSÍ být dřív než GTM, jinak GTM
//      stihne odpálit tagy bez souhlasu,
//   2) consent update z cookie, pokud už návštěvník dřív rozhodl,
//   3) site_env — agentura podle něj v GTM odfiltruje testovací provoz,
//   4) samotný GTM.
//
// Proto se vrací jako hotový HTML řetězec do jednoho <head> a ne přes
// next/script: u `afterInteractive` by GTM mohl naběhnout dřív než default.

function consentBootScript(withGtm: boolean) {
  // Pozn.: běží před hydratací, takže čistý ES5 bez závislostí.
  const gtmStart = withGtm ? `\ndataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });` : "";
  return (`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
try {
  var m = document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
  if (m) {
    var saved = JSON.parse(decodeURIComponent(m[1]));
    if (saved && saved.version === ${CONSENT_VERSION}) {
      var ads = saved.marketing ? 'granted' : 'denied';
      gtag('consent', 'update', {
        ad_storage: ads,
        ad_user_data: ads,
        ad_personalization: ads,
        analytics_storage: saved.analytics ? 'granted' : 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted'
      });
    }
  }
} catch (e) {}
dataLayer.push({ site_env: '${SITE_ENV}' });` + gtmStart).trim();
}

// Oficiální GTM snippet si značku <script> vkládá do hlavičky sám přes JS —
// tím ale zmutuje DOM a React při hydrataci hlásí rozpor s tím, co vyrenderoval
// server. Statický tag dělá přesně totéž (start pushuje boot skript výš),
// jen se DOM nemění.
function gtmTag(gtmId: string) {
  return `<script async src="https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}"></script>`;
}

/**
 * Sestaví obsah <head> — consent + GTM, a za nimi teprve marketingový snippet
 * z adminu (Nastavení → Marketing), aby i ručně vložený kód běžel až po consentu.
 */
export function buildHeadHtml(marketingSnippet: string | null) {
  const parts = [`<script>${consentBootScript(!!GTM_ID)}</script>`];
  if (GTM_ID) parts.push(gtmTag(GTM_ID));
  if (marketingSnippet) parts.push(marketingSnippet);
  return parts.join("\n");
}

/** `<noscript>` iframe GTM — patří hned za otevírací <body>. */
export function gtmNoscriptHtml() {
  if (!GTM_ID) return null;
  return `<iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
}
