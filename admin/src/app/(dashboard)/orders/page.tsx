import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, customerLabel, fmtMoney, orderLabel, orderSource, statusClass, statusLabel } from "@/lib/domain";
import { ORDER_LIST_ITEMS_SELECT, ORDER_LIST_SELECT } from "@/lib/perf-selects";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("orders")
    .select(`${ORDER_LIST_SELECT}, order_items(${ORDER_LIST_ITEMS_SELECT})`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return <p style={{ color: "#dc2626" }}>Chyba načtení objednávek: {error.message}</p>;
  }

  const orders = (data || []) as (Order & { order_items: OrderItem[] })[];
  const total = count ?? orders.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="row-between">
        <h2>Objednávky</h2>
        <Link href="/orders/new" className="btn primary">
          + Nová objednávka
        </Link>
      </div>
      <div className="orders-list">
        {orders.length === 0 && <p className="muted">Zatím žádné objednávky.</p>}
        {orders.map((o) => {
          const totals = computeOrderTotals(o, o.order_items || []);
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="order-card">
              <div>
                <div className="title">
                  {orderLabel(o)}{" "}
                  <span className={`source-pill src-${orderSource(o)}`}>
                    {orderSource(o) === "eshop" ? "eshop" : "manuál"}
                  </span>
                </div>
                <div className="meta">
                  {customerLabel(o)} · {new Date(o.created_at).toLocaleDateString("cs-CZ")} ·{" "}
                  <span className={`status-badge ${statusClass(o.status)}`}>
                    {statusLabel(o.status)}
                  </span>{" "}
                  <span className={`sup-pill ${o.supplier_paid ? "sup-paid" : "sup-unpaid"}`} style={{ cursor: "default" }}>
                    {o.supplier_paid ? "Dodavatel zaplacen" : "Dodavatel nezaplacen"}
                  </span>
                </div>
              </div>
              <div className="order-money">
                <div className="om-total">{fmtMoney(totals.grand, o.currency)}</div>
                <div className="meta">{(o.order_items || []).length} položek</div>
              </div>
            </Link>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="row-between" style={{ marginTop: 16, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {from + 1}–{Math.min(to + 1, total)} z {total}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {page > 1 ? (
              <Link className="btn" href={`/orders?page=${page - 1}`}>
                ← Novější
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link className="btn" href={`/orders?page=${page + 1}`}>
                Starší →
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
