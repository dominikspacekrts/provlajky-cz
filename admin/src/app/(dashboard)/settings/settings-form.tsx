"use client";

import { useState, useTransition } from "react";
import { createPartner, deletePartner, updatePartner } from "@/lib/actions/partners";
import {
  testSmtp,
  updateMailSettings,
  updateMarketingSettings,
  updatePaymentSettings,
  updateShippingSettings,
} from "@/lib/actions/settings";
import { setOrderCounter, type OrderCounter } from "@/lib/actions/order-counter";
import type { AllowedUser, Partner, Settings, ShippingMethod, PaymentMethod } from "@/lib/types";

const TABS = ["Partneři", "Maily", "Marketing", "Doprava a platby", "Číslování", "Uživatelé"] as const;

export default function SettingsForm({
  settings,
  partners,
  allowedUsers,
  orderCounter,
}: {
  settings: Settings;
  partners: Partner[];
  allowedUsers: AllowedUser[];
  orderCounter: OrderCounter | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Partneři");

  return (
    <div>
      <div className="settings-tabs">
        {TABS.map((t) => (
          <button key={t} className={`btn set-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="set-panel">
        {tab === "Partneři" && <PartnersTab partners={partners} />}
        {tab === "Maily" && <MailTab initial={settings.mail} />}
        {tab === "Marketing" && <MarketingTab initial={settings.marketing} />}
        {tab === "Doprava a platby" && <ShippingPaymentTab shipping={settings.shipping} payment={settings.payment} />}
        {tab === "Číslování" && <OrderNumberingTab initial={orderCounter} />}
        {tab === "Uživatelé" && <UsersTab users={allowedUsers} />}
      </div>
    </div>
  );
}

function OrderNumberingTab({ initial }: { initial: OrderCounter | null }) {
  const year = initial?.year ?? new Date().getFullYear();
  const [nextVal, setNextVal] = useState(initial?.next_val ?? 1);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  if (!initial) {
    return (
      <p className="muted">
        Číslování objednávek ještě není zapnuté — v Supabase SQL Editoru je potřeba spustit migraci{" "}
        <code>2026-08-order-numbering.sql</code> (soubor je v <code>admin/supabase/</code>). Po jejím spuštění se tu
        objeví nastavení počátečního čísla.
      </p>
    );
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>
        Číslo objednávky (formát {year}NNNN) se přiděluje automaticky při založení nové objednávky — je to zároveň
        číslo faktury i variabilní symbol platby. Tady jde nastavit, jakým pořadovým číslem se má označit ta
        <strong> příští</strong> založená objednávka v roce {year}.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 260 }}>
        Příští objednávka bude mít číslo
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="muted">{year}</span>
          <input
            type="number"
            min={1}
            max={9999}
            value={nextVal}
            onChange={(e) => setNextVal(Math.max(1, Math.min(9999, Number(e.target.value) || 1)))}
            style={{ width: 100 }}
          />
        </div>
      </label>
      <button
        className="btn primary"
        style={{ marginTop: 14 }}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await setOrderCounter(nextVal);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          })
        }
      >
        {isPending ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit"}
      </button>
    </div>
  );
}

function PartnersTab({ partners }: { partners: Partner[] }) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      {partners.map((p) => (
        <PartnerBlock key={p.id} partner={p} />
      ))}
      {partners.length === 0 && <p className="muted">Zatím žádní partneři.</p>}

      <div className="partner-block" style={{ marginTop: partners.length ? 20 : 0 }}>
        <h4>Přidat partnera</h4>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 260 }}>
            Jméno
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Alex" />
          </label>
          <button
            className="btn primary"
            disabled={isPending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                await createPartner(name.trim());
                setName("");
              })
            }
          >
            {isPending ? "Přidávám…" : "+ Přidat"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnerBlock({ partner }: { partner: Partner }) {
  const [name, setName] = useState(partner.name);
  const [share, setShare] = useState(partner.share);
  const [billing, setBilling] = useState(partner.billing || {});
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updatePartner(partner.id, { name, share, billing });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="partner-block">
      <h4>{partner.name}</h4>
      <div className="partner-grid">
        <label>
          Jméno
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Podíl (%)
          <input type="number" value={share} onChange={(e) => setShare(Number(e.target.value) || 0)} />
        </label>
        {(["company", "name", "ico", "dic", "street", "psc", "city", "bank"] as const).map((k) => (
          <label key={k}>
            {
              {
                company: "Firma",
                name: "Jméno a příjmení",
                ico: "IČO",
                dic: "DIČ",
                street: "Ulice a č.p.",
                psc: "PSČ",
                city: "Město",
                bank: "Účet",
              }[k]
            }
            <input
              value={billing[k] || ""}
              onChange={(e) => setBilling({ ...billing, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="btn" disabled={isPending} onClick={save}>
          {isPending ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit"}
        </button>
        <button
          className="btn danger"
          disabled={isPending}
          onClick={() => {
            if (confirm(`Smazat partnera „${partner.name}"?`)) startTransition(() => deletePartner(partner.id));
          }}
        >
          Smazat
        </button>
      </div>
    </div>
  );
}

function MailTab({ initial }: { initial: Settings["mail"] }) {
  const [m, setM] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function set<K extends keyof Settings["mail"]>(key: K, value: Settings["mail"][K]) {
    setM({ ...m, [key]: value });
  }

  return (
    <div>
      <div className="mail-grid">
        <label>
          SMTP server
          <input value={m.host} onChange={(e) => set("host", e.target.value)} />
        </label>
        <label>
          Port
          <input type="number" value={m.port} onChange={(e) => set("port", Number(e.target.value) || 587)} />
        </label>
        <label>
          Uživatel
          <input value={m.user} onChange={(e) => set("user", e.target.value)} />
        </label>
        <label>
          Heslo
          <input type="password" value={m.pass} onChange={(e) => set("pass", e.target.value)} />
        </label>
        <label className="cb">
          <input type="checkbox" checked={m.secure} onChange={(e) => set("secure", e.target.checked)} />
          Použít SSL (port 465)
        </label>
        <label>
          Jméno odesílatele
          <input value={m.fromName} onChange={(e) => set("fromName", e.target.value)} />
        </label>
        <label>
          E-mail odesílatele
          <input value={m.from} onChange={(e) => set("from", e.target.value)} />
        </label>
        <label>
          E-mail účetní
          <input value={m.accountant} onChange={(e) => set("accountant", e.target.value)} />
        </label>
        <label>
          E-mail dodavatele
          <input value={m.supplier} onChange={(e) => set("supplier", e.target.value)} />
        </label>
        <label>
          Podpis — jméno
          <input value={m.signName} onChange={(e) => set("signName", e.target.value)} />
        </label>
        <label>
          Podpis — telefon
          <input value={m.signPhone} onChange={(e) => set("signPhone", e.target.value)} />
        </label>
        <label className="full">
          Šablona — faktura zákazníkovi
          <textarea className="tpl-area" rows={6} value={m.tplInvoice} onChange={(e) => set("tplInvoice", e.target.value)} />
        </label>
        <label className="full">
          Šablona — vizualizace / cenová nabídka
          <textarea className="tpl-area" rows={6} value={m.tplVisual} onChange={(e) => set("tplVisual", e.target.value)} />
        </label>
        <label className="full">
          Šablona — kopie účetní
          <textarea className="tpl-area" rows={6} value={m.tplAccountant} onChange={(e) => set("tplAccountant", e.target.value)} />
        </label>
      </div>

      <div className="header-actions" style={{ marginTop: 14 }}>
        <button
          className="btn primary"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateMailSettings(m);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            })
          }
        >
          {isPending ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit"}
        </button>
        <button
          className="btn"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setTestResult(null);
              const res = await testSmtp(m);
              setTestResult(res.ok ? "✅ Spojení funguje." : "❌ " + res.error);
            })
          }
        >
          Otestovat SMTP spojení
        </button>
        {testResult && <span className="muted">{testResult}</span>}
      </div>
    </div>
  );
}

