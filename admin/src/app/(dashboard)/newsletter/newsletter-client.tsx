"use client";

import { useMemo, useState, useTransition } from "react";
import {
  deleteColdcallCompany,
  deleteRider,
  getTopProductIds,
  importRidersCsv,
  previewNewsletterHtml,
  sendColdcallManual,
  sendNewsletterCampaign,
  updateColdcallStatus,
  upsertColdcallCompany,
} from "@/lib/actions/newsletter";
import type {
  ColdcallCompany,
  ColdcallStatus,
  NewsletterCampaign,
  NewsletterProductCard,
  NewsletterRider,
  PromoCodeRules,
} from "@/lib/newsletter/types";
import { COLDCALL_STATUS_LABELS, COLDCALL_STATUSES } from "@/lib/newsletter/types";

type Tab = "rts" | "coldcall";

const DEFAULT_RULES: PromoCodeRules = {
  discountType: "percent",
  discountValue: 10,
  oneShot: true,
  maxUses: 1,
  validDays: 30,
};

type Props = {
  initialRiders: NewsletterRider[];
  initialCompanies: ColdcallCompany[];
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  resendReady: boolean;
};

export default function NewsletterClient({
  initialRiders,
  initialCompanies,
  products,
  campaigns,
  resendReady,
}: Props) {
  const [tab, setTab] = useState<Tab>("rts");
  const [riders, setRiders] = useState(initialRiders);
  const [companies, setCompanies] = useState(initialCompanies);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button type="button" className={`btn mini${tab === "rts" ? " active" : ""}`} onClick={() => setTab("rts")}>
          Jezdci RTS ({riders.length})
        </button>
        <button
          type="button"
          className={`btn mini${tab === "coldcall" ? " active" : ""}`}
          onClick={() => setTab("coldcall")}
        >
          Coldcall ({companies.length})
        </button>
      </div>

      {msg && (
        <p style={{ background: "#f7f8f9", borderLeft: "3px solid #f4d03f", padding: "10px 14px", marginBottom: 16 }}>
          {msg}
        </p>
      )}

      {tab === "rts" ? (
        <RtsTab
          riders={riders}
          setRiders={setRiders}
          products={products}
          campaigns={campaigns.filter((c) => c.kind === "rts")}
          resendReady={resendReady}
          pending={pending}
          start={start}
          setMsg={setMsg}
        />
      ) : (
        <ColdcallTab
          companies={companies}
          setCompanies={setCompanies}
          products={products}
          campaigns={campaigns.filter((c) => c.kind === "coldcall")}
          resendReady={resendReady}
          pending={pending}
          start={start}
          setMsg={setMsg}
        />
      )}
    </div>
  );
}

