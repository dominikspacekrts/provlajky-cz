import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, fmtMoney, isRealizedOrder } from "@/lib/domain";
import type { Order, OrderItem, Partner, Payout, SupplierInvoice } from "@/lib/types";
import AddPayoutForm from "./add-payout-form";

export const dynamic = "force-dynamic";

export default async function PlatbyPage() {
  const supabase = await createClient();

  const [{ data: orders }, { data: payouts }, { data: partners }, { data: supplierInvoices }] = await Promise.all([
    supabase.from("orders").select("*, order_items(*)"),
    supabase.from("payouts").select("*").order("date", { ascending: false }),
    supabase.from("partners").select("*"),
    supabase.from("supplier_invoices").select("*"),
  ]);

  const realizedOrders = ((orders || []) as (Order & { order_items: OrderItem[] })[]).filter(isRealizedOrder);
  const revenueEx = realizedOrders.reduce((sum, o) => sum + computeOrderTotals(o, o.order_items).totalEx, 0);
  const totalCostsCzk = ((supplierInvoices || []) as SupplierInvoice[]).reduce((sum, s) => sum + (s.amount_czk || 0), 0);
  const profit = revenueEx - totalCostsCzk;

  return (
    <div>
      <h2>Platby</h2>
      <p className="muted">Výdělky a výplaty partnerů podle jejich podílu na zisku.</p>

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
      {(partners || []).length === 0 && <p className="muted">Zatím žádní partneři (nastavíš v Nastavení).</p>}
    </div>
  );
}
