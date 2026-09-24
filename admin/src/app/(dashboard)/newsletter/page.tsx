import { getNewsletterBootstrap } from "@/lib/actions/newsletter";
import NewsletterClient from "./newsletter-client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function NewsletterPage() {
  let data: Awaited<ReturnType<typeof getNewsletterBootstrap>> | null = null;
  let bootError: string | null = null;
  try {
    data = await getNewsletterBootstrap();
  } catch (e) {
    bootError =
      e instanceof Error
        ? e.message
        : "Nepodařilo se načíst data. Spusť migraci admin/supabase/2026-09-newsletter.sql.";
  }

  if (!data) {
    return (
      <div className="nl">
        <header className="nl-head">
          <div>
            <h2>Newsletter</h2>
          </div>
        </header>
        <div className="nl-alert" role="alert">
          {bootError || "Chybí tabulky newsletteru."}
          <br />
          V Supabase SQL Editoru spusť soubor <code>admin/supabase/2026-09-newsletter.sql</code>.
        </div>
      </div>
    );
  }

  return (
    <NewsletterClient
      riders={data.riders}
      companies={data.companies}
      products={data.products}
      campaigns={data.campaigns}
      campaignStats={data.campaignStats}
      resendReady={data.resendReady}
      fromAddress={data.fromAddress}
    />
  );
}
