"use client";

import { useState, useTransition } from "react";
import { updatePartner } from "@/lib/actions/partners";
import { testSmtp, updateCostPerSize, updateMailSettings } from "@/lib/actions/settings";
import type { AllowedUser, Partner, Settings } from "@/lib/types";

const TABS = ["Náklady", "Partneři", "Maily", "Uživatelé"] as const;

export default function SettingsForm({
  settings,
  partners,
  allowedUsers,
}: {
  settings: Settings;
  partners: Partner[];
  allowedUsers: AllowedUser[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Náklady");

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
        {tab === "Náklady" && <CostPerSizeTab initial={settings.cost_per_size} />}
        {tab === "Partneři" && <PartnersTab partners={partners} />}
        {tab === "Maily" && <MailTab initial={settings.mail} />}
        {tab === "Uživatelé" && <UsersTab users={allowedUsers} />}
      </div>
    </div>
  );
}

function CostPerSizeTab({ initial }: { initial: Settings["cost_per_size"] }) {
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <p className="muted">Náklad na vlajku bez DPH podle velikosti — používá se pro odhad zisku, pokud chybí dodavatelská faktura.</p>
      <div className="cost-grid">
        {(["S", "M", "L", "XL"] as const).map((size) => (
          <label key={size}>
            {size}
            <div className="cost-input">
              <input
                type="number"
                step="0.01"
                value={values[size]}
                onChange={(e) => setValues({ ...values, [size]: Number(e.target.value) || 0 })}
              />
              <span className="cur">Kč</span>
            </div>
          </label>
        ))}
      </div>
      <button
        className="btn primary"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await updateCostPerSize(values);
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
  return (
    <div>
      {partners.map((p) => (
        <PartnerBlock key={p.id} partner={p} />
      ))}
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
      <button className="btn" style={{ marginTop: 10 }} disabled={isPending} onClick={save}>
        {isPending ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit"}
      </button>
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
