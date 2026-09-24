"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteColdcallCompany,
  getTopProductIds,
  sendColdcallManual,
  sendNewsletterCampaign,
  updateColdcallAssignee,
  updateColdcallStatus,
  upsertColdcallCompany,
  type CampaignStats,
} from "@/lib/actions/newsletter";
import { createClient } from "@/lib/supabase/client";
import type {
  ColdcallCompany,
  ColdcallStatus,
  NewsletterCampaign,
  NewsletterProductCard,
  PromoCodeRules,
  TeamMember,
} from "@/lib/newsletter/types";
import { COLDCALL_STATUS_LABELS, COLDCALL_STATUSES, CONTACT_COOLDOWN_DAYS } from "@/lib/newsletter/types";
import {
  CampaignHistory,
  CodeRulesEditor,
  DEFAULT_RULES,
  EmailPreviewDialog,
  Panel,
  ProductPicker,
  Segmented,
  Spinner,
  fmtAgo,
  fmtDate,
  fmtKc,
  type Notify,
} from "./parts";

const DEFAULT_SUBJECT = "Individuální nabídka pro vaši firmu — PROVLAJKY";
const DEFAULT_INTRO =
  "děkujeme za příjemný telefonát. Jak jsme se bavili, posíláme přehled toho, co pro vás umíme vyrobit — plážové vlajky, nůžkové a nafukovací stany i bannery, vše s vaší grafikou.\n\nPro {firma} jsme připravili individuální slevu, stačí ji uplatnit v objednávce.";

type CompanyDraft = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  status: ColdcallStatus;
  default_discount_type: "percent" | "fixed";
  default_discount_value: number;
  /** "" = nikdo */
  assigned_to: string;
  /** updated_at firmy v okamžiku, kdy se otevřela úprava. */
  baseUpdatedAt?: string;
};

const COOLDOWN_MS = CONTACT_COOLDOWN_DAYS * 864e5;

function contactedRecently(c: ColdcallCompany | undefined): boolean {
  return !!c?.last_contacted_at && Date.now() - new Date(c.last_contacted_at).getTime() < COOLDOWN_MS;
}

function sameInstant(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

type OwnerFilter = "all" | "me" | "none" | `user:${string}`;

const EMPTY_DRAFT: CompanyDraft = {
  name: "",
  phone: "",
  email: "",
  note: "",
  status: "nova",
  default_discount_type: "percent",
  default_discount_value: 10,
  assigned_to: "",
};

function toDraft(c: ColdcallCompany): CompanyDraft {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone || "",
    email: c.email || "",
    note: c.note || "",
    status: c.status,
    default_discount_type: c.default_discount_type,
    default_discount_value: Number(c.default_discount_value) || 0,
    assigned_to: c.assigned_to || "",
    baseUpdatedAt: c.updated_at,
  };
}

function rulesForCompany(c: ColdcallCompany | undefined, base: PromoCodeRules): PromoCodeRules {
  if (!c) return base;
  return {
    ...base,
    discountType: c.default_discount_type,
    discountValue: Number(c.default_discount_value) || base.discountValue,
  };
}

