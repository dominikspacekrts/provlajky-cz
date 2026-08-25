import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/actions/settings";
import {
  computeOrderTotals,
  fmtMoney,
  isRealizedOrder,
  itemMargin,
  splitItemMarginByPartners,
  type ProductLookup,
} from "@/lib/domain";
import type { Order, OrderItem, Partner, Payout, Product, SupplierInvoice } from "@/lib/types";
import AddPayoutForm from "./add-payout-form";

export const dynamic = "force-dynamic";

export default async function PlatbyPage() {
  const supabase = await createClient();

  const [{ data: orders }, { data: payouts }, { data: partners }, { data: supplierInvoices }, { data: products }, settings] =
    await Promise.all([
      supabase.from("orders").select("*, order_items(*)"),
      supabase.from("payouts").select("*").order("date", { ascending: false }),
      supabase.from("partners").select("*"),
      supabase.from("supplier_invoices").select("*"),
      supabase.from("products").select("*"),
      getSettings(),
    ]);

  const realizedOrders = ((orders || []) as (Order & { order_items: OrderItem[] })[]).filter(isRealizedOrder);
  const revenueEx = realizedOrders.reduce((sum, o) => sum + computeOrderTotals(o, o.order_items).totalEx, 0);
  const totalCostsCzk = ((supplierInvoices || []) as SupplierInvoice[]).reduce((sum, s) => sum + (s.amount_czk || 0), 0);
  const profit = revenueEx - totalCostsCzk;

  // Rozdělení zisku mezi partnery jde podle jednotlivých položek objednávek
  // (viz products.partner_ids / order_items.partner_ids v detailu objednávky
  // — rovný díl mezi vybranými partnery), ne podle starého fixního % podílu
  // z celkového zisku firmy. Tenhle odhad je z nákupních cen u produktů, ne
  // z reálných faktur dodavatele, takže se přesně nemusí shodovat s "Zisk
  // celkem" výše — je to průběžný odhad, ne účetní číslo.
  const productById = new Map<string, ProductLookup>(((products || []) as Product[]).map((p) => [p.id, p]));
  const earnedByPartner = new Map<string, number>();
  let unassigned = 0;
  let unknownMarginItems = 0;
  for (const o of realizedOrders) {
    for (const it of o.order_items || []) {
      const margin = itemMargin(it, productById, settings.cost_per_size);
      if (margin == null) {
        unknownMarginItems++;
        continue;
      }
      const split = splitItemMarginByPartners(margin, it.partner_ids || []);
      if (split.size === 0) {
        unassigned += margin;
        continue;
      }
      for (const [partnerId, amount] of split) {
        earnedByPartner.set(partnerId, (earnedByPartner.get(partnerId) || 0) + amount);
      }
    }
  }

  return (
    <div>
      <h2>Platby</h2>
      <p className="muted">
        Výdělky a výplaty partnerů podle toho, komu se která položka objednávky přiřadila (nastavuje se v detailu
        objednávky, přednastaveno podle partnerů zvolených u produktu).
      </p>

      <div className="stats-cards" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">Zisk celkem (tržby − náklady dodavatele)</div>
          <div className="value">{fmtMoney(profit, "CZK")}</div>
        </div>
        <div className="stat-card">
          <div className="label">Nerozděleno mezi partnery</div>
          <div className="value">{fmtMoney(unassigned, "CZK")}</div>
        </div>
      </div>
      {unknownMarginItems > 0 && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {unknownMarginItems} položek nemá známou marži (chybí nákupní cena u produktu/volby, nebo položka nemá
          vazbu na produkt) — do rozdělení se nepočítají.
        </p>
      )}

      <h3>Výdělky partnerů</h3>
      {((partners || []) as Partner[]).map((p) => {
        const earned = earnedByPartner.get(p.id) || 0;
        const paidOut = ((payouts || []) as Payout[])
          .filter((po) => po.partner_id === p.id)
          .reduce((s, po) => s + Number(po.amount), 0);
        const remaining = earned - paidOut;
        return (
          <div key={p.id} className="earnings-partner">
            <div>
              <div className="ep-name">{p.name}</div>
              <div className="ep-meta">
                Vydělal {fmtMoney(earned, "CZK")} · Vyplaceno {fmtMoney(paidOut, "CZK")}
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