function CodeRulesEditor({
  rules,
  onChange,
}: {
  rules: PromoCodeRules;
  onChange: (r: PromoCodeRules) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginTop: 8 }}>
      <label>
        Typ slevy
        <select
          value={rules.discountType}
          onChange={(e) =>
            onChange({ ...rules, discountType: e.target.value === "fixed" ? "fixed" : "percent" })
          }
        >
          <option value="percent">Procenta</option>
          <option value="fixed">Pevná částka (Kč)</option>
        </select>
      </label>
      <label>
        Hodnota
        <input
          type="number"
          min={0}
          step={rules.discountType === "percent" ? 1 : 100}
          value={rules.discountValue}
          onChange={(e) => onChange({ ...rules, discountValue: Number(e.target.value) || 0 })}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
        <input
          type="checkbox"
          checked={rules.oneShot}
          onChange={(e) =>
            onChange({
              ...rules,
              oneShot: e.target.checked,
              maxUses: e.target.checked ? 1 : Math.max(2, rules.maxUses || 2),
            })
          }
        />
        Jednorázový
      </label>
      {!rules.oneShot && (
        <label>
          Max. využití
          <input
            type="number"
            min={1}
            value={rules.maxUses ?? 1}
            onChange={(e) => onChange({ ...rules, maxUses: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      )}
      <label>
        Platnost (dny)
        <input
          type="number"
          min={1}
          placeholder="bez limitu"
          value={rules.validDays ?? ""}
          onChange={(e) =>
            onChange({
              ...rules,
              validDays: e.target.value === "" ? null : Math.max(1, Number(e.target.value) || 1),
            })
          }
        />
      </label>
    </div>
  );
}

function ProductPicker({
  products,
  selected,
  onChange,
  onLoadTop,
  pending,
}: {
  products: NewsletterProductCard[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onLoadTop: () => void;
  pending: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <strong>Produkty v mailu</strong>
        <button type="button" className="btn mini" disabled={pending} onClick={onLoadTop}>
          Načíst top produkty
        </button>
        <span className="muted" style={{ fontSize: 13 }}>
          {selected.length}/6
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, maxHeight: 280, overflow: "auto" }}>
        {products.map((p) => {
          const on = selected.includes(p.id);
          return (
            <label
              key={p.id}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                border: on ? "2px solid #f4d03f" : "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 8,
                background: on ? "#fffbeb" : "#fff",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  if (on) onChange(selected.filter((id) => id !== p.id));
                  else if (selected.length < 6) onChange([...selected, p.id]);
                }}
              />
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" width={40} height={40} style={{ objectFit: "cover", borderRadius: 4 }} />
              ) : (
                <div style={{ width: 40, height: 40, background: "#f3f4f6", borderRadius: 4 }} />
              )}
              <span style={{ fontSize: 13, lineHeight: 1.3 }}>
                {p.name}
                <br />
                <span className="muted">od {Math.round(p.fromPrice).toLocaleString("cs-CZ")} Kč</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function RtsTab({
  riders,
  setRiders,
  products,
  campaigns,
  resendReady,
  pending,
  start,
  setMsg,
}: {
  riders: NewsletterRider[];
  setRiders: (r: NewsletterRider[]) => void;
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  resendReady: boolean;
  pending: boolean;
  start: (fn: () => void) => void;
  setMsg: (s: string | null) => void;
}) {
  const [eventLabel, setEventLabel] = useState("");
  const [subject, setSubject] = useState("Sleva 10 % pro jezdce RTS — PROVLAJKY");
  const [intro, setIntro] = useState(
    "<p>děkujeme, že jezdíš s RTS. Připravili jsme pro tebe slevu na reklamu od PROVLAJKY — plážové vlajky, stany i bannery vyrábíme na míru.</p>"
  );
  const [rules, setRules] = useState<PromoCodeRules>({ ...DEFAULT_RULES });
  const [selected, setSelected] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");

  function onCsv(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      start(async () => {
        const res = await importRidersCsv(text, eventLabel || undefined);
        if (!res.ok) {
          setMsg(res.error);
          return;
        }
        setMsg(
          `Import OK: +${res.data!.imported} nových, ${res.data!.updated} aktualizováno` +
            (res.data!.skippedNonCzSk ? `, přeskočeno ${res.data!.skippedNonCzSk} (ne CZ/SK).` : ".")
        );
        window.location.reload();
      });
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section>
        <h3 style={{ marginBottom: 8 }}>1. Import jezdců (CSV)</h3>
        <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          Stejný formát jako mailový klient: Name, E-mail, Country, Phone. Uloží se jen CZ a SK.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}>
          <label>
            Označení závodu (volitelně)
            <input value={eventLabel} onChange={(e) => setEventLabel(e.target.value)} placeholder="RTS Brno 2026" />
          </label>
          <label>
            CSV soubor
            <input type="file" accept=".csv,text/csv" disabled={pending} onChange={(e) => onCsv(e.target.files?.[0] || null)} />
          </label>
        </div>
      </section>

      <section>
        <h3 style={{ marginBottom: 8 }}>Jezdci ({riders.length})</h3>
        {riders.length === 0 ? (
          <p className="muted">Zatím žádní jezdci — nahraj CSV.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="stats-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Jméno</th>
                  <th style={{ textAlign: "left" }}>E-mail</th>
                  <th>Země</th>
                  <th style={{ textAlign: "left" }}>Telefon</th>
                  <th style={{ textAlign: "left" }}>Závod</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {riders.map((r) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: "left" }}>{r.name}</td>
                    <td style={{ textAlign: "left" }}>{r.email}</td>
                    <td>{r.country}</td>
                    <td style={{ textAlign: "left" }}>{r.phone || "—"}</td>
                    <td style={{ textAlign: "left" }}>{r.event_label || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn mini danger"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            if (!confirm(`Smazat ${r.name}?`)) return;
                            const res = await deleteRider(r.id);
                            if (!res.ok) setMsg(res.error);
                            else setRiders(riders.filter((x) => x.id !== r.id));
                          })
                        }
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 style={{ marginBottom: 8 }}>2. Kampaň</h3>
        <label>
          Předmět
          <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label style={{ display: "block", marginTop: 10 }}>
          Úvod (HTML)
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={4} style={{ width: "100%" }} />
        </label>
        <CodeRulesEditor rules={rules} onChange={setRules} />
        <div style={{ marginTop: 14 }}>
          <ProductPicker
            products={products}
            selected={selected}
            onChange={setSelected}
            pending={pending}
            onLoadTop={() =>
              start(async () => {
                const res = await getTopProductIds(6);
                if (!res.ok) setMsg(res.error);
                else {
                  setSelected(res.data || []);
                  setMsg("Top produkty načteny — můžeš výběr upravit.");
                }
              })
            }
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, alignItems: "end" }}>
          <button
            type="button"
            className="btn mini"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await previewNewsletterHtml({
                  kind: "rts",
                  subject,
                  introHtml: intro,
                  productIds: selected,
                  codeRules: rules,
                  recipientRiderId: riders[0]?.id,
                });
                if (!res.ok) setMsg(res.error);
                else setPreviewHtml(res.data!.html);
              })
            }
          >
            Náhled
          </button>
          <label>
            Test na e-mail
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="ty@provlajky.cz" />
          </label>
          <button
            type="button"
            className="btn mini"
            disabled={pending || !resendReady || !testTo}
            onClick={() =>
              start(async () => {
                const res = await sendNewsletterCampaign({
                  kind: "rts",
                  subject,
                  introHtml: intro,
                  productIds: selected,
                  codeRules: rules,
                  testTo,
                });
                if (!res.ok) setMsg(res.error);
                else setMsg(`Test odeslán: sent ${res.data!.sent}, failed ${res.data!.failed}.`);
              })
            }
          >
            Poslat test
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending || !resendReady || riders.length === 0}
            onClick={() =>
              start(async () => {
                if (!confirm(`Odeslat kampaň všem ${riders.length} jezdcům CZ/SK? Každý dostane vlastní kód.`)) return;
                const res = await sendNewsletterCampaign({
                  kind: "rts",
                  subject,
                  introHtml: intro,
                  productIds: selected,
                  codeRules: rules,
                });
                if (!res.ok) setMsg(res.error);
                else
                  setMsg(
                    `Kampaň ${res.data!.campaignId}: odesláno ${res.data!.sent}, chyby ${res.data!.failed}, přeskočeno ${res.data!.skipped}.`
                  );
              })
            }
          >
            Odeslat všem jezdcům
          </button>
        </div>

        {previewHtml && (
          <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: 8, background: "#f7f8f9", fontSize: 13 }}>Náhled</div>
            <iframe title="Náhled newsletteru" srcDoc={previewHtml} style={{ width: "100%", height: 520, border: 0, background: "#f4f4f5" }} />
          </div>
        )}
      </section>

      {campaigns.length > 0 && (
        <section>
          <h3>Nedávné kampaně</h3>
          <ul style={{ fontSize: 14 }}>
            {campaigns.map((c) => (
              <li key={c.id}>
                {c.subject} — <strong>{c.status}</strong>{" "}
                <span className="muted">{new Date(c.created_at).toLocaleString("cs-CZ")}</span>
                {(c.status === "partial" || c.status === "failed") && (
                  <button
                    type="button"
                    className="btn mini"
                    style={{ marginLeft: 8 }}
                    disabled={pending || !resendReady}
                    onClick={() =>
                      start(async () => {
                        const res = await sendNewsletterCampaign({
                          kind: "rts",
                          subject: c.subject,
                          introHtml: c.intro_html,
                          productIds: c.product_ids || [],
                          codeRules: c.code_rules || DEFAULT_RULES,
                          retryCampaignId: c.id,
                        });
                        if (!res.ok) setMsg(res.error);
                        else setMsg(`Retry: sent ${res.data!.sent}, failed ${res.data!.failed}.`);
                      })
                    }
                  >
                    Znovu neúspěšné
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ColdcallTab({
  companies,
  setCompanies,
  products,
  campaigns,
  resendReady,
  pending,
  start,
  setMsg,
}: {
  companies: ColdcallCompany[];
  setCompanies: (c: ColdcallCompany[]) => void;
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  resendReady: boolean;
  pending: boolean;
  start: (fn: () => void) => void;
  setMsg: (s: string | null) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    note: "",
    status: "nova" as ColdcallStatus,
    default_discount_type: "percent" as "percent" | "fixed",
    default_discount_value: 10,
  });
  const [filter, setFilter] = useState<ColdcallStatus | "all">("all");
  const [selectedCompany, setSelectedCompany] = useState<ColdcallCompany | null>(null);
  const [subject, setSubject] = useState("Individuální nabídka — PROVLAJKY");
  const [intro, setIntro] = useState("");
  const [rules, setRules] = useState<PromoCodeRules>({ ...DEFAULT_RULES, discountValue: 10, validDays: 30 });
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatuses, setBulkStatuses] = useState<ColdcallStatus[]>(["poslat_email"]);
  const [flipJedname, setFlipJedname] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const visible = useMemo(
    () => (filter === "all" ? companies : companies.filter((c) => c.status === filter)),
    [companies, filter]
  );

  function saveCompany() {
    start(async () => {
      const res = await upsertColdcallCompany({
        id: selectedCompany?.id,
        ...form,
      });
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setMsg(selectedCompany ? "Firma uložena." : "Firma přidána.");
      window.location.reload();
    });
  }

  function openCompany(c: ColdcallCompany) {
    setSelectedCompany(c);
    setForm({
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      note: c.note || "",
      status: c.status,
      default_discount_type: c.default_discount_type,
      default_discount_value: Number(c.default_discount_value) || 10,
    });
    setRules({
      ...DEFAULT_RULES,
      discountType: c.default_discount_type,
      discountValue: Number(c.default_discount_value) || 10,
    });
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section>
        <h3 style={{ marginBottom: 8 }}>{selectedCompany ? "Upravit firmu" : "Nová firma"}</h3>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          <label>
            Název *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label>
            E-mail
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Stav
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as ColdcallStatus })}
            >
              {COLDCALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {COLDCALL_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Výchozí sleva
            <select
              value={form.default_discount_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_discount_type: e.target.value === "fixed" ? "fixed" : "percent",
                })
              }
            >
              <option value="percent">%</option>
              <option value="fixed">Kč</option>
            </select>
          </label>
          <label>
            Hodnota slevy
            <input
              type="number"
              value={form.default_discount_value}
              onChange={(e) => setForm({ ...form, default_discount_value: Number(e.target.value) || 0 })}
            />
          </label>
        </div>
        <label style={{ display: "block", marginTop: 10 }}>
          Poznámka
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} style={{ width: "100%" }} />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" className="btn" disabled={pending} onClick={saveCompany}>
            {selectedCompany ? "Uložit změny" : "Přidat firmu"}
          </button>
          {selectedCompany && (
            <button
              type="button"
              className="btn mini"
              onClick={() => {
                setSelectedCompany(null);
                setForm({
                  name: "",
                  phone: "",
                  email: "",
                  note: "",
                  status: "nova",
                  default_discount_type: "percent",
                  default_discount_value: 10,
                });
              }}
            >
              Zrušit výběr
            </button>
          )}
        </div>
      </section>

      <section>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button type="button" className={`btn mini${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
            Vše
          </button>
          {COLDCALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`btn mini${filter === s ? " active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {COLDCALL_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="stats-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Firma</th>
                <th style={{ textAlign: "left" }}>Telefon</th>
                <th style={{ textAlign: "left" }}>E-mail</th>
                <th style={{ textAlign: "left" }}>Stav</th>
                <th style={{ textAlign: "left" }}>Sleva</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} style={{ background: selectedCompany?.id === c.id ? "#fffbeb" : undefined }}>
                  <td style={{ textAlign: "left" }}>
                    <button type="button" className="btn mini" onClick={() => openCompany(c)}>
                      {c.name}
                    </button>
                  </td>
                  <td style={{ textAlign: "left" }}>{c.phone || "—"}</td>
                  <td style={{ textAlign: "left" }}>{c.email || "—"}</td>
                  <td style={{ textAlign: "left" }}>
                    <select
                      value={c.status}
                      disabled={pending}
                      onChange={(e) =>
                        start(async () => {
                          const status = e.target.value as ColdcallStatus;
                          const res = await updateColdcallStatus(c.id, status);
                          if (!res.ok) setMsg(res.error);
                          else
                            setCompanies(companies.map((x) => (x.id === c.id ? { ...x, status } : x)));
                        })
                      }
                    >
                      {COLDCALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {COLDCALL_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: "left" }}>
                    {c.default_discount_type === "fixed"
                      ? `${c.default_discount_value} Kč`
                      : `${c.default_discount_value} %`}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn mini danger"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          if (!confirm(`Smazat ${c.name}?`)) return;
                          const res = await deleteColdcallCompany(c.id);
                          if (!res.ok) setMsg(res.error);
                          else setCompanies(companies.filter((x) => x.id !== c.id));
                        })
                      }
                    >
                      Smazat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedCompany && (
        <section>
          <h3>Odeslat mail — {selectedCompany.name}</h3>
          {!selectedCompany.email && <p className="muted">Doplň e-mail u firmy, jinak nelze odeslat.</p>}
          <label>
            Předmět
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%" }} />
          </label>
          <label style={{ display: "block", marginTop: 10 }}>
            Úvod (HTML)
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} style={{ width: "100%" }} />
          </label>
          <CodeRulesEditor rules={rules} onChange={setRules} />
          <div style={{ marginTop: 12 }}>
            <ProductPicker
              products={products}
              selected={selected}
              onChange={setSelected}
              pending={pending}
              onLoadTop={() =>
                start(async () => {
                  const res = await getTopProductIds(6);
                  if (!res.ok) setMsg(res.error);
                  else setSelected(res.data || []);
                })
              }
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
            <input type="checkbox" checked={flipJedname} onChange={(e) => setFlipJedname(e.target.checked)} />
            Po odeslání přepnout stav na „Jednáme“
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn mini"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await previewNewsletterHtml({
                    kind: "coldcall",
                    subject,
                    introHtml: intro,
                    productIds: selected,
                    codeRules: rules,
                    recipientCompanyId: selectedCompany.id,
                  });
                  if (!res.ok) setMsg(res.error);
                  else setPreviewHtml(res.data!.html);
                })
              }
            >
              Náhled
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending || !resendReady || !selectedCompany.email}
              onClick={() =>
                start(async () => {
                  const res = await sendColdcallManual({
                    companyId: selectedCompany.id,
                    subject,
                    introHtml: intro,
                    productIds: selected,
                    codeRules: rules,
                    flipStatusToJedname: flipJedname,
                  });
                  if (!res.ok) setMsg(res.error);
                  else setMsg("Mail odeslán.");
                })
              }
            >
              Odeslat firmě
            </button>
          </div>
          {previewHtml && (
            <iframe title="Náhled" srcDoc={previewHtml} style={{ width: "100%", height: 480, border: "1px solid #e5e7eb", marginTop: 12, borderRadius: 12 }} />
          )}
        </section>
      )}

      <section>
        <h3>Hromadná kampaň (ručně)</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Pošle newsletter firmám ve vybraných stavech, které mají e-mail. Bez cronu — jen na kliknutí.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0" }}>
          {COLDCALL_STATUSES.map((s) => {
            const on = bulkStatuses.includes(s);
            return (
              <label key={s} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setBulkStatuses(on ? bulkStatuses.filter((x) => x !== s) : [...bulkStatuses, s])
                  }
                />
                {COLDCALL_STATUS_LABELS[s]}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className="btn"
          disabled={pending || !resendReady || bulkStatuses.length === 0}
          onClick={() =>
            start(async () => {
              if (!confirm("Odeslat hromadný newsletter vybraným stavům?")) return;
              const res = await sendNewsletterCampaign({
                kind: "coldcall",
                subject,
                introHtml: intro,
                productIds: selected,
                codeRules: rules,
                coldcallStatuses: bulkStatuses,
              });
              if (!res.ok) setMsg(res.error);
              else setMsg(`Coldcall kampaň: sent ${res.data!.sent}, failed ${res.data!.failed}.`);
            })
          }
        >
          Odeslat hromadně
        </button>
        {campaigns.length > 0 && (
          <ul style={{ marginTop: 12, fontSize: 14 }}>
            {campaigns.map((c) => (
              <li key={c.id}>
                {c.subject} — {c.status}{" "}
                <span className="muted">{new Date(c.created_at).toLocaleString("cs-CZ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
