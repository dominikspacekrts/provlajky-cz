"use client";

import { useEffect, useMemo, useState } from "react";
import { listPromoCodes } from "@/lib/actions/newsletter";
import type { PromoCodeListRow, PromoCodeState } from "@/lib/newsletter/types";
import { PROMO_STATE_LABELS } from "@/lib/newsletter/types";
import { Panel, Segmented, Spinner, fmtDate, fmtKc, type Notify } from "./parts";

const STATES: PromoCodeState[] = ["active", "used", "expired"];

const STATE_HINT: Record<PromoCodeState, string> = {
  active: "Kódy, které zákazník ještě neuplatnil a platí. Jak ho někdo použije, přesune se mezi Použité.",
  used: "Kódy, které už někdo uplatnil v objednávce.",
  expired: "Kódy, kterým skončila platnost a nikdo je nepoužil.",
};

function discountLabel(r: PromoCodeListRow): string {
  return r.discountType === "percent" ? `${r.discountValue} %` : fmtKc(r.discountValue);
}

function usesLabel(r: PromoCodeListRow): string {
  const max = r.oneShot ? 1 : r.maxUses;
  if (!max || max === 1) return r.usedCount > 0 ? "použito" : "nepoužito";
  return `${r.usedCount} z ${max} použití`;
}

function validityLabel(r: PromoCodeListRow): string {
  if (!r.validUntil) return "bez omezení";
  return `do ${fmtDate(r.validUntil)}`;
}

export default function CodesTab({ notify }: { notify: Notify }) {
  const [state, setState] = useState<PromoCodeState>("active");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const requestKey = `${state}:${reloadKey}`;
  const [result, setResult] = useState<{
    key: string;
    rows: PromoCodeListRow[];
    counts: Record<PromoCodeState, number>;
    truncated: boolean;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPromoCodes(state).then((res) => {
      if (cancelled) return;
      setResult((prev) => ({
        key: requestKey,
        rows: res.ok ? res.data!.rows : [],
        counts: res.ok ? res.data!.counts : (prev?.counts ?? { active: 0, used: 0, expired: 0 }),
        truncated: res.ok ? res.data!.truncated : false,
        error: res.ok ? null : res.error,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [state, requestKey]);

  const loading = result?.key !== requestKey;
  const rows = useMemo(() => (result?.key === requestKey ? result.rows : []), [result, requestKey]);
  const counts = result?.counts ?? { active: 0, used: 0, expired: 0 };
  const truncated = result?.key === requestKey && result.truncated;
  const error = result?.key === requestKey ? result.error : null;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.code, r.recipient?.name, r.recipient?.email, r.campaignSubject, r.orderNumber].some((v) =>
        (v || "").toLowerCase().includes(q)
      )
    );
  }, [rows, query]);

  async function copy(r: PromoCodeListRow) {
    try {
      await navigator.clipboard.writeText(r.code);
      setCopiedId(r.id);
      setTimeout(() => setCopiedId((id) => (id === r.id ? null : id)), 1500);
    } catch {
      notify("Kód se nepodařilo zkopírovat. Označ ho myší a zkopíruj ručně.", "error");
    }
  }

  return (
    <div className="nl-stack">
      <Panel
        title="Slevové kódy"
        sub="Každý mail vytvoří příjemci vlastní kód. Tady je vidět, komu jaký kód patří a jestli už ho použil."
        actions={
          <button type="button" className="btn mini" disabled={loading} onClick={() => setReloadKey((k) => k + 1)}>
            {loading ? "Načítám…" : "Obnovit"}
          </button>
        }
      >
        <div className="nl-toolbar">
          <Segmented
            label="Stav kódů"
            value={state}
            options={STATES.map((s) => ({ value: s, label: `${PROMO_STATE_LABELS[s]} (${counts[s]})` }))}
            onChange={setState}
          />
          <input
            className="nl-input"
            type="search"
            placeholder="Hledat kód, firmu, jezdce, objednávku…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            {shown.length === rows.length ? `${rows.length} kódů` : `${shown.length} z ${rows.length}`}
          </span>
        </div>

        <p className="nl-hint" style={{ marginBottom: 12 }}>
          {STATE_HINT[state]}
          {truncated && ` Zobrazuje se posledních ${rows.length} kódů — starší najdeš přes hledání v Supabase.`}
        </p>

        {error ? (
          <div className="nl-alert" role="alert">
            {error}
          </div>
        ) : loading ? (
          <div className="nl-empty">
            <Spinner /> Načítám kódy…
          </div>
        ) : shown.length === 0 ? (
          <div className="nl-empty">
            <strong>{query.trim() ? "Nic nenalezeno" : "Žádné kódy"}</strong>
            {query.trim()
              ? "Zkus hledat podle jiné části kódu nebo názvu firmy."
              : state === "active"
                ? "Kódy se vytvoří samy, jakmile odešleš mail jezdcům nebo firmě."
                : "Tady se kódy objeví, až je zákazníci začnou uplatňovat."}
          </div>
        ) : (
          <div className="nl-table-wrap" style={{ maxHeight: 620 }}>
            <table className="nl-table">
              <thead>
                <tr>
                  <th>Komu</th>
                  <th>Kód</th>
                  <th className="num">Sleva</th>
                  <th>Platnost</th>
                  <th>{state === "used" ? "Použití" : "Stav"}</th>
                  <th>Vytvořeno</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="nl-cell-main">
                        {r.recipient?.name || <span className="muted">bez příjemce</span>}
                        {r.recipient && (
                          <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                            {r.recipient.kind === "company" ? "firma" : "jezdec"}
                          </span>
                        )}
                      </div>
                      {r.recipient?.email && <div className="nl-cell-sub">{r.recipient.email}</div>}
                      {r.campaignSubject && (
                        <div className="nl-cell-sub" title={r.campaignSubject}>
                          {r.campaignSubject}
                        </div>
                      )}
                    </td>
                    <td>
                      <code className="nl-code">{r.code}</code>
                    </td>
                    <td className="num">{discountLabel(r)}</td>
                    <td className="muted">{validityLabel(r)}</td>
                    <td className="muted">
                      {usesLabel(r)}
                      {r.orderNumber && <div className="nl-cell-sub">objednávka {r.orderNumber}</div>}
                    </td>
                    <td className="muted">{fmtDate(r.createdAt)}</td>
                    <td className="actions">
                      <button type="button" className="btn mini" onClick={() => copy(r)}>
                        {copiedId === r.id ? "Zkopírováno" : "Kopírovat"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
