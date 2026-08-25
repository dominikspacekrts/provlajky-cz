import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/domain";
import type { Invoice } from "@/lib/types";
import PaidToggle from "./paid-toggle";
import DeleteInvoiceButton from "./delete-invoice-button";

export const dynamic = "force-dynamic";

export default async function FakturyPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("kind", "product")
    .order("issued", { ascending: false });

  return (
    <div>
      <h2>Faktury</h2>
      <p className="muted">Vystavené faktury k objednávkám.</p>

      <div className="orders-list">
        {((invoices || []) as Invoice[]).map((inv) => (
          <div key={inv.id} className="order-card invoice-card" style={{ cursor: "default" }}>
            <div>
              <div className="title">Faktura č. {inv.number}</div>
              <div className="meta">
                {inv.order_number ? `Objednávka č. ${inv.order_number} · ` : ""}
                Vystaveno {new Date(inv.issued).toLocaleDateString("cs-CZ")} · Splatnost{" "}
                {inv.due ? new Date(inv.due).toLocaleDateString("cs-CZ") : "—"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div className="order-money">
                <div className="om-total">{fmtMoney(inv.totals?.grand || 0, inv.currency)}</div>
              </div>
              <a className="btn" href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                PDF
              </a>
              <PaidToggle invoiceId={inv.id} paid={inv.paid} />
              <DeleteInvoiceButton invoiceId={inv.id} invoiceNumber={inv.number} orderId={inv.order_id} />
            </div>
          </div>
        ))}
        {(invoices || []).length === 0 && <p className="muted">Zatím žádné faktury.</p>}
      </div>
    </div>
  );
}
