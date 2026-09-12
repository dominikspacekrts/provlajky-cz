"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fmtMoney } from "@/lib/money";
import { customerStatusTone } from "@/lib/order-status";
import type { CustomerOrderDetail } from "@/lib/customer-order-types";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function OrderDetailClient() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/auth/orders/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const json = await r.json();
        if (r.status === 401) {
          if (!cancelled) setError("Pro zobrazení objednávky se přihlaste.");
          return;
        }
        if (!r.ok) throw new Error(json.error || "Objednávka nenalezena.");
        if (!cancelled) setOrder(json.order);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chyba načtení.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p style={{ color: "var(--gray)" }}>Načítám…</p>;
  if (error || !order) {
    return (
      <div>
        <p className="auth-error">{error || "Objednávka nenalezena."}</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/muj-ucet">Zpět na účet</Link>
          {" · "}
          <Link href="/prihlaseni?next=/muj-ucet">Přihlásit se</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ marginBottom: 8 }}>
        <Link href="/muj-ucet">← Můj účet</Link>
      </p>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        Objednávka č. {order.orderNumber || order.id.slice(0, 8)}
      </h1>
      <p style={{ color: "var(--gray)", marginBottom: 16 }}>{formatDate(order.createdAt)}</p>
      <p>
        <span className={`account-status tone-${customerStatusTone(order.status)}`}>
          {order.statusLabel}
        </span>
      </p>

      <h2 style={{ fontSize: 18, marginTop: 28, marginBottom: 12 }}>Položky</h2>
      <ul className="account-order-items">
        {order.items.map((it, i) => (
          <li key={i}>
            <span>
              {it.name}
              {(it.shape || it.size) && (
                <span style={{ color: "var(--gray)" }}>
                  {" "}
                  · {[it.shape && `tvar ${it.shape}`, it.size].filter(Boolean).join(" · ")}
                </span>
              )}
              <span style={{ color: "var(--gray)" }}> × {it.qty}</span>
            </span>
            <span>{fmtMoney(it.lineEx)}</span>
          </li>
        ))}
      </ul>

      <div className="cart-summary" style={{ marginLeft: 0, marginTop: 16, maxWidth: 360 }}>
        {order.discountPct > 0 && (
          <div className="row">
            <span>Sleva {order.discountPct} %</span>
            <span>− {fmtMoney(order.discountEx)}</span>
          </div>
        )}
        {order.shippingEx > 0 && (
          <div className="row">
            <span>Doprava / platba</span>
            <span>{fmtMoney(order.shippingEx)}</span>
          </div>
        )}
        <div className="row total">
          <span>Celkem bez DPH</span>
          <span>{fmtMoney(order.totalEx)}</span>
        </div>
        <p className="cart-summary-note">Celkem s DPH {fmtMoney(order.totalIncVat)}</p>
      </div>

      {order.billing && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Fakturační adresa</h2>
          <p style={{ lineHeight: 1.7 }}>
            {[order.billing.name, order.billing.company].filter(Boolean).join(" · ")}
            <br />
            {order.billing.street}
            <br />
            {order.billing.psc} {order.billing.city}
            {order.billing.email && (
              <>
                <br />
                {order.billing.email}
              </>
            )}
          </p>
        </div>
      )}

      {order.shipping && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Dodací adresa</h2>
          <p style={{ lineHeight: 1.7 }}>
            {[order.shipping.name, order.shipping.company].filter(Boolean).join(" · ")}
            <br />
            {order.shipping.street}
            <br />
            {order.shipping.psc} {order.shipping.city}
          </p>
        </div>
      )}
    </div>
  );
}
