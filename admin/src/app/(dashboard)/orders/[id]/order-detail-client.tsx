"use client";

import { useState, useTransition } from "react";
import {
  addOrderItem,
  deleteOrderItem,
  updateItemSleeveColor,
  updateOrderItem,
  updateOrderMoney,
  updateOrderStatus,
} from "@/lib/actions/orders";
import { ALL_STATUSES, computeOrderTotals, customerLabel, fmtMoney, isBanner, statusClass } from "@/lib/domain";
import type { Invoice, Order, OrderItem, SupplierInvoice } from "@/lib/types";
import SendInvoiceButton from "./send-invoice-button";
import SendVisualButton from "./send-visual-button";
import SendSupplierButton from "./send-supplier-button";
import SupplierPaidToggle from "./supplier-paid-toggle";
import SupplierInvoices from "./supplier-invoices";

const SHAPES = ["A", "B", "C", "D", "E", "F"];
const SIZES = ["S", "M", "L", "XL"];

export default function OrderDetailClient({
  order,
  items,
  invoice,
  supplierInvoices,
}: {
  order: Order;
  items: OrderItem[];
  invoice: Invoice | null;
  supplierInvoices: SupplierInvoice[];
}) {
  const [isPending, startTransition] = useTransition();
  const [discountPct, setDiscountPct] = useState(order.discount_pct || 0);
  const [shipping, setShipping] = useState(order.shipping || 0);

  const totals = computeOrderTotals({ ...order, discount_pct: discountPct, shipping }, items);
  const b = order.customer?.billing || {};
  const s = order.customer?.shipping || {};

  function setDiscount(pct: number) {
    setDiscountPct(pct);
    startTransition(() => updateOrderMoney(order.id, { discount_pct: pct }));
  }

  function saveShipping(v: number) {
    setShipping(v);
    startTransition(() => updateOrderMoney(order.id, { shipping: v }));
  }

  return (
    <div>
      <div className="row-between" style={{ marginTop: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>{order.title || `Objednávka č. ${order.order_number || "—"}`}</h2>
          <div className="detail-meta-row">
            <label className="inline-label">
              Stav
              <select
                value={order.status}
                onChange={(e) => startTransition(() => updateOrderStatus(order.id, e.target.value))}
              >
                {Object.entries(ALL_STATUSES).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <span className={`status-badge ${statusClass(order.status)}`}>{isPending ? "ukládám…" : " "}</span>
          </div>
        </div>
        <div className="header-actions">
          <SupplierPaidToggle orderId={order.id} paid={order.supplier_paid} />
          <SendInvoiceButton order={order} items={items} existingInvoice={invoice} />
          <SendVisualButton order={order} items={items} />
          <SendSupplierButton order={order} items={items} />
        </div>
      </div>

      <div className="two-col">
        <div className="addr-block">
          <h4>Fakturační adresa</h4>
          <div>{b.company || b.name || "—"}</div>
          <div className="muted">{b.street}</div>
          <div className="muted">
            {b.psc} {b.city}
          </div>
          {b.ico && <div className="muted">IČO: {b.ico}</div>}
          {b.dic && <div className="muted">DIČ: {b.dic}</div>}
          <div className="muted">{b.email}</div>
          <div className="muted">{b.phone}</div>
        </div>
        <div className="addr-block">
          <h4>Dodací adresa</h4>
          <div>{s.company || s.name || customerLabel(order)}</div>
          <div className="muted">{s.street || b.street}</div>
          <div className="muted">
            {s.psc || b.psc} {s.city || b.city}
          </div>
          <div className="muted">{s.phone || b.phone}</div>
        </div>
      </div>

      <h3>Položky</h3>
      <div className="items-list">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} orderId={order.id} currency={order.currency} />
        ))}
        {items.length === 0 && <p className="muted">Žádné položky.</p>}
      </div>
      <button className="btn" onClick={() => startTransition(() => addOrderItem(order.id))}>
        + Přidat položku
      </button>

      <div className="order-totals">
        <div className="totals-row">
          <span>Mezisoučet položek (bez DPH)</span>
          <span>{fmtMoney(totals.prodEx, order.currency)}</span>
        </div>
        <div className="totals-row discount-controls">
          <span>
            Sleva z produktů:
            {[0, 5, 10].map((p) => (
              <button
                key={p}
                className={`btn mini${discountPct === p ? " active" : ""}`}
                onClick={() => setDiscount(p)}
                style={{ marginLeft: 6 }}
              >
                {p} %
              </button>
            ))}
          </span>
          <span>{discountPct ? "− " + fmtMoney(totals.discountEx, order.currency) : "—"}</span>
        </div>
        <div className="totals-row">
          <span>
            Doprava (bez DPH)
            <input
              className="ship-input"
              type="number"
              min={0}
              step="0.01"
              defaultValue={shipping}
              onBlur={(e) => saveShipping(Number(e.target.value) || 0)}
              style={{ width: 84, height: 30, padding: "0 8px", border: "1px solid var(--color-border-input)", borderRadius: 6, marginLeft: 8 }}
            />
          </span>
          <span>{fmtMoney(totals.shipEx, order.currency)}</span>
        </div>
        <div className="totals-row">
          <span>Základ daně celkem (bez DPH)</span>
          <span>{fmtMoney(totals.totalEx, order.currency)}</span>
        </div>
        <div className="totals-row">
          <span>DPH</span>
          <span>{fmtMoney(totals.totalVat, order.currency)}</span>
        </div>
        <div className="totals-row grand">
          <span>Celkem k úhradě (s DPH)</span>
          <span>{fmtMoney(totals.grand, order.currency)}</span>
        </div>
      </div>

      <SupplierInvoices orderId={order.id} invoices={supplierInvoices} />
    </div>
  );
}

