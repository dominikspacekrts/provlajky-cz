// Souhlas s cookies (Consent Mode v2). Jediné místo, které rozhoduje o tom,
// co se ukládá a co se posílá do GTM.
//
// Souhlas žije ve first-party cookie, aby ho viděl i inline skript v <head>,
// který musí nastavit consent JEŠTĚ PŘED načtením GTM (viz lib/head-scripts.ts).
// localStorage by se v <head> číst nedal dost brzy a hlavně by ho neviděl server.

export const CONSENT_COOKIE = "provlajky_consent";

// Zvýšením verze se u všech návštěvníků vynutí nový souhlas (např. když
// přibude nová kategorie nebo se změní účel zpracování).
export const CONSENT_VERSION = 1;

export const CONSENT_MAX_AGE_DAYS = 183; // ~6 měsíců

export type ConsentState = {
  version: number;
  analytics: boolean;
  marketing: boolean;
};

export const CONSENT_ALL: ConsentState = { version: CONSENT_VERSION, analytics: true, marketing: true };
export const CONSENT_NONE: ConsentState = { version: CONSENT_VERSION, analytics: false, marketing: false };

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    // Starší verze souhlasu se ignoruje — lišta se zobrazí znovu.
    if (parsed?.version !== CONSENT_VERSION) return null;
    return {
      version: CONSENT_VERSION,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
}

export function readConsent(): ConsentState | null {
  return parseConsent(readConsentRaw());
}

/** Syrová hodnota cookie — primitiv, aby se dal použít jako snapshot ve store. */
export function readConsentRaw(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  return match?.[1] ?? null;
}

// Na serveru se cookie přečíst nedá, takže se lišta nerenderuje vůbec a o jejím
// zobrazení rozhodne až klient. Díky tomu nebliká vracejícím se návštěvníkům,
// kteří už souhlas dali.
export const CONSENT_UNKNOWN = "__ssr__";

export function serverConsentSnapshot(): string {
  return CONSENT_UNKNOWN;
}

const consentListeners = new Set<() => void>();

export function subscribeConsent(onChange: () => void) {
  consentListeners.add(onChange);
  return () => {
    consentListeners.delete(onChange);
  };
}

export function writeConsent(state: ConsentState) {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(JSON.stringify(state));
  const maxAge = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

// Převod našich kategorií na signály Consent Mode v2.
export function consentSignals(state: ConsentState) {
  return {
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
    analytics_storage: state.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    security_storage: "granted",
  } as const;
}

type DataLayerValue = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: DataLayerValue[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Uloží souhlas a okamžitě ho promítne do GTM: nejdřív consent update,
// pak event, na který se dá v GTM navěsit trigger (Sklik ho potřebuje jako
// parametr tagu, proto jsou hodnoty i v dataLayer zvlášť).
export function applyConsent(state: ConsentState) {
  writeConsent(state);
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.gtag?.("consent", "update", consentSignals(state));
  window.dataLayer.push({
    event: "consent_update",
    consent_analytics: state.analytics,
    consent_marketing: state.marketing,
  });
  consentListeners.forEach((listener) => listener());
}
