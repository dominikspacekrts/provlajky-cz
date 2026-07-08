"use client";

import { useState, useTransition } from "react";
import { createOrder } from "@/lib/actions/orders";
import type { Customer, CustomerAddress } from "@/lib/types";

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

export default function NewOrderForm({ knownCustomers }: { knownCustomers: Customer[] }) {
  const [billing, setBilling] = useState<CustomerAddress>(emptyAddr());
  const [shipping, setShipping] = useState<CustomerAddress>(emptyAddr());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pickCustomer(index: string) {
    if (index === "") return;
    const c = knownCustomers[Number(index)];
    if (!c) return;
    setBilling({ ...emptyAddr(), ...c.billing });
    setShipping({ ...emptyAddr(), ...c.shipping });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (billing.isCompany && !billing.ico?.trim()) {
      setError('Nákup je označen „na firmu" – vyplň IČO ve fakturační adrese.');
      return;
    }
    setError(null);
    startTransition(() => createOrder({ billing, shipping }));
  }

  return (
    <form onSubmit={handleSubmit} className="form-col" style={{ maxWidth: 900 }}>
      {knownCustomers.length > 0 && (
        <label className="customer-picker-row">
          Předvyplnit podle existujícího zákazníka
          <select defaultValue="" onChange={(e) => pickCustomer(e.target.value)}>
            <option value="">— vybrat —</option>
            {knownCustomers.map((c, i) => (
              <option key={i} value={i}>
                {c.billing.company || c.billing.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="two-col">
        <AddressFields title="Fakturační adresa" value={billing} onChange={setBilling} withCompanyInfo />
        <AddressFields title="Dodací adresa" value={shipping} onChange={setShipping} />
      </div>

      {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}

      <div>
        <button type="submit" className="btn primary" disabled={isPending}>
          {isPending ? "Zakládám…" : "Založit objednávku"}
        </button>
      </div>
    </form>
  );
}

function AddressFields({
  title,
  value,
  onChange,
  withCompanyInfo,
}: {
  title: string;
  value: CustomerAddress;
  onChange: (v: CustomerAddress) => void;
  withCompanyInfo?: boolean;
}) {
  function set<K extends keyof CustomerAddress>(key: K, v: CustomerAddress[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="addr-block">
      <h4>{title}</h4>
      <div className="form-col">
        <label>
          Firma
          <input value={value.company || ""} onChange={(e) => set("company", e.target.value)} />
        </label>
        <label>
          Jméno a příjmení
          <input value={value.name || ""} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label>
          Ulice a č.p.
          <input value={value.street || ""} onChange={(e) => set("street", e.target.value)} />
        </label>
        <div className="psc-row">
          <label>
            PSČ
            <input value={value.psc || ""} onChange={(e) => set("psc", e.target.value)} />
          </label>
          <label>
            Město
            <input value={value.city || ""} onChange={(e) => set("city", e.target.value)} />
          </label>
        </div>
        {withCompanyInfo && (
          <>
            <label className="cb-line">
              <input type="checkbox" checked={!!value.isCompany} onChange={(e) => set("isCompany", e.target.checked)} />
              Nákup na firmu (vyplnit IČO)
            </label>
            <div className="psc-row">
              <label>
                IČO
                <input value={value.ico || ""} onChange={(e) => set("ico", e.target.value)} />
              </label>
              <label>
                DIČ
                <input value={value.dic || ""} onChange={(e) => set("dic", e.target.value)} />
              </label>
            </div>
          </>
        )}
        <label>
          E-mail
          <input type="email" value={value.email || ""} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label>
          Telefon
          <input type="tel" value={value.phone || ""} onChange={(e) => set("phone", e.target.value)} />
        </label>
      </div>
    </div>
  );
}
