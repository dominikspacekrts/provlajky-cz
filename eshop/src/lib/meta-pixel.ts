// Meta Pixel v prohlížeči. ID je veřejné (je v HTML), token Conversions API
// sem nepatří — ten žije jen na serveru v META_CAPI_ACCESS_TOKEN.
//
// Základní kód je v <head> na každé stránce (jak říká Meta). Události jdou
// ven teprve po marketingovém souhlasu přes fbq('consent', …). Na neprodukci
// se nenačte, ať testovací provoz nepadá do ostrého reklamního účtu.

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

/** Sync marketingového souhlasu do pixelu. Vrací true, když smí posílat eventy. */
export function syncMetaConsent() {
  if (typeof window === "undefined" || !metaPixelEnabled() || !window.fbq) return false;
  const allowed = !!readConsent()?.marketing;
  window.fbq("consent", allowed ? "grant" : "revoke");
  return allowed;
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
  if (!readConsent()?.marketing) return;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    const trimmed = value.trim();
    if (trimmed) cleaned[key] = trimmed;
  }
  if (Object.keys(cleaned).length === 0) return;
  window.fbq("init", META_PIXEL_ID, cleaned);
}

/**
 * Oficiální Meta Pixel do <head> — na každé stránce. Souhlas řídí
 * fbq('consent'): bez marketingové cookie zůstane revoke, eventy neodejdou.
 */
export function metaPixelHeadHtml() {
  if (!metaPixelEnabled()) return "";
  return `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'${FBE_SRC}');
fbq('consent', 'revoke');
try {
  var m = document.cookie.match(/(?:^|; )${CONSENT_COOKIE}=([^;]*)/);
  if (m) {
    var saved = JSON.parse(decodeURIComponent(m[1]));
    if (saved && saved.version === ${CONSENT_VERSION} && saved.marketing === true) {
      fbq('consent', 'grant');
    }
  }
} catch (e) {}
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
window.__metaPixelBooted = true;
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`;
}