function MarketingTab({ initial }: { initial: Settings["marketing"] }) {
  const [snippet, setSnippet] = useState(initial.headSnippet);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <p className="muted" style={{ marginBottom: 14 }}>
        Sem vlož konverzní/sledovací kódy, které pošle marketingová agentura (Google Ads, Meta Pixel, GA4, ověřovací
        meta tagy apod.) — přesně tak, jak je dostaneš (celý <code>&lt;script&gt;</code>/<code>&lt;meta&gt;</code>{" "}
        úryvek). Vloží se do <code>&lt;head&gt;</code> na každé stránce eshopu. XML feed produktů pro Google Merchant
        Center je na adrese <code>https://provlajky.cz/feed/products.xml</code>.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        Kód do &lt;head&gt;
        <textarea
          className="tpl-area"
          rows={12}
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
          placeholder={`<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=..."></script>\n<script>...</script>`}
        />
      </label>
      <button
        className="btn primary"
        style={{ marginTop: 14 }}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await updateMarketingSettings({ headSnippet: snippet });
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
          })
        }
      >
        {isPending ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit"}
      </button>
    </div>
  );
}

// Slug z labelu pro id nové položky (kolize při shodném názvu doplní čísly).
function slugify(label: string, existing: Set<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "polozka";
  let id = base;
  let i = 2;
  while (existing.has(id)) id = `${base}-${i++}`;
  return id;
}

