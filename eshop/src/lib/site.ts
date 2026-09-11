// Jediný zdroj pravdy pro doménu a prostředí — používá se ve feedech produktů,
// sitemapě, robots.txt, canonical/OG odkazech a v proxy (noindex, basic auth).
//
// Všechno jde z env proměnných, nikdy se neodvozuje z domény v kódu: dev i
// produkce běží ze stejného buildu a liší se jen konfigurací ve Vercelu.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://provlajky.cz";

export type SiteEnv = "production" | "development";

export const SITE_ENV: SiteEnv = process.env.NEXT_PUBLIC_SITE_ENV === "production" ? "production" : "development";

export function isProduction() {
  return SITE_ENV === "production";
}

// GTM kontejner. Prázdná hodnota = GTM se vůbec nenačte (lokální vývoj).
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "";
