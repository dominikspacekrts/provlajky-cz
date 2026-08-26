import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/actions/settings";
import {
  computeOrderProfit,
  fmtMoney,
  isRealizedOrder,
  itemMargin,
  PLATFORM_FEE_PCT,
  splitItemMarginByPartners,
  type ProductLookup,
} from "@/lib/domain";
import type { Order, OrderItem, Partner, Payout, Product, SupplierInvoice } from "@/lib/types";
import AddPayoutForm from "./add-payout-form";
import DeletePayoutButton from "./delete-payout-button";

export const dynamic = "force-dynamic";

export default async function PlatbyPage() {
  const supabase = await createClient();

  const [{ data: orders }, { data: payouts }, { data: partners }, { data: supplierInvoices }, { data: products }, settings] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "*, order_items(id, unit_price, qty, vat_rate, size, width_cm, height_cm, product_id, material, variant_id, option_id, wc_line_name, partner_ids)"
        ),
      supabase.from("payouts").select("*").order("date", { ascending: false }),
      supabase.from("partners").select("*"),
      supabase.from("supplier_invoices").select("*"),
      supabase.from("products").select("*"),
      getSettings(),
    ]);

  const realizedOrders = ((orders || []) as (Order & { order_items: OrderItem[] })[]).filter(isRealizedOrder);
  const productById = new Map<string, ProductLookup>(((products || []) as Product[]).map((p) => [p.id, p]));
  // Zisk počítáme za každou objednávku zvlášť (computeOrderProfit): pokud
  // má reálnou fakturu od dodavatele, použije se ta (přesně), jinak spadne
  // na odhad z nákupních cen u produktů — stejný odhad, ze kterého se
  // počítá i rozdělení mezi partnery níž, ať si ta dvě čísla neodporují
  // (dřív se tu odečítala jen SUMA VŠECH faktur bez ohledu na objednávku —
  // u objednávek bez faktury to tak vycházel zisk = celý obrat, bez nákladů).
  let profit = 0;
  let allExact = true;
  for (const o of realizedOrders) {
    const orderInvoices = ((supplierInvoices || []) as SupplierInvoice[]).filter((s) => s.order_id === o.id);
    const { profit: orderProfit, exact } = computeOrderProfit(o, o.order_items || [], orderInvoices, productById, settings.cost_per_size);
    profit += orderProfit;
    if (!exact) allExact = false;
  }

  // Rozdělení zisku mezi partnery jde podle jednotlivých položek objednávek
  // (viz products.partner_ids / order_items.partner_ids v detailu objednávky
  // — rovný díl mezi vybranými partnery), ne podle starého fixního % podílu
  // z celkového zisku firmy. Předtím se z položkové marže strhne provozní
  // poplatek (PLATFORM_FEE_PCT, viz domain.ts) — ten se mezi partnery
  // nedělí, jde na chod webu/účetní/atd. U objednávek bez reálné faktury je
  // marže odhad z nákupních cen, ze kterého se počítá i "Zisk celkem" výše
  // — obě čísla teď spolu sedí (viz computeOrderProfit / itemMargin výš).
  const earnedByPartner = new Map<string, number>();
  let unassigned = 0;
  let unknownMarginItems = 0;
  let operatingCosts = 0;
  for (const o of realizedOrders) {
    for (const it of o.order_items || []) {
      const margin = itemMargin(it, productById, settings.cost_per_size);
      if (margin == null) {
        unknownMarginItems++;
        continue;
      }
      const fee = (it.unit_price || 0) * (it.qty || 0) * PLATFORM_FEE_PCT;
      operatingCosts += fee;
      const distributable = margin - fee;
      const split = splitItemMarginByPartners(distributable, it.partner_ids || []);
      if (split.size === 0) {
        unassigned += distributable;
        continue;
      }
      for (const [partnerId, amount] of split) {
        earnedByPartner.set(partnerId, (earnedByPartner.get(partnerId) || 0) + amount);
      }
    }
  }
  profit -= operatingCosts;

  return (
    <div>
      <h2>Platby</h2>
      <p className="muted">
        Výdělky a výplaty partnerů podle toho, komu se která položka objednávky přiřadila (nastavuje se v detailu
        objednávky, přednastaveno podle partnerů zvolených u produktu).
      </p>

      <div className="stats-cards" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="label">
            Zisk k rozdělení (tržby − náklady dodavatele − provoz){!allExact && " · odhad"}
          </div>
          <div className="value">{fmtMoney(profit, "CZK")}</div>
          {!allExact && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Některé objednávky nemají nahranou fakturu od dodavatele — u nich se počítá s odhadem z nákupních cen
              produktů.
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="label">Provozní náklady ({Math.round(PLATFORM_FEE_PCT * 100)} % z tržeb)</div>
          <div className="value">{fmtMoney(operatingCosts, "CZK")}</div>
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
        const partnerPayouts = ((payouts || []) as Payout[])
          .filter((po) => po.partner_id === p.id)
          .sort((a, b) => (a.date < b.date ? 1 : -1));
        const paidOut = partnerPayouts.reduce((s, po) => s + Number(po.amount), 0);
        const remaining = earned - paidOut;
        return (
          <div key={p.id} className="earnings-partner-card">
            <div className="earnings-partner">
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
            {partnerPayouts.length > 0 && (
              <div className="ep-payout-list">
                {partnerPayouts.map((po) => (
                  <div key={po.id} className="ep-payout-row">
                    <span>{new Date(po.date).toLocaleDateString("cs-CZ")}</span>
                    <span>{fmtMoney(Number(po.amount), "CZK")}</span>
                    <DeletePayoutButton payoutId={po.id} amount={Number(po.amount)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {(partners || []).length === 0 && <p className="muted">Zatím žádní partneři (nastavíš v Nastavení).</p>}
    </div>
  );
}
