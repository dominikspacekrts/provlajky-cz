import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, customerLabel, fmtMoney, statusClass, statusLabel } from "@/lib/domain";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return <p style={{ color: "#dc2626" }}>Chyba načtení objednávek: {error.message}</p>;
  }

  const orders = (data || []) as (Order & { order_items: OrderItem[] })[];

  return (
    <div>
      <div className="row-between">
        <h2>Objednávky</h2>
      </div>
      <div className="orders-list">
        {orders.length === 0 && <p className="muted">Zatím žádné objednávky.</p>}
        {orders.map((o) => {
          const totals = computeOrderTotals(o, o.order_items);
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="order-card">
              <div>
                <div className="title">
                  {o.title || `Objednávka č. ${o.order_number || "—"}`}
                </div>
                <div className="meta">
                  {customerLabel(o)} · {new Date(o.created_at).toLocaleDateString("cs-CZ")} ·{" "}
                  <span className={`status-badge ${statusClass(o.status)}`}>
                    {statusLabel(o.status)}
                  </span>
                </div>
              </div>
              <div className="order-money">
                <div className="om-total">{fmtMoney(totals.grand, o.currency)}</div>
                <div className="meta">{o.order_items.length} položek</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
