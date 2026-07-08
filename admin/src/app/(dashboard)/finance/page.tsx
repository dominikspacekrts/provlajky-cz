import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, fmtMoney, isRealizedOrder } from "@/lib/domain";
import type { Invoice, Order, OrderItem, Partner, Payout, SupplierInvoice } from "@/lib/types";
import PaidToggle from "./paid-toggle";
import AddPayoutForm from "./add-payout-form";

export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: orders }, { data: payouts }, { data: partners }, { data: supplierInvoices }] =
    await Promise.all([
      supabase.from("invoices").select("*").eq("kind", "product").order("issued", { ascending: false }),
      supabase.from("orders").select("*, order_items(*)"),
      supabase.from("payouts").select("*").order("date", { ascending: false }),
      supabase.from("partners").select("*"),
      supabase.from("supplier_invoices").select("*"),
    ]);

  const realizedOrders = ((orders || []) as (Order & { order_items: OrderItem[] })[]).filter(isRealizedOrder);
  const revenueEx = realizedOrders.reduce((sum, o) => sum + computeOrderTotals(o, o.order_items).totalEx, 0);
  const totalCostsCzk = ((supplierInvoices || []) as SupplierInvoice[]).reduce((sum, s) => sum + (s.amount_czk || 0), 0);
  const profit = revenueEx - totalCostsCzk;

  const unpaidCount = (invoices || []).filter((i) => !i.paid).length;

  return (
    <div>
      <h2>Finance</h2>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="label">Tržby realizovaných objednávek (bez DPH)</div>
          <div className="value">{fmtMoney(revenueEx, "CZK")}</div>
        </div>
        <div className="stat-card">
          <div className="label">Náklady (dodavatelské faktury)</div>
          <div className="value">{fmtMoney(totalCostsCzk, "CZK")}</div>
        </div>
        <div className="stat-card">
          <div className="label">Zisk</div>
          <div className="value">{fmtMoney(profit, "CZK")}</div>
        </div>
        <div className="stat-card">
          <div className="label">Nezaplacené faktury</div>
          <div className="value">{unpaidCount}</div>
        </div>
      </div>

      <h3>Výdělky partnerů</h3>
      {((partners || []) as Partner[]).map((p) => {
        const earned = profit * (p.share / 100);
        const paidOut = ((payouts || []) as Payout[])
          .filter((po) => po.partner_id === p.id)
          .reduce((s, po) => s + Number(po.amount), 0);
        const remaining = earned - paidOut;
        return (
          <div key={p.id} className="earnings-partner">
            <div>
              <div className="ep-name">{p.name}</div>
              <div className="ep-meta">
                Podíl {p.share} % · Vyplaceno {fmtMoney(paidOut, "CZK")}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div className="ep-amount">{fmtMoney(remaining, "CZK")}</div>
              <AddPayoutForm partnerId={p.id} partnerName={p.name} />
            </div>
          </div>
        );
      })}

      <h3>Faktury</h3>
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
            </div>
          </div>
        ))}
        {(invoices || []).length === 0 && <p className="muted">Zatím žádné faktury.</p>}
      </div>
    </div>
  );
}
