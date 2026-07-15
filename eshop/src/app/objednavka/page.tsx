"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import type { CustomerAddress } from "@/lib/types";

const emptyAddr = (): CustomerAddress => ({
  company: "",
  name: "",
  street: "",
  psc: "",
  city: "",
  ico: "",
  dic: "",
  email: "",
  phone: "",
  isCompany: false,
});

export default function CheckoutPage() {
  const { lines, clear } = useCart();
  const router = useRouter();
  const [billing, setBilling] = useState<CustomerAddress>(emptyAddr());
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [shipping, setShipping] = useState<CustomerAddress>(emptyAddr());
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const vat = lines.reduce((s, l) => s + l.unitPrice * l.qty * l.vatRate, 0);

  function set<K extends keyof CustomerAddress>(key: K, v: CustomerAddress[K]) {
    setBilling((cur) => ({ ...cur, [key]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError("Košík je prázdný.");
      return;
    }
    if (!billing.email?.trim() || !(billing.name?.trim() || billing.company?.trim())) {
      setError('Vyplň prosím jméno nebo firmu a e-mail.');
      return;
    }
    if (billing.isCompany && !billing.ico?.trim()) {
      setError('Nákup je označen „na firmu“ – vyplň IČO.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/objednavka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing,
          shipping: sameAsShipping ? billing : shipping,
          note,
          lines,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nepodařilo se odeslat objednávku.");
      clear();
      router.push("/objednavka/dekujeme");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se odeslat objednávku.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-panel">
      <h1 style={{ fontSize: 30 }}>Objednávka</h1>
      <p style={{ color: "var(--gray)", marginTop: 8, maxWidth: 560 }}>
        Z důvodu výroby na zakázku je požadována platba předem na základě zaslané faktury. Po odeslání
        objednávky vás kontaktujeme s potvrzením, vizualizací a fakturou — platba probíhá bankovním převodem.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 40, marginTop: 28 }}>
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>Fakturační údaje</h3>
          <div className="form-grid">
            <label>
              Firma
              <input value={billing.company} onChange={(e) => set("company", e.target.value)} />
            </label>
            <label>
              Jméno a příjmení
              <input value={billing.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label className="full-width">
              Ulice a č.p.
              <input value={billing.street} onChange={(e) => set("street", e.target.value)} />
            </label>
            <label>
              PSČ
              <input value={billing.psc} onChange={(e) => set("psc", e.target.value)} />
            </label>
            <label>
              Město
              <input value={billing.city} onChange={(e) => set("city", e.target.value)} />
            </label>
            <label>
              E-mail
              <input type="email" value={billing.email} onChange={(e) => set("email", e.target.value)} />
            </label>
            <label>
              Telefon
              <input type="tel" value={billing.phone} onChange={(e) => set("phone", e.target.value)} />
            </label>
            <label className="full-width" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={!!billing.isCompany}
                onChange={(e) => set("isCompany", e.target.checked)}
                style={{ width: "auto" }}
              />
              Nákup na firmu (vyplnit IČO)
            </label>
            {billing.isCompany && (
              <>
                <label>
                  IČO
                  <input value={billing.ico} onChange={(e) => set("ico", e.target.value)} />
                </label>
                <label>
                  DIČ
                  <input value={billing.dic} onChange={(e) => set("dic", e.target.value)} />
                </label>
              </>
            )}
            <label className="full-width" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={sameAsShipping}
                onChange={(e) => setSameAsShipping(e.target.checked)}
                style={{ width: "auto" }}
              />
              Dodací adresa je stejná jako fakturační
            </label>
          </div>

          {!sameAsShipping && (
            <>
              <h3 style={{ fontSize: 18, margin: "24px 0 12px" }}>Dodací adresa</h3>
              <div className="form-grid">
                <label>
                  Jméno a příjmení / firma
                  <input
                    value={shipping.name}
                    onChange={(e) => setShipping((cur) => ({ ...cur, name: e.target.value }))}
                  />
                </label>
                <label>
                  Ulice a č.p.
                  <input
                    value={shipping.street}
                    onChange={(e) => setShipping((cur) => ({ ...cur, street: e.target.value }))}
                  />
                </label>
                <label>
                  PSČ
                  <input
                    value={shipping.psc}
                    onChange={(e) => setShipping((cur) => ({ ...cur, psc: e.target.value }))}
                  />
                </label>
                <label>
                  Město
                  <input
                    value={shipping.city}
                    onChange={(e) => setShipping((cur) => ({ ...cur, city: e.target.value }))}
                  />
                </label>
              </div>
            </>
          )}

          <div className="form-grid" style={{ marginTop: 14 }}>
            <label className="full-width">
              Poznámka k objednávce
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</div>}

          <button className="btn-yellow" type="submit" disabled={isSubmitting} style={{ marginTop: 18 }}>
            {isSubmitting ? "Odesílám…" : "Odeslat objednávku"}
          </button>
        </div>

        <div>
          <h3 style={{ fontSize: 18, marginBottom: 12 }}>Souhrn objednávky</h3>
          {lines.map((l) => (
            <div key={l.id} className="row" style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", color: "var(--gray)" }}>
              <span>
                {l.name} {l.shape ? `· Tvar ${l.shape}` : ""} {l.size ? `· ${l.size}` : ""} × {l.qty}
              </span>
              <span>{fmtMoney(l.unitPrice * l.qty)}</span>
            </div>
          ))}
          <div className="cart-summary" style={{ marginLeft: 0 }}>
            <div className="row">
              <span>Mezisoučet bez DPH</span>
              <span>{fmtMoney(subtotalEx)}</span>
            </div>
            <div className="row">
              <span>DPH</span>
              <span>{fmtMoney(vat)}</span>
            </div>
            <div className="row total">
              <span>Celkem</span>
              <span>{fmtMoney(subtotalEx + vat)}</span>
            </div>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}
