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
      <div>
        <h2>Newsletter</h2>
        <p style={{ background: "#fef2f2", borderLeft: "3px solid #ef4444", padding: "12px 14px" }}>
          {bootError || "Chybí tabulky newsletteru."}
          <br />
          <span className="muted">
            V Supabase SQL Editoru spusť soubor <code>admin/supabase/2026-09-newsletter.sql</code>.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>Newsletter</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        Jezdci RTS (CSV import CZ/SK) a coldcall firmy. Odesílání přes Resend
        {data.resendReady ? (
          <span className="status-badge status-completed" style={{ marginLeft: 8 }}>
            Resend OK
          </span>
        ) : (
          <span className="status-badge status-pending" style={{ marginLeft: 8 }}>
            Chybí RESEND_API_KEY / RESEND_FROM_EMAIL
          </span>
        )}
      </p>
      <NewsletterClient
        initialRiders={data.riders}
        initialCompanies={data.companies}
        products={data.products}
        campaigns={data.campaigns}
        resendReady={data.resendReady}
      />
    </div>
  );
}
