import { createServiceClient } from "./supabase";

// Konverzní/sledovací kódy (Google Ads, Meta Pixel, GA4…) vložené v adminu
// (Nastavení → Marketing) — vkládají se do <head> na každé stránce.
// settings.marketing je čitelné jen pro přihlášené adminy (RLS), takže tu
// musí jít service-role klient; nikdy nic z tohohle souboru neimportuj do
// klientské komponenty.
export async function getMarketingHeadSnippet(): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("settings").select("marketing").eq("id", 1).single();
    if (error || !data) return null;
    const snippet = (data.marketing as { headSnippet?: string } | null)?.headSnippet;
    return snippet && snippet.trim() ? snippet : null;
  } catch {
    // sloupec marketing ještě nemusí existovat (migrace neproběhla) — web
    // prostě jede dál bez konverzních kódů.
    return null;
  }
}
