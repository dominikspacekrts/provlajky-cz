"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteRider,
  getTopProductIds,
  importRidersCsv,
  sendNewsletterCampaign,
  type CampaignStats,
} from "@/lib/actions/newsletter";
import type { NewsletterCampaign, NewsletterProductCard, NewsletterRider, PromoCodeRules } from "@/lib/newsletter/types";
import {
  CampaignHistory,
  CodeRulesEditor,
  DEFAULT_RULES,
  EmailPreviewDialog,
  Panel,
  ProductPicker,
  Spinner,
  type Notify,
} from "./parts";

const DEFAULT_SUBJECT = "10% sleva pro jezdce Race the Streets | Provlajky.cz";
const DEFAULT_INTRO = `v rámci našeho partnerství s Race the Streets jsme pro tebe připravili **{sleva} slevu na celý nákup na Provlajky.cz**.

Chceš, aby byl tvůj tým, logo nebo partner na závodech opravdu vidět? Vyber si z naší nabídky **vlajek, bannerů, nůžkových a nafukovacích stanů** a dalších reklamních prvků a vytvoř si vlastní design.

{kod}

Slevu můžeš využít na celý nákup.

**Buď vidět na trati i v paddocku.**

Provlajky.cz × Race the Streets`;

export default function RtsTab({
  riders: ridersProp,
  products,
  campaigns,
  campaignStats,
  resendReady,
  fromAddress,
  notify,
}: {
  riders: NewsletterRider[];
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  campaignStats: Record<string, CampaignStats>;
  resendReady: boolean;
  fromAddress: string;
  notify: Notify;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [riders, setRiders] = useState(ridersProp);
  const [prevRidersProp, setPrevRidersProp] = useState(ridersProp);
  if (ridersProp !== prevRidersProp) {
    setPrevRidersProp(ridersProp);
    setRiders(ridersProp);
  }

  const [eventLabel, setEventLabel] = useState("");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [rules, setRules] = useState<PromoCodeRules>({ ...DEFAULT_RULES, prefix: "RACE10" });
  const [productIds, setProductIds] = useState<string[]>([]);
  const [previewRiderId, setPreviewRiderId] = useState("");
  const [testTo, setTestTo] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);
  const [busy, setBusy] = useState<null | "import" | "top" | "test" | "send" | `retry:${string}` | `del:${string}`>(null);

  const recipients = riders.filter((r) => r.country === "CZ" || r.country === "SK");
  const czCount = riders.filter((r) => r.country === "CZ").length;
  const skCount = riders.filter((r) => r.country === "SK").length;
  const events = [...new Set(riders.map((r) => r.event_label).filter(Boolean))] as string[];

  const shownRiders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.event_label || "").toLowerCase().includes(q)
    );
  }, [riders, query]);

  const missing: string[] = [];
  if (!resendReady) missing.push("Resend není nastavený");
  if (!recipients.length) missing.push("Nahraj seznam jezdců");
  if (!subject.trim()) missing.push("Doplň předmět");
  if (rules.discountValue <= 0) missing.push("Sleva musí být větší než 0");

  const campaignInput = { kind: "rts" as const, subject, introHtml: intro, productIds, codeRules: rules };

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy("import");
    try {
      const text = await file.text();
      const res = await importRidersCsv(text, eventLabel);
      if (!res.ok) return notify(res.error, "error");
      const d = res.data!;
      const skipped = d.skippedNonCzSk ? `, ${d.skippedNonCzSk} z jiných zemí přeskočeno` : "";
      notify(`Import hotový: ${d.imported} nových, ${d.updated} aktualizovaných${skipped}.`);
      router.refresh();
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDelete(r: NewsletterRider) {
    if (!confirm(`Smazat jezdce ${r.name} (${r.email})?`)) return;
    setBusy(`del:${r.id}`);
    const res = await deleteRider(r.id);
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    setRiders((list) => list.filter((x) => x.id !== r.id));
    if (previewRiderId === r.id) setPreviewRiderId("");
    router.refresh();
  }

  async function loadTop() {
    setBusy("top");
    const res = await getTopProductIds(6);
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    setProductIds(res.data || []);
  }

  async function sendTest() {
    const to = testTo.trim();
    if (!to.includes("@")) return notify("Zadej e-mail, kam poslat test.", "error");
    setBusy("test");
    const res = await sendNewsletterCampaign({ ...campaignInput, testTo: to });
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    notify(res.data!.sent ? `Test odešel na ${to}.` : `Test se nepodařilo odeslat (${res.data!.failed} chyba).`, res.data!.sent ? "ok" : "error");
    router.refresh();
  }

  async function sendAll() {
    if (!confirm(`Odeslat mail ${recipients.length} jezdcům?\n\nKaždý dostane vlastní slevový kód. Akci nejde vrátit.`)) return;
    setBusy("send");
    const res = await sendNewsletterCampaign(campaignInput);
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    const d = res.data!;
    notify(
      `Odesláno ${d.sent} mailů${d.failed ? `, ${d.failed} selhalo (jde zkusit znovu v historii)` : ""}${d.skipped ? `, ${d.skipped} přeskočeno` : ""}.`,
      d.failed && !d.sent ? "error" : "ok"
    );
    router.refresh();
  }

  async function retry(c: NewsletterCampaign) {
    setBusy(`retry:${c.id}`);
    const res = await sendNewsletterCampaign({
      kind: "rts",
      subject: c.subject,
      introHtml: c.intro_html,
      productIds: c.product_ids,
      codeRules: c.code_rules,
      retryCampaignId: c.id,
    });
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    notify(`Znovu odesláno: ${res.data!.sent}, stále chybných: ${res.data!.failed}.`);
    router.refresh();
  }

  function loadCampaign(c: NewsletterCampaign) {
    setSubject(c.subject);
    setIntro(c.intro_html);
    setProductIds(c.product_ids || []);
    setRules({ ...DEFAULT_RULES, ...c.code_rules });
    notify("Kampaň načtená do editoru.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const estSeconds = Math.max(5, Math.ceil(recipients.length * 0.4));

  return (
    <div className="nl-compose">
      <div className="nl-stack">
        <Panel
          title="Příjemci"
          sub="Mail dostanou jen jezdci z Česka a Slovenska."
          actions={
            <>
              <input
                className="nl-input"
                style={{ width: 200 }}
                placeholder="Závod, např. RTS Most 2026"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                aria-label="Název závodu pro import"
              />
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <button type="button" className="btn primary" disabled={busy === "import"} onClick={() => fileRef.current?.click()}>
                {busy === "import" ? "Importuji…" : "Importovat CSV"}
              </button>
            </>
          }
        >
          <div className="nl-facts">
            <div>
              <b>{recipients.length}</b>příjemců
            </div>
            <div>
              <b>{czCount}</b>z Česka
            </div>
            <div>
              <b>{skCount}</b>ze Slovenska
            </div>
            {events.length > 0 && (
              <div>
                <b>{events.length}</b>
                {events.length === 1 ? "závod" : "závodů"}
              </div>
            )}
          </div>

          {riders.length === 0 ? (
            <div className="nl-empty">
              <strong>Zatím žádní jezdci</strong>
              Nahraj CSV export z mailového klienta. Potřebné sloupce: jméno, e-mail a země.
              <br />
              Jezdci z jiných zemí se přeskočí, už existující e-maily se jen aktualizují.
            </div>
          ) : (
            <>
              <div className="nl-toolbar">
                <input
                  className="nl-input"
                  type="search"
                  placeholder="Hledat jméno, e-mail nebo závod…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="muted" style={{ fontSize: 13 }}>
                  {shownRiders.length === riders.length ? `${riders.length} jezdců` : `${shownRiders.length} z ${riders.length}`}
                </span>
              </div>
              <div className="nl-table-wrap">
                <table className="nl-table">
                  <thead>
                    <tr>
                      <th>Jezdec</th>
                      <th>Země</th>
                      <th>Závod</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shownRiders.map((r) => (
                      <tr key={r.id} className={previewRiderId === r.id ? "is-selected" : ""}>
                        <td>
                          <div className="nl-cell-main">{r.name}</div>
                          <div className="nl-cell-sub">{r.email}</div>
                        </td>
                        <td>
                          <span className="nl-badge">{r.country}</span>
                        </td>
                        <td className="muted">{r.event_label || "—"}</td>
                        <td className="actions">
                          <button type="button" className="btn mini" onClick={() => setPreviewRiderId(r.id)}>
                            Náhled
                          </button>
                          <button
                            type="button"
                            className="btn mini danger"
                            disabled={busy === `del:${r.id}`}
                            onClick={() => onDelete(r)}
                          >
                            Smazat
                          </button>
                        </td>
                      </tr>
                    ))}
                    {shownRiders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted" style={{ textAlign: "center", padding: 20 }}>
                          Nic nenalezeno.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Obsah mailu"
          sub="Oslovení (Ahoj Petře, / Ahoj Peter,) se doplní samo podle jména a země."
          actions={
            <button type="button" className="btn" onClick={() => setPreviewOpen(true)}>
              Náhled mailu
            </button>
          }
        >
          <div className="nl-grid">
            <label className="nl-field">
              Předmět
              <input className="nl-input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
            </label>
            <label className="nl-field">
              Text mailu
              <textarea className="nl-textarea" rows={12} value={intro} onChange={(e) => setIntro(e.target.value)} />
              <span className="nl-hint">
                Prázdný řádek = nový odstavec, <code>**text**</code> = tučně. Na řádek <code>{"{kod}"}</code> se vloží osobní slevový kód
                {" "}(bez něj bude kód na konci), <code>{"{sleva}"}</code> = výše slevy, <code>{"{jmeno}"}</code> = oslovením jezdce (Petře / Peter).
              </span>
            </label>
          </div>
        </Panel>

        <Panel title="Slevový kód" sub="Pravidla platí pro všechny kódy této kampaně.">
          <CodeRulesEditor rules={rules} onChange={setRules} who="Každý jezdec" prefix="RTS" />
        </Panel>

        <ProductPicker
          products={products}
          selected={productIds}
          onChange={setProductIds}
          onLoadTop={loadTop}
          loadingTop={busy === "top"}
        />

        <Panel title="Odeslání" sub="Nejdřív si pošli test na svůj e-mail a zkontroluj ho v telefonu.">
          <div className="nl-field">
            Testovací e-mail
            <div className="nl-input-group">
              <input
                className="nl-input"
                type="email"
                placeholder="tvuj@email.cz"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendTest()}
              />
              <button
                type="button"
                className="btn"
                style={{ whiteSpace: "nowrap" }}
                disabled={!!busy || !resendReady}
                onClick={sendTest}
              >
                {busy === "test" ? "Posílám…" : "Poslat test"}
              </button>
            </div>
            <span className="nl-hint">Test vytvoří jeden skutečný kód, ať jde vyzkoušet i v košíku.</span>
          </div>

          <hr className="nl-divider" />

          <ul className="nl-ready">
            {missing.length === 0 ? (
              <li>Vše připraveno: {recipients.length} jezdců, {productIds.length} produktů, předmět vyplněný.</li>
            ) : (
              missing.map((m) => (
                <li key={m} className="is-missing">
                  {m}
                </li>
              ))
            )}
          </ul>
          <div className="nl-send">
            <span className="muted" style={{ fontSize: 13 }}>
              {busy === "send"
                ? `Odesílám… nezavírej stránku (cca ${estSeconds} s).`
                : "Maily se posílají postupně, každý s vlastním kódem."}
            </span>
            <button type="button" className="btn lg" onClick={() => setPreviewOpen(true)}>
              Náhled mailu
            </button>
            <button type="button" className="btn primary lg" disabled={!!busy || missing.length > 0} onClick={sendAll}>
              {busy === "send" && <Spinner />}
              {busy === "send" ? "Odesílám…" : `Odeslat ${recipients.length} jezdcům`}
            </button>
          </div>
        </Panel>

        <CampaignHistory
          campaigns={campaigns}
          stats={campaignStats}
          retryingId={busy?.startsWith("retry:") ? busy.slice(6) : null}
          canRetry={resendReady && !busy}
          onRetry={retry}
          onReuse={loadCampaign}
          usedLabel="kolik jezdců už slevu uplatnilo v objednávce."
        />
      </div>

      <EmailPreviewDialog
        open={previewOpen}
        onClose={closePreview}
        input={{ ...campaignInput, recipientRiderId: previewRiderId || undefined }}
        fromAddress={fromAddress}
        recipientPicker={
          <label className="nl-field">
            Zobrazit jako
            <select className="nl-select" value={previewRiderId} onChange={(e) => setPreviewRiderId(e.target.value)}>
              <option value="">Ukázkový jezdec (Jan Novák, CZ)</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.country})
                </option>
              ))}
            </select>
          </label>
        }
      />
    </div>
  );
}