function MethodListEditor({
  methods,
  onChange,
}: {
  methods: (ShippingMethod | PaymentMethod)[];
  onChange: (next: (ShippingMethod | PaymentMethod)[]) => void;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newPrice, setNewPrice] = useState(0);

  function update(id: string, patch: Partial<ShippingMethod>) {
    onChange(methods.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function remove(id: string) {
    onChange(methods.filter((m) => m.id !== id));
  }

  function add() {
    const label = newLabel.trim();
    if (!label) return;
    const id = slugify(
      label,
      new Set(methods.map((m) => m.id))
    );
    onChange([...methods, { id, label, price: newPrice }]);
    setNewLabel("");
    setNewPrice(0);
  }

  return (
    <div>
      {methods.map((m) => (
        <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            Název
            <input value={m.label} onChange={(e) => update(m.id, { label: e.target.value })} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, width: 140 }}>
            Cena (Kč)
            <input
              type="number"
              value={m.price}
              onChange={(e) => update(m.id, { price: Number(e.target.value) || 0 })}
            />
          </label>
          <button className="btn danger" onClick={() => remove(m.id)}>
            Smazat
          </button>
        </div>
      ))}
      {methods.length === 0 && <p className="muted" style={{ marginBottom: 10 }}>Zatím žádné.</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          Nový název
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="např. GLS" />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, width: 140 }}>
          Cena (Kč)
          <input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value) || 0)} />
        </label>
        <button className="btn primary" disabled={!newLabel.trim()} onClick={add}>
          + Přidat
        </button>
      </div>
    </div>
  );
}

function ShippingPaymentTab({ shipping, payment }: { shipping: Settings["shipping"]; payment: Settings["payment"] }) {
  const [freeOverAmount, setFreeOverAmount] = useState(shipping.freeOverAmount);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>(shipping.methods);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(payment.methods);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await Promise.all([
        updateShippingSettings({ freeOverAmount, methods: shippingMethods }),
        updatePaymentSettings({ methods: paymentMethods }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div>
      <h4>Doprava</h4>
      <p className="muted" style={{ marginBottom: 14 }}>
        Způsoby dopravy nabízené v checkoutu eshopu, s cenou bez DPH. Cena 0 Kč = zdarma. Když mezisoučet objednávky
        bez DPH dosáhne částky níže, doprava se zákazníkovi automaticky odpustí bez ohledu na cenu vybraného způsobu.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 260, marginBottom: 18 }}>
        Doprava zdarma od (Kč bez DPH)
        <input
          type="number"
          value={freeOverAmount}
          onChange={(e) => setFreeOverAmount(Number(e.target.value) || 0)}
        />
      </label>
      <MethodListEditor methods={shippingMethods} onChange={(next) => setShippingMethods(next as ShippingMethod[])} />

      <h4 style={{ marginTop: 32 }}>Platba</h4>
      <p className="muted" style={{ marginBottom: 14 }}>
        Způsoby platby nabízené v checkoutu eshopu, s příplatkem bez DPH (0 Kč = bez příplatku).
      </p>
      <MethodListEditor methods={paymentMethods} onChange={(next) => setPaymentMethods(next as PaymentMethod[])} />

      <button className="btn primary" style={{ marginTop: 20 }} disabled={isPending} onClick={save}>
        {isPending ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit"}
      </button>
    </div>
  );
}

function UsersTab({ users }: { users: AllowedUser[] }) {
  return (
    <div>
      <p className="muted">
        Přístup mají tyto 3 e-maily. Nové účty se zakládají v Supabase Dashboardu (Authentication → Users → Invite) a musí zde mít
        odpovídající řádek v <code>allowed_users</code>.
      </p>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Jméno</th>
            <th>E-mail</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.email}>
              <td style={{ textAlign: "left" }}>{u.display_name}</td>
              <td style={{ textAlign: "left" }}>{u.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
