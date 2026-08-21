import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, fmtMoney, isRealizedOrder } from "@/lib/domain";
import type { Order, OrderItem, SupplierInvoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatistikaPage() {
  const supabase = await createClient();

  const [{ data: invoices }, { data: orders }, { data: supplierInvoices }] = await Promise.all([
    supabase.from("invoices").select("id, paid").eq("kind", "product"),
    supabase.from("orders").select("*, order_items(*)"),
    supabase.from("supplier_invoices").select("*"),
  ]);

  const realizedOrders = ((orders || []) as (Order & { order_items: OrderItem[] })[]).filter(isRealizedOrder);
  const revenueEx = realizedOrders.reduce((sum, o) => sum + computeOrderTotals(o, o.order_items).totalEx, 0);
  const totalCostsCzk = ((supplierInvoices || []) as SupplierInvoice[]).reduce((sum, s) => sum + (s.amount_czk || 0), 0);
  const profit = revenueEx - totalCostsCzk;
  const unpaidCount = (invoices || []).filter((i) => !i.paid).length;
  const orderCount = (orders || []).length;

  return (
    <div>
      <h2>Statistika</h2>
      <p className="muted">Přehled tržeb, nákladů a zisku napříč realizovanými objednávkami.</p>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="label">Objednávek celkem</div>
          <div className="value">{orderCount}</div>
        </div>
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
    </div>
  );
}