function ItemRow({ item, orderId, currency }: { item: OrderItem; orderId: string; currency: "CZK" | "EUR" }) {
  const [, startTransition] = useTransition();
  const banner = isBanner(item);
  const lineTotal = (item.unit_price || 0) * (item.qty || 0);

  function save(fields: Parameters<typeof updateOrderItem>[2]) {
    startTransition(() => updateOrderItem(item.id, orderId, fields));
  }

  return (
    <div className="item-row">
      {banner ? (
        <>
          <div className="field">
            Šířka (cm)
            <input type="number" defaultValue={item.width_cm ?? 0} onBlur={(e) => save({ width_cm: Number(e.target.value) || 0 })} />
          </div>
          <div className="field">
            Výška (cm)
            <input type="number" defaultValue={item.height_cm ?? 0} onBlur={(e) => save({ height_cm: Number(e.target.value) || 0 })} />
          </div>
        </>
      ) : (
        <>
          <div className="field">
            Tvar
            <select className="item-shape" defaultValue={item.shape ?? "A"} onChange={(e) => save({ shape: e.target.value })}>
              {SHAPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            Velikost
            <select className="item-size" defaultValue={item.size ?? "M"} onChange={(e) => save({ size: e.target.value })}>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            Rukáv (HS)
            <select
              defaultValue={item.design?.sleeveColor ?? "white"}
              onChange={(e) =>
                startTransition(() => updateItemSleeveColor(item.id, orderId, e.target.value as "white" | "black"))
              }
            >
              <option value="white">bílá</option>
              <option value="black">černá</option>
            </select>
          </div>
        </>
      )}
      <div className="field">
        Ks
        <input className="item-qty" type="number" min={1} defaultValue={item.qty} onBlur={(e) => save({ qty: Number(e.target.value) || 1 })} />
      </div>
      <div className="field">
        Cena/ks bez DPH
        <input className="item-price" type="number" step="0.01" defaultValue={item.unit_price} onBlur={(e) => save({ unit_price: Number(e.target.value) || 0 })} />
      </div>
      <div className="item-spacer" />
      <div className="item-linetotal">{fmtMoney(lineTotal, currency)}</div>
      <div className="item-actions">
        <button className="btn danger" onClick={() => startTransition(() => deleteOrderItem(item.id, orderId))}>
          Smazat
        </button>
      </div>
    </div>
  );
}
