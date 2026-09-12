"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useCustomerAuth } from "@/lib/customer-auth-client";
import { fmtMoney } from "@/lib/money";
import type { CheckoutSettings, CustomerAddress } from "@/lib/types";
import type { AddressSuggestion } from "@/lib/address-suggest";
import type { ShippingAddressRow } from "@/lib/customer-auth";
import CustomMadeNotice from "@/components/CustomMadeNotice";
import PhoneInput from "@/components/PhoneInput";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { billingFieldErrors, shippingFieldErrors, formatPsc } from "@/lib/validation";
import { itemFromCartLine, trackAddPaymentInfo, trackAddShippingInfo, trackBeginCheckout } from "@/lib/analytics";

const STANDARD_VAT_RATE = 0.21;

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

function addrFromShippingRow(row: ShippingAddressRow): CustomerAddress {
  return {
    ...emptyAddr(),
    company: row.company || "",
    name: row.name || "",
    street: row.street,
    psc: row.psc,
    city: row.city,
  };
}

export default function CheckoutPage() {
  const { lines, clear } = useCart();
  const { customer, loading: authLoading, setCustomer, refresh } = useCustomerAuth();
  const router = useRouter();
  const [billing, setBilling] = useState<CustomerAddress>(emptyAddr());
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [shipping, setShipping] = useState<CustomerAddress>(emptyAddr());
  const [note, setNote] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscountPct, setAppliedDiscountPct] = useState(0);
  const [discountMsg, setDiscountMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings | null>(null);
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);

  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [selectedShippingId, setSelectedShippingId] = useState<string>("new");
  const [saveShippingAddress, setSaveShippingAddress] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const billingFilledFromAccount = useRef(false);

  useEffect(() => {
    fetch("/api/checkout-settings")
      .then((r) => r.json())
      .then((s: CheckoutSettings) => {
        setCheckoutSettings(s);
        setShippingMethodId((cur) => cur ?? s.shippingMethods[0]?.id ?? null);
        setPaymentMethodId((cur) => cur ?? s.paymentMethods[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!customer || billingFilledFromAccount.current) return;
    billingFilledFromAccount.current = true;
    const b = customer.billing;
    setBilling((cur) => ({
      ...cur,
      ...(b || {}),
      email: b?.email || customer.email || cur.email,
      name: b?.name || customer.name || cur.name,
      phone: b?.phone || customer.phone || cur.phone,
      company: b?.company || cur.company,
      street: b?.street || cur.street,
      psc: b?.psc || cur.psc,
      city: b?.city || cur.city,
      ico: b?.ico || cur.ico,
      dic: b?.dic || cur.dic,
      isCompany: b?.isCompany ?? cur.isCompany,
    }));
    if (!customer.used_at && customer.discount_code) {
      setDiscountCode((cur) => cur || customer.discount_code);
    }
  }, [customer]);

  const subtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const productVatRaw = lines.reduce((s, l) => s + l.unitPrice * l.qty * l.vatRate, 0);
  const discountFactor = appliedDiscountPct > 0 ? 1 - appliedDiscountPct / 100 : 1;
  const discountEx = appliedDiscountPct > 0 ? subtotalEx * (appliedDiscountPct / 100) : 0;
  const productVat = productVatRaw * discountFactor;

  const selectedShipping = checkoutSettings?.shippingMethods.find((m) => m.id === shippingMethodId) ?? null;
  const shippingFree =
    checkoutSettings != null &&
    subtotalEx >= checkoutSettings.shippingFreeOverAmount &&
    checkoutSettings.shippingFreeOverAmount > 0;
  const shippingPriceEx = shippingFree ? 0 : selectedShipping?.price ?? 0;
  const shippingVat = shippingPriceEx * STANDARD_VAT_RATE;

  const selectedPayment = checkoutSettings?.paymentMethods.find((m) => m.id === paymentMethodId) ?? null;
  const paymentPriceEx = selectedPayment?.price ?? 0;
  const paymentVat = paymentPriceEx * STANDARD_VAT_RATE;

  const vat = productVat + shippingVat + paymentVat;
  const totalEx = subtotalEx - discountEx + shippingPriceEx + paymentPriceEx;

  const beginCheckoutSent = useRef(false);
  useEffect(() => {
    if (beginCheckoutSent.current || lines.length === 0) return;
    beginCheckoutSent.current = true;
    trackBeginCheckout(lines.map(itemFromCartLine));
  }, [lines]);

  const shippingInfoSent = useRef(false);
  const paymentInfoSent = useRef(false);

  function selectShipping(id: string, label: string) {
    setShippingMethodId(id);
    shippingInfoSent.current = true;
    trackAddShippingInfo(lines.map(itemFromCartLine), label);
  }

  function selectPayment(id: string, label: string) {
    setPaymentMethodId(id);
    paymentInfoSent.current = true;
    trackAddPaymentInfo(lines.map(itemFromCartLine), label);
  }

  function clearFieldError(key: string) {
    setFieldErrors((cur) => {
      if (!(key in cur)) return cur;
      const next = { ...cur };
      delete next[key];
      return next;
    });
  }

  function prefixFieldErrors(prefix: string, errors: Record<string, string>) {
    return Object.fromEntries(
      Object.entries(errors).map(([key, message]) => [`${prefix}${key[0].toUpperCase()}${key.slice(1)}`, message]),
    );
  }

  function set<K extends keyof CustomerAddress>(key: K, v: CustomerAddress[K]) {
    setBilling((cur) => ({ ...cur, [key]: v }));
    clearFieldError(`billing${key[0].toUpperCase()}${key.slice(1)}`);
  }

  function setShipField<K extends keyof CustomerAddress>(key: K, v: CustomerAddress[K]) {
    setShipping((cur) => ({ ...cur, [key]: v }));
    clearFieldError(`shipping${key[0].toUpperCase()}${key.slice(1)}`);
  }

  function onBillingAddressSelect(s: AddressSuggestion) {
    setBilling((cur) => ({ ...cur, street: s.street, city: s.city || cur.city, psc: s.zip ? formatPsc(s.zip) : cur.psc }));
    clearFieldError("billingStreet");
    clearFieldError("billingCity");
    clearFieldError("billingPsc");
  }

  function onShippingAddressSelect(s: AddressSuggestion) {
    setShipping((cur) => ({ ...cur, street: s.street, city: s.city || cur.city, psc: s.zip ? formatPsc(s.zip) : cur.psc }));
    clearFieldError("shippingStreet");
    clearFieldError("shippingCity");
    clearFieldError("shippingPsc");
  }

  function onSelectSavedShipping(id: string) {
    setSelectedShippingId(id);
    if (id === "new") {
      setShipping(emptyAddr());
      return;
    }
    const row = customer?.shipping_addresses.find((a) => a.id === id);
    if (row) setShipping(addrFromShippingRow(row));
  }

  async function applyDiscount() {
    const code = discountCode.trim();
    if (!code) {
      setDiscountMsg({ ok: false, text: "Zadejte slevový kód." });
      setAppliedDiscountPct(0);
      return;
    }
    setDiscountLoading(true);
    setDiscountMsg(null);
    try {
      const res = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!json.ok) {
        setAppliedDiscountPct(0);
        setDiscountMsg({ ok: false, text: json.message || "Kód je neplatný." });
      } else {
        setAppliedDiscountPct(Number(json.discountPct) || 0);
        setDiscountCode(code.toUpperCase());
        setDiscountMsg({ ok: true, text: json.message || `Sleva ${json.discountPct} % uplatněna.` });
      }
    } catch {
      setAppliedDiscountPct(0);
      setDiscountMsg({ ok: false, text: "Kód se nepodařilo ověřit." });
    } finally {
      setDiscountLoading(false);
    }
  }

  async function quickLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setLoginError(json.error || "Přihlášení se nezdařilo.");
        setLoginLoading(false);
        return;
      }
      if (json.customer) {
        setCustomer(json.customer);
        billingFilledFromAccount.current = false;
      }
      setLoginPassword("");
      setLoginLoading(false);
    } catch {
      setLoginError("Přihlášení se nezdařilo.");
      setLoginLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError("Košík je prázdný.");
      return;
    }
    const errors: Record<string, string> = {
      ...prefixFieldErrors("billing", billingFieldErrors(billing)),
      ...(!sameAsShipping ? prefixFieldErrors("shipping", shippingFieldErrors(shipping)) : {}),
    };

    if (createAccount && !customer && (accountPassword.length < 8 || !/[A-Za-zÀ-ž]/.test(accountPassword) || !/[0-9]/.test(accountPassword))) {
      setError("Pro vytvoření účtu zadejte heslo (min. 8 znaků, písmeno a číslice).");
      return;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError("Zkontrolujte prosím zvýrazněná pole.");
      return;
    }
    setFieldErrors({});

    if (!termsAccepted) {
      setError("Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.");
      return;
    }
    if (checkoutSettings && checkoutSettings.shippingMethods.length > 0 && !shippingMethodId) {
      setError("Vyberte prosím způsob dopravy.");
      return;
    }
    if (checkoutSettings && checkoutSettings.paymentMethods.length > 0 && !paymentMethodId) {
      setError("Vyberte prosím způsob platby.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const trackedItems = lines.map(itemFromCartLine);
    if (!shippingInfoSent.current && selectedShipping) {
      shippingInfoSent.current = true;
      trackAddShippingInfo(trackedItems, selectedShipping.label);
    }
    if (!paymentInfoSent.current && selectedPayment) {
      paymentInfoSent.current = true;
      trackAddPaymentInfo(trackedItems, selectedPayment.label);
    }
    try {
      const res = await fetch("/api/objednavka", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing,
          shipping: sameAsShipping ? billing : shipping,
          note,
          lines,
          discountCode: appliedDiscountPct > 0 ? discountCode.trim() : discountCode.trim() || undefined,
          shippingMethodId,
          paymentMethodId,
          createAccount: !customer && createAccount,
          accountPassword: !customer && createAccount ? accountPassword : undefined,
          saveShippingAddress: !!customer || createAccount ? !sameAsShipping && saveShippingAddress : false,
          shippingAddressId:
            !sameAsShipping && selectedShippingId !== "new" ? selectedShippingId : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nepodařilo se odeslat objednávku.");
      clear();
      await refresh();
      router.push(`/objednavka/dekujeme?id=${encodeURIComponent(json.orderId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepodařilo se odeslat objednávku.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="page-panel">
        <h1 style={{ fontSize: 30 }}>Objednávka</h1>
        <p style={{ color: "var(--gray)", marginTop: 8, maxWidth: 560 }}>
          Z důvodu výroby na zakázku je požadována platba předem na základě zaslané faktury. Po odeslání
          objednávky vás kontaktujeme s potvrzením, vizualizací a fakturou — platba probíhá bankovním převodem.
        </p>

        <div className="checkout-account">
          {authLoading ? (
            <span style={{ color: "var(--gray)" }}>Načítám účet…</span>
          ) : customer ? (
            <p style={{ margin: 0 }}>
              Přihlášeni jako <strong>{customer.email}</strong>. Fakturační údaje doplníme z účtu, pokud je máte
              uložené.{" "}
              <Link href="/muj-ucet">Můj účet</Link>
            </p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                Máte účet? Přihlaste se a předvyplníme adresy.{" "}
                <Link href="/prihlaseni?next=/objednavka">Přihlásit se</Link>
                {" · "}
                <Link href="/registrace">Registrace</Link>
              </p>
              <form onSubmit={quickLogin} className="checkout-account-actions" style={{ alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                  E-mail
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    autoComplete="email"
                    style={{ minWidth: 180 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                  Heslo
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{ minWidth: 140 }}
                  />
                </label>
                <button type="submit" className="btn-outline" disabled={loginLoading}>
                  {loginLoading ? "…" : "Přihlásit"}
                </button>
              </form>
              {loginError && <p className="auth-error" style={{ marginTop: 8 }}>{loginError}</p>}
            </>
          )}
        </div>

        <form noValidate onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 40, marginTop: 8 }}>
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
                {fieldErrors.billingName && <span className="field-error">{fieldErrors.billingName}</span>}
              </label>
              <label className="full-width">
                Ulice a č.p.
                <AddressAutocomplete
                  value={billing.street ?? ""}
                  onChange={(v) => set("street", v)}
                  onSelect={onBillingAddressSelect}
                  placeholder="Např. Nábřeží Míru 105"
                />
                {fieldErrors.billingStreet && <span className="field-error">{fieldErrors.billingStreet}</span>}
              </label>
              <div className="psc-row">
                <label>
                  PSČ
                  <input
                    value={billing.psc}
                    onChange={(e) => set("psc", formatPsc(e.target.value))}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="737 01"
                  />
                  {fieldErrors.billingPsc && <span className="field-error">{fieldErrors.billingPsc}</span>}
                </label>
                <label>
                  Město
                  <input value={billing.city} onChange={(e) => set("city", e.target.value)} />
                  {fieldErrors.billingCity && <span className="field-error">{fieldErrors.billingCity}</span>}
                </label>
              </div>
              <label>
                E-mail
                <input type="email" value={billing.email} onChange={(e) => set("email", e.target.value)} />
                {fieldErrors.billingEmail && <span className="field-error">{fieldErrors.billingEmail}</span>}
              </label>
              <label className="full-width">
                Telefon
                <PhoneInput value={billing.phone ?? ""} onChange={(v) => set("phone", v)} />
                {fieldErrors.billingPhone && <span className="field-error">{fieldErrors.billingPhone}</span>}
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
                    {fieldErrors.billingIco && <span className="field-error">{fieldErrors.billingIco}</span>}
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
                {customer && customer.shipping_addresses.length > 0 && (
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxWidth: 420 }}>
                    Uložená adresa
                    <select
                      value={selectedShippingId}
                      onChange={(e) => onSelectSavedShipping(e.target.value)}
                      style={{ padding: "10px 12px", font: "inherit", border: "1px solid var(--border)" }}
                    >
                      <option value="new">Nová adresa</option>
                      {customer.shipping_addresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {(a.label ? `${a.label}: ` : "") + `${a.street}, ${a.psc} ${a.city}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="form-grid">
                  <label>
                    Jméno a příjmení / firma
                    <input value={shipping.name} onChange={(e) => setShipField("name", e.target.value)} />
                  </label>
                  <label className="full-width">
                    Ulice a č.p.
                    <AddressAutocomplete
                      value={shipping.street ?? ""}
                      onChange={(v) => setShipField("street", v)}
                      onSelect={onShippingAddressSelect}
                      placeholder="Např. Nábřeží Míru 105"
                    />
                    {fieldErrors.shippingStreet && <span className="field-error">{fieldErrors.shippingStreet}</span>}
                  </label>
                  <div className="psc-row">
                    <label>
                      PSČ
                      <input
                        value={shipping.psc}
                        onChange={(e) => setShipField("psc", formatPsc(e.target.value))}
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="737 01"
                      />
                      {fieldErrors.shippingPsc && <span className="field-error">{fieldErrors.shippingPsc}</span>}
                    </label>
                    <label>
                      Město
                      <input value={shipping.city} onChange={(e) => setShipField("city", e.target.value)} />
                      {fieldErrors.shippingCity && <span className="field-error">{fieldErrors.shippingCity}</span>}
                    </label>
                  </div>
                </div>
                {(customer || createAccount) && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={saveShippingAddress}
                      onChange={(e) => setSaveShippingAddress(e.target.checked)}
                    />
                    Uložit tuto dodací adresu k účtu
                  </label>
                )}
              </>
            )}

            {!customer && (
              <div style={{ marginTop: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={createAccount}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                  />
                  Vytvořit účet a uložit adresy (heslo: min. 8 znaků, písmeno + číslice)
                </label>
                {createAccount && (
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, maxWidth: 320 }}>
                    Heslo k účtu
                    <input
                      type="password"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                    />
                  </label>
                )}
              </div>
            )}

            {checkoutSettings && checkoutSettings.shippingMethods.length > 0 && (
              <>
                <h3 style={{ fontSize: 18, marginTop: 24, marginBottom: 8 }}>Způsob dopravy</h3>
                <p style={{ fontSize: 13, color: "var(--gray)", marginBottom: 12 }}>
                  Cena dopravy je ovlivněna velikostí a hmotností zásilky. Od {fmtMoney(checkoutSettings.shippingFreeOverAmount)}{" "}
                  mezisoučtu bez DPH je doprava zdarma.
                </p>
                <div className="method-list">
                  {checkoutSettings.shippingMethods.map((m) => (
                    <label key={m.id} className={`method-row${shippingMethodId === m.id ? " active" : ""}`}>
                      <span className="method-row-l">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={shippingMethodId === m.id}
                          onChange={() => selectShipping(m.id, m.label)}
                        />
                        {m.label}
                      </span>
                      <span className="method-row-price">{!shippingFree && m.price > 0 ? fmtMoney(m.price) : "Zdarma"}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="form-grid" style={{ marginTop: 14 }}>
              <label className="full-width">
                Poznámka k objednávce
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>

            <h3 style={{ fontSize: 18, marginTop: 24, marginBottom: 12 }}>Způsob platby</h3>

            {checkoutSettings && checkoutSettings.paymentMethods.length > 0 && (
              <div className="method-list" style={{ marginBottom: 14 }}>
                {checkoutSettings.paymentMethods.map((m) => (
                  <label key={m.id} className={`method-row${paymentMethodId === m.id ? " active" : ""}`}>
                    <span className="method-row-l">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethodId === m.id}
                        onChange={() => selectPayment(m.id, m.label)}
                      />
                      {m.label}
                    </span>
                    <span className="method-row-price">{m.price > 0 ? fmtMoney(m.price) : "Zdarma"}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>Platba předem</div>
              <p style={{ padding: "14px 18px", color: "var(--gray)", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                Platbu předem požadujeme, protože zboží vyrábíme na zakázku podle individuálních potřeb zákazníka.
                Tímto eliminujeme riziko neprodejného vráceného zboží. Před platbou vás ale vždy kontaktujeme pro
                vytvoření a odsouhlasení návrhu, abychom se ujistili, že je vše podle vašich představ. Výrobu
                zahájíme až po úhradě, čímž garantujeme osobní přístup a precizní zpracování vaší objednávky.
                Odesláním objednávky se nezavazujete k platbě.
              </p>
            </div>

            <p style={{ fontSize: 13, color: "var(--gray)", marginTop: 14 }}>
              Vaše osobní údaje budou použity k vyřízení Vaší objednávky, zvýšení spokojenosti po celou dobu
              procházení tohoto webu a k dalším účelům popsaných na stránce{" "}
              <Link href="/ochrana-osobnich-udaju">Zásady ochrany osobních údajů</Link>.
            </p>

            <CustomMadeNotice compact />

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Přečetl/a jsem si <Link href="/obchodni-podminky">Obchodní podmínky</Link> a beru na vědomí, že u zboží
                vyrobeného na zakázku nelze odstoupit od smlouvy do 14 dnů *
              </span>
            </label>

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
            <div className="form-grid" style={{ marginBottom: 8 }}>
              <label className="full-width">
                Slevový kód
                <div className="discount-apply-row">
                  <input
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value);
                      if (appliedDiscountPct) {
                        setAppliedDiscountPct(0);
                        setDiscountMsg(null);
                      }
                    }}
                    placeholder="Např. z registrace"
                  />
                  <button type="button" className="btn-outline" onClick={applyDiscount} disabled={discountLoading}>
                    {discountLoading ? "…" : "Uplatnit"}
                  </button>
                </div>
              </label>
            </div>
            {discountMsg && (
              <p className={`discount-apply-msg ${discountMsg.ok ? "is-ok" : "is-err"}`}>{discountMsg.text}</p>
            )}
            {!discountMsg && (
              <p style={{ fontSize: 12, color: "var(--gray)", marginBottom: 14 }}>
                Po kliknutí na Uplatnit se sleva zobrazí v souhrnu. Spotřebuje se až odesláním objednávky.
              </p>
            )}

            <div className="cart-summary" style={{ marginLeft: 0, marginTop: 12 }}>
              <div className="row">
                <span>Mezisoučet bez DPH</span>
                <span>{fmtMoney(subtotalEx)}</span>
              </div>
              {appliedDiscountPct > 0 && (
                <div className="row">
                  <span>Sleva {appliedDiscountPct} %</span>
                  <span>− {fmtMoney(discountEx)}</span>
                </div>
              )}
              {selectedShipping && (
                <div className="row">
                  <span>Doprava</span>
                  <span>{shippingPriceEx > 0 ? fmtMoney(shippingPriceEx) : "Zdarma"}</span>
                </div>
              )}
              {selectedPayment && paymentPriceEx > 0 && (
                <div className="row">
                  <span>Platba</span>
                  <span>{fmtMoney(paymentPriceEx)}</span>
                </div>
              )}
              <div className="row">
                <span>DPH 21 %</span>
                <span>{fmtMoney(vat)}</span>
              </div>
              <div className="row total">
                <span>Celkem bez DPH</span>
                <span>{fmtMoney(totalEx)}</span>
              </div>
              <p className="cart-summary-note">Celkem s DPH {fmtMoney(totalEx + vat)}</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
