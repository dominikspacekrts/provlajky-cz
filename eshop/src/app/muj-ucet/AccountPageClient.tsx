"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-client";
import { fmtMoney } from "@/lib/money";
import { customerStatusTone } from "@/lib/order-status";
import type { CustomerOrderSummary } from "@/lib/customer-order-types";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AccountPageClient() {
  const { customer, loading, logout } = useCustomerAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrderSummary[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) {
      setOrders(null);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/orders")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Nepodařilo se načíst objednávky.");
        if (!cancelled) setOrders(json.orders || []);
      })
      .catch((e) => {
        if (!cancelled) setOrdersError(e instanceof Error ? e.message : "Chyba načtení.");
      });
    return () => {
      cancelled = true;
    };
  }, [customer]);

  if (loading) {
    return <p style={{ color: "var(--gray)" }}>Načítám…</p>;
  }

  if (!customer) {
    return (
      <div>
        <p style={{ color: "var(--gray)" }}>Nejste přihlášeni.</p>
        <p style={{ marginTop: 16 }}>
          <Link href="/prihlaseni" className="btn-yellow">
            Přihlásit se
          </Link>{" "}
          <Link href="/registrace" className="btn-outline">
            Registrace
          </Link>
        </p>
      </div>
    );
  }

  async function onLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div>
      <p>
        Přihlášeni jako <strong>{customer.email}</strong>
        {customer.name ? ` (${customer.name})` : ""}
      </p>
      {!customer.used_at && (
        <p style={{ marginTop: 12 }}>
          Slevový kód:{" "}
          <code style={{ fontWeight: 700, letterSpacing: 1 }}>{customer.discount_code}</code> (
          {customer.discount_pct} %) — uplatněte ho v objednávce.
        </p>
      )}
      {customer.used_at && (
        <p style={{ marginTop: 12, color: "var(--gray)" }}>Slevový kód už byl uplatněn u objednávky.</p>
      )}

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Objednávky</h2>
        {ordersError && <p className="auth-error">{ordersError}</p>}
        {!orders && !ordersError && <p style={{ color: "var(--gray)" }}>Načítám objednávky…</p>}
        {orders && orders.length === 0 && (
          <p style={{ color: "var(--gray)" }}>Zatím žádné objednávky s tímto e-mailem.</p>
        )}
        {orders && orders.length > 0 && (
          <ul className="account-order-list">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/muj-ucet/objednavka/${o.id}`} className="account-order-row">
                  <span className="account-order-main">
                    <strong>Č. {o.orderNumber || o.id.slice(0, 8)}</strong>
                    <span className="account-order-date">{formatDate(o.createdAt)}</span>
                  </span>
                  <span className={`account-status tone-${customerStatusTone(o.status)}`}>
                    {o.statusLabel}
                  </span>
                  <span className="account-order-total">{fmtMoney(o.totalEx)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {customer.billing && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Fakturační údaje</h2>
          <p style={{ lineHeight: 1.7 }}>
            {[customer.billing.name, customer.billing.company].filter(Boolean).join(" · ")}
            <br />
            {customer.billing.street}
            <br />
            {customer.billing.psc} {customer.billing.city}
          </p>
        </div>
      )}

      {customer.shipping_addresses.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Uložené dodací adresy</h2>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            {customer.shipping_addresses.map((a) => (
              <li key={a.id}>
                {a.label ? `${a.label}: ` : ""}
                {[a.name, a.company].filter(Boolean).join(", ")}
                {a.name || a.company ? " — " : ""}
                {a.street}, {a.psc} {a.city}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/objednavka" className="btn-yellow">
          Nová objednávka
        </Link>
        <button type="button" className="btn-outline" onClick={onLogout}>
          Odhlásit se
        </button>
      </p>
    </div>
  );
}
