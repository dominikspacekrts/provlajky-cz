"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-client";

export default function AccountPageClient() {
  const { customer, loading, logout } = useCustomerAuth();
  const router = useRouter();

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
          </Link>
          {" "}
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
          Slevový kód: <code style={{ fontWeight: 700, letterSpacing: 1 }}>{customer.discount_code}</code> (
          {customer.discount_pct} %) — uplatněte ho v objednávce.
        </p>
      )}
      {customer.used_at && (
        <p style={{ marginTop: 12, color: "var(--gray)" }}>Slevový kód už byl uplatněn u objednávky.</p>
      )}

      {customer.billing && (
        <div style={{ marginTop: 24 }}>
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
          Objednávka
        </Link>
        <button type="button" className="btn-outline" onClick={onLogout}>
          Odhlásit se
        </button>
      </p>
    </div>
  );
}