export default function ColdcallTab({
  companies: companiesProp,
  products,
  campaigns,
  campaignStats,
  resendReady,
  fromAddress,
  team,
  me,
  teamReady,
  notify,
}: {
  companies: ColdcallCompany[];
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  campaignStats: Record<string, CampaignStats>;
  resendReady: boolean;
  fromAddress: string;
  team: TeamMember[];
  me: string | null;
  teamReady: boolean;
  notify: Notify;
}) {
  const router = useRouter();

  function nameOf(email: string | null | undefined): string {
    if (!email) return "";
    return team.find((t) => t.email === email)?.display_name || email.split("@")[0]!;
  }

  const [companies, setCompanies] = useState(companiesProp);
  const [prevCompaniesProp, setPrevCompaniesProp] = useState(companiesProp);
  if (companiesProp !== prevCompaniesProp) {
    setPrevCompaniesProp(companiesProp);
    setCompanies(companiesProp);
  }

  const [live, setLive] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("coldcall-companies")
      .on("postgres_changes", { event: "*", schema: "public", table: "coldcall_companies" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          if (id) setCompanies((list) => list.filter((c) => c.id !== id));
          return;
        }
        const raw = payload.new as ColdcallCompany;
        const row = { ...raw, default_discount_value: Number(raw.default_discount_value) || 0 };
        setCompanies((list) => {
          const i = list.findIndex((c) => c.id === row.id);
          if (i < 0) return [row, ...list];
          const next = list.slice();
          next[i] = row;
          return next;
        });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    // Záloha, kdyby živé spojení vypadlo: po návratu do záložky prohlížeče načíst čerstvá data.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const [stageFilter, setStageFilter] = useState<ColdcallStatus | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<CompanyDraft | null>(null);
  const newDraft = (): CompanyDraft => ({ ...EMPTY_DRAFT, assigned_to: me || "" });

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [targetId, setTargetId] = useState("");
  const [bulkStatuses, setBulkStatuses] = useState<ColdcallStatus[]>(["poslat_email"]);
  const [flipToJedname, setFlipToJedname] = useState(true);
  const [skipRecent, setSkipRecent] = useState(true);
  const [onlyMine, setOnlyMine] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [rules, setRules] = useState<PromoCodeRules>(DEFAULT_RULES);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [testTo, setTestTo] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);
  const [busy, setBusy] = useState<null | "save" | "top" | "test" | "send" | `retry:${string}` | `row:${string}`>(null);

  const countByStatus = useMemo(() => {
    const m = Object.fromEntries(COLDCALL_STATUSES.map((s) => [s, 0])) as Record<ColdcallStatus, number>;
    for (const c of companies) m[c.status]++;
    return m;
  }, [companies]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (stageFilter !== "all" && c.status !== stageFilter) return false;
      if (ownerFilter === "me" && c.assigned_to !== me) return false;
      if (ownerFilter === "none" && c.assigned_to) return false;
      if (ownerFilter.startsWith("user:") && c.assigned_to !== ownerFilter.slice(5)) return false;
      if (!q) return true;
      return [c.name, c.phone, c.email, c.note].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [companies, stageFilter, ownerFilter, query, me]);

  const withEmail = companies.filter((c) => c.email?.trim() && (!onlyMine || c.assigned_to === me));
  const target = companies.find((c) => c.id === targetId);
  const bulkInStatus = withEmail.filter((c) => bulkStatuses.includes(c.status));
  const bulkRecipients = skipRecent ? bulkInStatus.filter((c) => !contactedRecently(c)) : bulkInStatus;
  const bulkSkipped = bulkInStatus.length - bulkRecipients.length;
  const myCount = me ? companies.filter((c) => c.assigned_to === me).length : 0;

  const targetRecent = contactedRecently(target);
  const targetOwnedByOther = !!target?.assigned_to && target.assigned_to !== me;
  const warnings: string[] = [];
  if (mode === "single" && target && targetRecent) {
    warnings.push(
      `Téhle firmě už psal${target.last_contacted_by ? ` ${nameOf(target.last_contacted_by)}` : " někdo"} ${fmtAgo(target.last_contacted_at)}.`
    );
  }
  if (mode === "single" && targetOwnedByOther) warnings.push(`Firmu řeší ${nameOf(target!.assigned_to)}.`);

  const draftLive = draft?.id ? companies.find((c) => c.id === draft.id) : undefined;
  const draftStale = !!draftLive && !!draft?.baseUpdatedAt && !sameInstant(draftLive.updated_at, draft.baseUpdatedAt);

  const missing: string[] = [];
  if (!resendReady) missing.push("Resend není nastavený");
  if (mode === "single" && !target) missing.push("Vyber firmu");
  if (mode === "single" && target && !target.email?.trim()) missing.push("Firma nemá e-mail");
  if (mode === "bulk" && !bulkRecipients.length) missing.push("Ve vybraných stavech není žádná firma s e-mailem");
  if (!subject.trim()) missing.push("Doplň předmět");
  if (rules.discountValue <= 0) missing.push("Sleva musí být větší než 0");

  function pickTarget(id: string) {
    setTargetId(id);
    setRules((r) => rulesForCompany(companies.find((c) => c.id === id), r));
  }

  function writeTo(c: ColdcallCompany) {
    setMode("single");
    pickTarget(c.id);
    document.getElementById("nl-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveDraft(overwrite = false) {
    if (!draft) return;
    if (!draft.name.trim()) return notify("Zadej název firmy.", "error");
    setBusy("save");
    const { baseUpdatedAt, ...fields } = draft;
    const res = await upsertColdcallCompany({
      ...fields,
      assigned_to: teamReady ? fields.assigned_to || null : undefined,
      expectedUpdatedAt: overwrite ? draftLive?.updated_at : baseUpdatedAt,
    });
    setBusy(null);
    if (!res.ok) {
      if ("conflict" in res) {
        const fresh = res.conflict;
        setCompanies((list) => list.map((c) => (c.id === fresh.id ? fresh : c)));
      }
      return notify(res.error, "error");
    }
    const saved = res.data!;
    setCompanies((list) => [saved, ...list.filter((c) => c.id !== saved.id)]);
    notify(draft.id ? "Firma uložená." : `Firma ${saved.name} přidaná.`);
    setDraft(null);
    router.refresh();
  }

  async function changeStatus(c: ColdcallCompany, status: ColdcallStatus) {
    const prev = c.status;
    setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, status } : x)));
    const res = await updateColdcallStatus(c.id, status);
    if (!res.ok) {
      setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, status: prev } : x)));
      return notify(res.error, "error");
    }
    const saved = res.data!;
    setCompanies((list) => list.map((x) => (x.id === saved.id ? saved : x)));
  }

  async function changeAssignee(c: ColdcallCompany, email: string) {
    const prev = c.assigned_to ?? null;
    setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, assigned_to: email || null } : x)));
    const res = await updateColdcallAssignee(c.id, email || null);
    if (!res.ok) {
      setCompanies((list) => list.map((x) => (x.id === c.id ? { ...x, assigned_to: prev } : x)));
      return notify(res.error, "error");
    }
    const saved = res.data!;
    setCompanies((list) => list.map((x) => (x.id === saved.id ? saved : x)));
  }

  async function remove(c: ColdcallCompany) {
    if (!confirm(`Smazat firmu ${c.name}? Vygenerované kódy zůstanou platné.`)) return;
    setBusy(`row:${c.id}`);
    const res = await deleteColdcallCompany(c.id);
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    setCompanies((list) => list.filter((x) => x.id !== c.id));
    if (targetId === c.id) setTargetId("");
    if (draft?.id === c.id) setDraft(null);
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
    const res = await sendNewsletterCampaign({
      kind: "coldcall",
      subject,
      introHtml: intro,
      productIds,
      codeRules: rules,
      testTo: to,
    });
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    notify(res.data!.sent ? `Test odešel na ${to}.` : "Test se nepodařilo odeslat.", res.data!.sent ? "ok" : "error");
  }

  async function send() {
    if (mode === "single") {
      if (!target) return;
      const warn = warnings.length ? `\n\nPozor: ${warnings.join(" ")}` : "";
      if (!confirm(`Poslat nabídku firmě ${target.name} na ${target.email}?${warn}`)) return;
      const payload = {
        companyId: target.id,
        subject,
        introHtml: intro,
        productIds,
        codeRules: rules,
        flipStatusToJedname: flipToJedname,
        force: targetRecent,
      };
      setBusy("send");
      let res = await sendColdcallManual(payload);
      if (!res.ok && "recentContact" in res) {
        const who = res.recentContact.by ? nameOf(res.recentContact.by) : "Někdo";
        const again = confirm(`${who} téhle firmě právě poslal mail (${fmtAgo(res.recentContact.at)}).\n\nPoslat i tak?`);
        res = again ? await sendColdcallManual({ ...payload, force: true }) : res;
        if (!again) {
          setBusy(null);
          router.refresh();
          return;
        }
      }
      setBusy(null);
      if (!res.ok) return notify(res.error, "error");
      notify(`Mail odešel firmě ${target.name}.`);
      router.refresh();
      return;
    }

    if (!confirm(`Odeslat nabídku ${bulkRecipients.length} firmám?\n\nKaždá dostane vlastní slevový kód. Akci nejde vrátit.`)) return;
    setBusy("send");
    const res = await sendNewsletterCampaign({
      kind: "coldcall",
      subject,
      introHtml: intro,
      productIds,
      codeRules: rules,
      coldcallStatuses: bulkStatuses,
      skipRecentlyContacted: skipRecent,
      onlyAssignedTo: onlyMine && me ? me : undefined,
    });
    setBusy(null);
    if (!res.ok) return notify(res.error, "error");
    const d = res.data!;
    notify(
      `Odesláno ${d.sent} mailů${d.skipped ? `, ${d.skipped} přeskočeno (už jim někdo psal)` : ""}${d.failed ? `, ${d.failed} selhalo (jde zkusit znovu v historii)` : ""}.`,
      d.failed && !d.sent ? "error" : "ok"
    );
    router.refresh();
  }

  async function retry(c: NewsletterCampaign) {
    setBusy(`retry:${c.id}`);
    const res = await sendNewsletterCampaign({
      kind: "coldcall",
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

  function reuse(c: NewsletterCampaign) {
    setMode("bulk");
    setSubject(c.subject);
    setIntro(c.intro_html);
    setProductIds(c.product_ids || []);
    setRules({ ...DEFAULT_RULES, ...c.code_rules });
    notify("Kampaň načtená do editoru.");
    document.getElementById("nl-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleBulkStatus(s: ColdcallStatus) {
    setBulkStatuses((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  }

  const sendLabel =
    mode === "single"
      ? target
        ? `Poslat firmě ${target.name}`
        : "Poslat firmě"
      : `Odeslat ${bulkRecipients.length} ${bulkRecipients.length === 1 ? "firmě" : "firmám"}`;

  return (
    <div className="nl-stack">
      <Panel
        title="Firmy"
        sub={
          <>
            Zapiš si firmu po telefonátu, měň stav podle vývoje a odtud jí rovnou pošli nabídku.{" "}
            <span className={`nl-live${live ? " is-on" : ""}`} title={live ? "Změny od kolegů se tu objeví samy." : "Živé změny nejsou připojené — data se obnoví při návratu na stránku."}>
              {live ? "Živě" : "Offline"}
            </span>
          </>
        }
        actions={
          <button type="button" className="btn primary" onClick={() => setDraft(newDraft())}>
            Přidat firmu
          </button>
        }
      >
        {!teamReady && (
          <div className="nl-alert" role="status" style={{ marginBottom: 14 }}>
            Pro práci ve více lidech (kdo firmu řeší, ochrana proti přepsání a dvojímu mailu) spusť jednou v Supabase SQL Editoru
            soubor <code>admin/supabase/2026-09-coldcall-team.sql</code>.
          </div>
        )}
        <div className="nl-pipeline" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={`nl-stage${stageFilter === "all" ? " is-on" : ""}`}
            onClick={() => setStageFilter("all")}
          >
            Všechny <span>{companies.length}</span>
          </button>
          {COLDCALL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={`nl-stage s-${s}${stageFilter === s ? " is-on" : ""}`}
              onClick={() => setStageFilter(stageFilter === s ? "all" : s)}
            >
              <i aria-hidden="true" />
              {COLDCALL_STATUS_LABELS[s]} <span>{countByStatus[s]}</span>
            </button>
          ))}
        </div>

        {draft && (
          <div className="nl-form-box">
            {draftStale && draftLive && (
              <div className="nl-alert" role="alert" style={{ marginBottom: 14 }}>
                <strong>{draftLive.updated_by ? nameOf(draftLive.updated_by) : "Někdo"}</strong> tuhle firmu mezitím upravil (
                {fmtAgo(draftLive.updated_at)}). Stav teď: {COLDCALL_STATUS_LABELS[draftLive.status]}
                {draftLive.assigned_to ? `, řeší ${nameOf(draftLive.assigned_to)}` : ""}.
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn mini" onClick={() => setDraft(toDraft(draftLive))}>
                    Načíst jeho verzi (moje úpravy zahodit)
                  </button>
                  <button type="button" className="btn mini" disabled={busy === "save"} onClick={() => saveDraft(true)}>
                    Přepsat mými úpravami
                  </button>
                </div>
              </div>
            )}
            <div className="nl-grid cols-3">
              <label className="nl-field">
                Název firmy
                <input
                  className="nl-input"
                  autoFocus
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Firma s.r.o."
                />
              </label>
              <label className="nl-field">
                Telefon
                <input
                  className="nl-input"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="+420 …"
                />
              </label>
              <label className="nl-field">
                E-mail
                <input
                  className="nl-input"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="info@firma.cz"
                />
              </label>
              <label className="nl-field">
                Stav
                <select
                  className="nl-select"
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as ColdcallStatus })}
                >
                  {COLDCALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {COLDCALL_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              {teamReady && (
                <label className="nl-field">
                  Řeší
                  <select
                    className="nl-select"
                    value={draft.assigned_to}
                    onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}
                  >
                    <option value="">Nikdo</option>
                    {team.map((t) => (
                      <option key={t.email} value={t.email}>
                        {t.display_name}
                        {t.email === me ? " (já)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="nl-field">
                Individuální sleva
                <div className="nl-input-group">
                  <input
                    className="nl-input is-narrow"
                    type="number"
                    min={0}
                    value={draft.default_discount_value}
                    onChange={(e) => setDraft({ ...draft, default_discount_value: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Výše individuální slevy"
                  />
                  <Segmented
                    label="Typ slevy"
                    value={draft.default_discount_type}
                    options={[
                      { value: "percent", label: "%" },
                      { value: "fixed", label: "Kč" },
                    ]}
                    onChange={(v) => setDraft({ ...draft, default_discount_type: v })}
                  />
                </div>
              </div>
              <label className="nl-field" style={{ gridColumn: "1 / -1" }}>
                Poznámka
                <textarea
                  className="nl-textarea"
                  style={{ minHeight: 70 }}
                  rows={2}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="S kým jsi mluvil, co je zajímá, kdy znovu zavolat…"
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => setDraft(null)}>
                Zrušit
              </button>
              <button type="button" className="btn primary" disabled={busy === "save" || draftStale} onClick={() => saveDraft()}>
                {busy === "save" ? "Ukládám…" : draft.id ? "Uložit změny" : "Přidat firmu"}
              </button>
            </div>
          </div>
        )}

        {companies.length === 0 ? (
          <div className="nl-empty">
            <strong>Zatím žádné firmy</strong>
            Po každém telefonátu firmu přidej — název, telefon, e-mail a jak hovor dopadl.
            <br />
            <button type="button" className="btn primary" onClick={() => setDraft(newDraft())}>
              Přidat první firmu
            </button>
          </div>
        ) : (
          <>
            <div className="nl-toolbar">
              <input
                className="nl-input"
                type="search"
                placeholder="Hledat firmu, telefon, e-mail, poznámku…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {teamReady && (
                <select
                  className="nl-select"
                  style={{ width: "auto" }}
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value as OwnerFilter)}
                  aria-label="Kdo firmu řeší"
                >
                  <option value="all">Řeší: všichni</option>
                  {me && <option value="me">Moje firmy ({myCount})</option>}
                  <option value="none">Nikdo neřeší</option>
                  {team
                    .filter((t) => t.email !== me)
                    .map((t) => (
                      <option key={t.email} value={`user:${t.email}`}>
                        Řeší {t.display_name}
                      </option>
                    ))}
                </select>
              )}
              <span className="muted" style={{ fontSize: 13 }}>
                {shown.length === companies.length ? `${companies.length} firem` : `${shown.length} z ${companies.length}`}
              </span>
            </div>
            <div className="nl-table-wrap" style={{ maxHeight: 460 }}>
              <table className="nl-table">
                <thead>
                  <tr>
                    <th>Firma</th>
                    <th>Kontakt</th>
                    <th>Stav</th>
                    {teamReady && <th>Řeší</th>}
                    <th className="num">Sleva</th>
                    <th>Naposledy mail</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id} className={targetId === c.id && mode === "single" ? "is-selected" : ""}>
                      <td>
                        <div className="nl-cell-main">{c.name}</div>
                        {c.note && (
                          <div className="nl-cell-sub" title={c.note}>
                            {c.note}
                          </div>
                        )}
                        {c.updated_by && (
                          <div className="nl-cell-sub" title={fmtDate(c.updated_at)}>
                            Upravil {nameOf(c.updated_by)} · {fmtAgo(c.updated_at)}
                          </div>
                        )}
                      </td>
                      <td>
                        {c.phone ? <a href={`tel:${c.phone.replace(/\s+/g, "")}`}>{c.phone}</a> : <span className="muted">bez telefonu</span>}
                        <div className="nl-cell-sub">{c.email || "bez e-mailu"}</div>
                      </td>
                      <td>
                        <select
                          className={`nl-status s-${c.status}`}
                          value={c.status}
                          onChange={(e) => changeStatus(c, e.target.value as ColdcallStatus)}
                          aria-label={`Stav firmy ${c.name}`}
                        >
                          {COLDCALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {COLDCALL_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      {teamReady && (
                        <td>
                          <select
                            className="nl-select nl-owner"
                            value={c.assigned_to || ""}
                            onChange={(e) => changeAssignee(c, e.target.value)}
                            aria-label={`Kdo řeší firmu ${c.name}`}
                          >
                            <option value="">—</option>
                            {team.map((t) => (
                              <option key={t.email} value={t.email}>
                                {t.display_name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="num">
                        {c.default_discount_type === "percent"
                          ? `${c.default_discount_value} %`
                          : fmtKc(Number(c.default_discount_value) || 0)}
                      </td>
                      <td className="muted">
                        {fmtDate(c.last_contacted_at)}
                        {c.last_contacted_by && <div className="nl-cell-sub">{nameOf(c.last_contacted_by)}</div>}
                      </td>
                      <td className="actions">
                        <button
                          type="button"
                          className="btn mini"
                          disabled={!c.email?.trim()}
                          title={c.email?.trim() ? undefined : "Doplň firmě e-mail"}
                          onClick={() => writeTo(c)}
                        >
                          Napsat mail
                        </button>
                        <button type="button" className="btn mini" onClick={() => setDraft(toDraft(c))}>
                          Upravit
                        </button>
                        <button
                          type="button"
                          className="btn mini danger"
                          disabled={busy === `row:${c.id}`}
                          onClick={() => remove(c)}
                          aria-label={`Smazat ${c.name}`}
                        >
                          Smazat
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={teamReady ? 7 : 6} className="muted" style={{ textAlign: "center", padding: 20 }}>
                        V tomhle filtru nic není.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <div className="nl-compose" id="nl-composer">
        <div className="nl-stack">
          <Panel
            title="Komu poslat"
            actions={
              <Segmented
                label="Způsob odeslání"
                value={mode}
                options={[
                  { value: "single", label: "Jedné firmě" },
                  { value: "bulk", label: "Hromadně podle stavu" },
                ]}
                onChange={setMode}
              />
            }
          >
            {mode === "single" ? (
              <div className="nl-grid">
                <label className="nl-field">
                  Firma
                  <select className="nl-select" value={targetId} onChange={(e) => pickTarget(e.target.value)}>
                    <option value="">Vyber firmu…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} disabled={!c.email?.trim()}>
                        {c.name}
                        {c.email?.trim() ? ` — ${c.email}` : " (bez e-mailu)"}
                        {c.assigned_to ? ` · řeší ${nameOf(c.assigned_to)}` : ""}
                      </option>
                    ))}
                  </select>
                  <span className="nl-hint">Sleva se předvyplní podle individuální slevy firmy, jde ale upravit níž.</span>
                </label>
                <label className="nl-check">
                  <input type="checkbox" checked={flipToJedname} onChange={(e) => setFlipToJedname(e.target.checked)} />
                  Po odeslání přepnout stav na „Jednáme“
                </label>
              </div>
            ) : (
              <div className="nl-grid">
                <div className="nl-field">
                  Firmy ve stavu
                  <div className="nl-pipeline">
                    {COLDCALL_STATUSES.map((s) => {
                      const n = withEmail.filter((c) => c.status === s).length;
                      return (
                        <button
                          key={s}
                          type="button"
                          className={`nl-stage s-${s}${bulkStatuses.includes(s) ? " is-on" : ""}`}
                          aria-pressed={bulkStatuses.includes(s)}
                          onClick={() => toggleBulkStatus(s)}
                        >
                          <i aria-hidden="true" />
                          {COLDCALL_STATUS_LABELS[s]} <span>{n}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="nl-hint">
                    Počty = firmy s vyplněným e-mailem. Každá dostane vlastní kód podle pravidel níž.
                  </span>
                </div>
                <label className="nl-check">
                  <input type="checkbox" checked={skipRecent} onChange={(e) => setSkipRecent(e.target.checked)} />
                  Přeskočit firmy, kterým někdo psal za posledních {CONTACT_COOLDOWN_DAYS} dní
                  {skipRecent && bulkSkipped > 0 ? ` (přeskočí se ${bulkSkipped})` : ""}
                </label>
                {teamReady && me && (
                  <label className="nl-check">
                    <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                    Jen firmy, které řeším já
                  </label>
                )}
              </div>
            )}
          </Panel>

          <Panel
            title="Obsah mailu"
            sub="Mail začíná oslovením „Dobrý den,“ a vykání."
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
                {" "}(bez něj bude kód na konci), <code>{"{sleva}"}</code> = výše slevy, <code>{"{firma}"}</code> = názvem firmy.
                </span>
              </label>
            </div>
          </Panel>

          <Panel title="Slevový kód">
            <CodeRulesEditor rules={rules} onChange={setRules} who={mode === "single" ? "Firma" : "Každá firma"} prefix="B2B" />
          </Panel>

          <ProductPicker
            products={products}
            selected={productIds}
            onChange={setProductIds}
            onLoadTop={loadTop}
            loadingTop={busy === "top"}
          />

          <Panel title="Odeslání">
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
            </div>

            <hr className="nl-divider" />

            <ul className="nl-ready">
              {warnings.map((w) => (
                <li key={w} className="is-warn">
                  {w}
                </li>
              ))}
              {missing.length === 0 ? (
                <li>
                  Vše připraveno:{" "}
                  {mode === "single" ? target?.email : `${bulkRecipients.length} firem`}, {productIds.length} produktů.
                </li>
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
                {busy === "send" ? "Odesílám… nezavírej stránku." : "Po odeslání se firmě zapíše datum posledního mailu."}
              </span>
              <button type="button" className="btn lg" onClick={() => setPreviewOpen(true)}>
                Náhled mailu
              </button>
              <button type="button" className="btn primary lg" disabled={!!busy || missing.length > 0} onClick={send}>
                {busy === "send" && <Spinner />}
                {busy === "send" ? "Odesílám…" : sendLabel}
              </button>
            </div>
          </Panel>
        </div>

        <EmailPreviewDialog
          open={previewOpen}
          onClose={closePreview}
          input={{
            kind: "coldcall",
            subject,
            introHtml: intro,
            productIds,
            codeRules: rules,
            recipientCompanyId: mode === "single" && targetId ? targetId : undefined,
          }}
          fromAddress={fromAddress}
          note={
            mode === "single" && !target
              ? "Náhled pro ukázkovou firmu — v části „Komu poslat“ vyber firmu a uvidíš mail přesně pro ni."
              : undefined
          }
        />
      </div>

      <CampaignHistory
        campaigns={campaigns}
        stats={campaignStats}
        retryingId={busy?.startsWith("retry:") ? busy.slice(6) : null}
        canRetry={resendReady && !busy}
        onRetry={retry}
        onReuse={reuse}
        usedLabel="kolik firem už slevu uplatnilo v objednávce. Maily jednotlivým firmám jsou v Historii e-mailů."
      />
    </div>
  );
}
