"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { previewNewsletterHtml, type CampaignStats, type PreviewCampaignInput } from "@/lib/actions/newsletter";
import type {
  NewsletterCampaign,
  NewsletterCampaignStatus,
  NewsletterProductCard,
  PromoCodeRules,
} from "@/lib/newsletter/types";

export const DEFAULT_RULES: PromoCodeRules = {
  discountType: "percent",
  discountValue: 10,
  oneShot: true,
  maxUses: 1,
  validDays: 30,
};

export const MAX_PRODUCTS = 6;

export type Notify = (text: string, kind?: "ok" | "error") => void;

export function fmtKc(n: number) {
  return Math.round(n).toLocaleString("cs-CZ") + " Kč";
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** „právě teď“, „před 5 min“, „před 3 h“, jinak datum a čas. */
export function fmtAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "právě teď";
  if (min < 60) return `před ${min} min`;
  if (min < 24 * 60) return `před ${Math.round(min / 60)} h`;
  return fmtDateTime(iso);
}

export const CAMPAIGN_STATUS_LABEL: Record<NewsletterCampaignStatus, string> = {
  draft: "Koncept",
  sending: "Odesílá se",
  sent: "Odesláno",
  partial: "Částečně",
  failed: "Selhalo",
};

export function Panel({
  title,
  sub,
  actions,
  children,
  id,
}: {
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="nl-panel" id={id}>
      <div className="nl-panel-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {actions && <div className="nl-panel-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="nl-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? "is-on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** Popis pravidel kódu jednou větou — to, co uvidí admin před odesláním. */
export function describeRules(rules: PromoCodeRules): string {
  const discount = rules.discountType === "percent" ? `${rules.discountValue} %` : fmtKc(rules.discountValue);
  const uses = rules.oneShot ? "1 použití" : `max. ${rules.maxUses ?? 1} použití`;
  let validity = "bez časového omezení";
  if (rules.validDays != null) {
    const d = new Date();
    d.setDate(d.getDate() + rules.validDays);
    validity = `platí ${rules.validDays} ${rules.validDays === 1 ? "den" : rules.validDays < 5 ? "dny" : "dní"} (do ${d.toLocaleDateString("cs-CZ")})`;
  }
  return `sleva ${discount}, ${uses}, ${validity}`;
}

export function CodeRulesEditor({
  rules,
  onChange,
  who,
  prefix,
}: {
  rules: PromoCodeRules;
  onChange: (r: PromoCodeRules) => void;
  /** „Každý jezdec“ / „Firma“ — podmět do shrnutí. */
  who: string;
  /** Výchozí začátek kódu, když ho admin nepřepíše. */
  prefix: string;
}) {
  const shownPrefix = rules.prefix ?? prefix;
  return (
    <>
      <div className="nl-grid cols-3">
        <div className="nl-field">
          Sleva
          <div className="nl-input-group">
            <input
              className="nl-input is-narrow"
              type="number"
              min={0}
              step={rules.discountType === "percent" ? 1 : 100}
              value={rules.discountValue}
              onChange={(e) => onChange({ ...rules, discountValue: Math.max(0, Number(e.target.value) || 0) })}
              aria-label="Výše slevy"
            />
            <Segmented
              label="Typ slevy"
              value={rules.discountType}
              options={[
                { value: "percent", label: "%" },
                { value: "fixed", label: "Kč" },
              ]}
              onChange={(v) => onChange({ ...rules, discountType: v })}
            />
          </div>
        </div>

        <div className="nl-field">
          Počet použití
          <div className="nl-input-group">
            <Segmented
              label="Počet použití"
              value={rules.oneShot ? "one" : "multi"}
              options={[
                { value: "one", label: "Jednorázový" },
                { value: "multi", label: "Víckrát" },
              ]}
              onChange={(v) =>
                onChange({
                  ...rules,
                  oneShot: v === "one",
                  maxUses: v === "one" ? 1 : Math.max(2, rules.maxUses || 2),
                })
              }
            />
            {!rules.oneShot && (
              <input
                className="nl-input is-narrow"
                type="number"
                min={2}
                value={rules.maxUses ?? 2}
                onChange={(e) => onChange({ ...rules, maxUses: Math.max(1, Number(e.target.value) || 1) })}
                aria-label="Maximální počet použití"
              />
            )}
          </div>
        </div>

        <div className="nl-field">
          Platnost
          <div className="nl-input-group" style={{ alignItems: "center" }}>
            <input
              className="nl-input is-narrow"
              type="number"
              min={1}
              disabled={rules.validDays == null}
              value={rules.validDays ?? ""}
              placeholder="—"
              onChange={(e) => onChange({ ...rules, validDays: Math.max(1, Number(e.target.value) || 1) })}
              aria-label="Platnost ve dnech"
            />
            <span style={{ fontWeight: 400 }}>dní</span>
          </div>
          <label className="nl-check" style={{ fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={rules.validDays == null}
              onChange={(e) => onChange({ ...rules, validDays: e.target.checked ? null : 30 })}
            />
            bez omezení
          </label>
        </div>
      </div>

      <label className="nl-field" style={{ marginTop: 14, maxWidth: 260 }}>
        Začátek kódu
        <input
          className="nl-input"
          value={shownPrefix}
          maxLength={12}
          placeholder={prefix}
          onChange={(e) =>
            onChange({ ...rules, prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) })
          }
          onBlur={() => {
            if (!rules.prefix) onChange({ ...rules, prefix });
          }}
          aria-describedby="nl-prefix-hint"
        />
        <span id="nl-prefix-hint" className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
          Za pomlčku se každému doplní 6 náhodných znaků.
        </span>
      </label>

      <div className="nl-summary">
        {who} dostane vlastní kód <strong>{(shownPrefix || prefix) + "-XXXXXX"}</strong>: {describeRules(rules)}.
        <br />
        <span className="muted">Zákazník v mailu i v košíku uvidí jen platnost, ne počet zbývajících použití.</span>
      </div>
    </>
  );
}

export function ProductPicker({
  products,
  selected,
  onChange,
  onLoadTop,
  loadingTop,
}: {
  products: NewsletterProductCard[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onLoadTop: () => void;
  loadingTop: boolean;
}) {
  const [query, setQuery] = useState("");
  const full = selected.length >= MAX_PRODUCTS;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (!full) onChange([...selected, id]);
  }

  return (
    <Panel
      title="Produkty v mailu"
      sub={
        selected.length
          ? `Vybráno ${selected.length} z ${MAX_PRODUCTS}. V mailu budou nad slevovým kódem, v pořadí výběru.`
          : "Nepovinné — bez produktů bude mail jen text a slevový kód."
      }
      actions={
        <>
          <button type="button" className="btn mini" disabled={loadingTop} onClick={onLoadTop}>
            {loadingTop ? "Načítám…" : "Načíst nejprodávanější"}
          </button>
          {selected.length > 0 && (
            <button type="button" className="btn mini ghost" onClick={() => onChange([])}>
              Zrušit výběr
            </button>
          )}
        </>
      }
    >
      {products.length > 8 && (
        <div className="nl-toolbar">
          <input
            className="nl-input"
            type="search"
            placeholder="Hledat produkt…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      {products.length === 0 ? (
        <div className="nl-empty">
          <strong>Žádné aktivní produkty</strong>
          Aktivuj produkty v sekci Produkty, pak je sem půjde přidat.
        </div>
      ) : (
        <div className="nl-products">
          {shown.map((p) => {
            const order = selected.indexOf(p.id);
            const on = order >= 0;
            return (
              <button
                key={p.id}
                type="button"
                className={`nl-product${on ? " is-on" : ""}`}
                disabled={!on && full}
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                title={!on && full ? `Maximálně ${MAX_PRODUCTS} produktů` : undefined}
              >
                {on && <span className="nl-product-order">{order + 1}</span>}
                <span className="nl-product-img">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" loading="lazy" />
                  ) : null}
                </span>
                <span className="nl-product-name">{p.name}</span>
                <span className="nl-product-price">{p.fromPrice > 0 ? `od ${fmtKc(p.fromPrice)}` : "bez ceny"}</span>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function CampaignHistory({
  campaigns,
  stats,
  retryingId,
  canRetry,
  onRetry,
  onReuse,
  usedLabel,
}: {
  campaigns: NewsletterCampaign[];
  stats: Record<string, CampaignStats>;
  retryingId: string | null;
  canRetry: boolean;
  onRetry: (c: NewsletterCampaign) => void;
  onReuse: (c: NewsletterCampaign) => void;
  usedLabel: string;
}) {
  return (
    <Panel title="Odeslané kampaně" sub={`Použité kódy = ${usedLabel}`}>
      {campaigns.length === 0 ? (
        <div className="nl-empty">
          <strong>Zatím nic neodešlo</strong>
          Po prvním odeslání tu uvidíš, kolik mailů odešlo a kolik kódů se využilo.
        </div>
      ) : (
        <div className="nl-table-wrap" style={{ maxHeight: 420 }}>
          <table className="nl-table">
            <thead>
              <tr>
                <th>Kampaň</th>
                <th>Stav</th>
                <th className="num">Odesláno</th>
                <th className="num">Použité kódy</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const st = stats[c.id] || { sent: 0, failed: 0, codesUsed: 0 };
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="nl-cell-main">{c.subject}</div>
                      <div className="nl-cell-sub">{fmtDateTime(c.sent_at || c.created_at)}</div>
                    </td>
                    <td>
                      <span className={`nl-badge ${c.status}`}>{CAMPAIGN_STATUS_LABEL[c.status] || c.status}</span>
                    </td>
                    <td className="num">
                      {st.sent}
                      {st.failed > 0 && <span style={{ color: "#991b1b" }}> · {st.failed} chyb</span>}
                    </td>
                    <td className="num">{st.codesUsed}</td>
                    <td className="actions">
                      {st.failed > 0 && (
                        <button
                          type="button"
                          className="btn mini"
                          disabled={!!retryingId || !canRetry}
                          onClick={() => onRetry(c)}
                        >
                          {retryingId === c.id ? "Posílám…" : "Zkusit znovu"}
                        </button>
                      )}
                      <button type="button" className="btn mini" onClick={() => onReuse(c)}>
                        Použít znovu
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

type PreviewData = { html: string; subject: string; to: string };

/**
 * Živý náhled: po každé změně obsahu (s krátkou prodlevou) si nechá
 * vyrenderovat přesně to HTML, které by odešlo — jen s ukázkovým kódem.
 */
export function EmailPreview({
  input,
  fromAddress,
  recipientPicker,
  note,
}: {
  input: PreviewCampaignInput;
  fromAddress: string;
  recipientPicker?: ReactNode;
  note?: ReactNode;
}) {
  const key = JSON.stringify(input);
  const [result, setResult] = useState<{ key: string; data: PreviewData | null; error: string | null } | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await previewNewsletterHtml(JSON.parse(key) as PreviewCampaignInput);
        if (cancelled) return;
        if (res.ok && res.data) setResult({ key, data: res.data, error: null });
        else setResult((prev) => ({ key, data: prev?.data ?? null, error: res.ok ? "Náhled se nepodařilo načíst." : res.error }));
      } catch (e) {
        if (!cancelled) {
          setResult((prev) => ({
            key,
            data: prev?.data ?? null,
            error: e instanceof Error ? e.message : "Náhled se nepodařilo načíst.",
          }));
        }
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  const updating = result?.key !== key;
  const data = result?.data;
  // Odkazy v náhledu otevírat mimo iframe.
  const srcDoc = data ? data.html.replace("<head>", '<head><base target="_blank">') : "";

  return (
    <aside className="nl-preview" aria-label="Náhled mailu">
      <div className="nl-preview-bar">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h3>Náhled mailu</h3>
          <span className={`nl-preview-state${updating ? "" : " is-idle"}`} aria-live="polite">
            {updating ? "Aktualizuji…" : ""}
          </span>
        </div>
        <Segmented
          label="Šířka náhledu"
          value={device}
          options={[
            { value: "desktop", label: "Počítač" },
            { value: "mobile", label: "Mobil" },
          ]}
          onChange={setDevice}
        />
      </div>
      {recipientPicker && <div className="nl-preview-who">{recipientPicker}</div>}
      <dl className="nl-inbox">
        <dt>Od</dt>
        <dd>{fromAddress}</dd>
        <dt>Komu</dt>
        <dd>{data?.to || "…"}</dd>
        <dt>Předmět</dt>
        <dd className="subject">{data?.subject || input.subject || "…"}</dd>
      </dl>
      {result?.error && <div className="nl-preview-error">{result.error}</div>}
      <div className="nl-frame-wrap">
        <iframe
          title="Náhled mailu"
          className={`nl-frame${device === "mobile" ? " is-mobile" : ""}`}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={srcDoc}
        />
      </div>
      <div className="nl-preview-foot">
        {note ?? "Kód v náhledu je ukázkový — každý příjemce dostane při odeslání vlastní."}
      </div>
    </aside>
  );
}
