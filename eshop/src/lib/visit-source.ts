// Zařazení návštěvy podle značek z reklamních účtů a UTM (newsletter / e-mail).
// Ukládá se jen zdroj, ne samotné klikací ID.

export const VISIT_SOURCES = [
  "email",
  "google_ads",
  "meta",
  "sklik",
  "mergado",
  "google",
  "seznam",
  "direct",
  "other",
] as const;

export type VisitSource = (typeof VISIT_SOURCES)[number];

export const VISIT_SOURCE_LABELS: Record<VisitSource, string> = {
  email: "E-mail / newsletter",
  google_ads: "Google Ads",
  meta: "Meta",
  sklik: "Sklik",
  mergado: "Mergado",
  google: "Google (vyhledávání)",
  seznam: "Seznam",
  direct: "Přímá návštěva",
  other: "Ostatní",
};

const PAID = /cpc|ppc|paid|cpm|ads/;
const EMAIL_MEDIUM = /^(email|e-?mail|newsletter|mail)$/;
const EMAIL_SOURCE = /^(email|e-?mail|newsletter|newsletter_coldcall|resend|mailchimp)$/;

export type VisitSignals = {
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  gadSource?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  fbclid?: string | null;
  sznclid?: string | null;
};

function hostOf(referrer: string | null | undefined): string {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function classifyVisit(signals: VisitSignals): VisitSource {
  const src = (signals.utmSource || "").trim().toLowerCase();
  const medium = (signals.utmMedium || "").trim().toLowerCase();
  const campaign = (signals.utmCampaign || "").trim().toLowerCase();
  const host = hostOf(signals.referrer);
  const paid = PAID.test(medium);

  if (EMAIL_MEDIUM.test(medium) || EMAIL_SOURCE.test(src) || campaign.includes("newsletter")) {
    return "email";
  }

  if (
    signals.gclid ||
    signals.wbraid ||
    signals.gbraid ||
    signals.gadSource ||
    src === "google_ads" ||
    src === "adwords" ||
    (src === "google" && paid)
  ) {
    return "google_ads";
  }

  if (
    signals.fbclid ||
    src === "meta" ||
    src === "facebook" ||
    src === "instagram" ||
    src === "ig" ||
    src === "fb" ||
    host.endsWith("facebook.com") ||
    host.endsWith("instagram.com") ||
    host === "fb.com" ||
    host.endsWith(".fb.com")
  ) {
    return "meta";
  }

  if (signals.sznclid || src === "sklik" || (src === "seznam" && paid)) {
    return "sklik";
  }

  if (src === "mergado" || host.includes("mergado")) {
    return "mergado";
  }

  if (src === "google" || host.includes("google.") || host === "google.com") {
    return "google";
  }

  if (src === "seznam" || host.endsWith("seznam.cz")) {
    return "seznam";
  }

  if (!src && !host) return "direct";
  return "other";
}
