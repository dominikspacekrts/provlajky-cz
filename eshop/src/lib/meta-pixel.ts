// Meta Pixel v prohlížeči. ID je veřejné (je v HTML), token Conversions API
// sem nepatří — ten žije jen na serveru v META_CAPI_ACCESS_TOKEN.
//
// Pixel se nespustí bez marketingového souhlasu. Na neprodukci se nenačte
// vůbec, ať testovací provoz nepadá do ostrého reklamního účtu.

import { CONSENT_COOKIE, CONSENT_VERSION, readConsent } from "./consent";
import { isProduction } from "./site";

export const META_PIXEL_ID = "1647906236926274";

const FBE_SRC = "https://connect.facebook.net/en_US/fbevents.js";

type MetaFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
  push: MetaFbq;
};

declare global {
  interface Window {
    fbq?: MetaFbq;
    _fbq?: MetaFbq;
    __metaPixelBooted?: boolean;
  }
}

export function metaPixelEnabled() {
  return isProduction();
}

function installStub() {
  if (window.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as MetaFbq;
  if (!window._fbq) window._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
}

function loadLibrary() {
  if (document.querySelector(`script[src="${FBE_SRC}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = FBE_SRC;
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);
}

/** Zapne pixel, pokud je marketingový souhlas. Vrací true, když pixel běží. */
export function activateMetaPixel() {
  if (typeof window === "undefined" || !metaPixelEnabled()) return false;
  if (!readConsent()?.marketing) {
    if (window.fbq && window.__metaPixelBooted) window.fbq("consent", "revoke");
    return false;
  }
  const already = !!window.__metaPixelBooted;
  installStub();
  loadLibrary();
  if (!already) window.fbq?.("init", META_PIXEL_ID);
  else window.fbq?.("consent", "grant");
  window.__metaPixelBooted = true;
  return true;
}

export function trackMeta(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !window.__metaPixelBooted || !window.fbq) return;
  if (!readConsent()?.marketing) return;
  if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
  else if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}

/** Pokročilé párování — pixel si hodnoty zahashuje sám. Prázdné klíče se vynechají. */
export function setMetaAdvancedMatching(data: Record<string, string>) {
  if (typeof window === "undefined" || !window.__metaPixelBooted || !window.fbq) return;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const trimmed = value.trim();
    if (trimmed) cleaned[key] = trimmed;
  }
  if (Object.keys(cleaned).length === 0) return;
  window.fbq("init", META_PIXEL_ID, cleaned);
}

/**
 * Skript do <head>. Knihovnu vloží jen když už v cookie je marketingový
 * souhlas — bez souhlasu se na Facebook nic nepošle. `<noscript>` obrázek
 * ze šablony od agentury tu schválně není: neumí souhlas zkontrolovat.
 */
export function metaPixelHeadScript() {
  if (!metaPixelEnabled()) return "";
  return `
try {
  var m = document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
  if (!m) throw 0;
  var saved = JSON.parse(decodeURIComponent(m[1]));
  if (!saved || saved.version !== ${CONSENT_VERSION} || saved.marketing !== true) throw 0;
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  '${FBE_SRC}');
  fbq('init', '${META_PIXEL_ID}');
  fbq('track', 'PageView');
  window.__metaPixelBooted = true;
} catch (e) {}
`.trim();
}
