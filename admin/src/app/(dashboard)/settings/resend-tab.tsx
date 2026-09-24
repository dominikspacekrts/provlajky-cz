"use client";

import { useState, useTransition } from "react";
import {
  deleteResendSettings,
  saveResendSettings,
  testResendSettings,
  type ResendSettingsStatus,
} from "@/lib/actions/resend-settings";

type Msg = { kind: "ok" | "warn" | "error"; text: string } | null;

const MSG_STYLE: Record<"ok" | "warn" | "error", React.CSSProperties> = {
  ok: { background: "#f0fdf4", borderLeft: "3px solid #16a34a" },
  warn: { background: "#fffbeb", borderLeft: "3px solid #f59e0b" },
  error: { background: "#fef2f2", borderLeft: "3px solid #ef4444" },
};

export default function ResendTab({ initial }: { initial: ResendSettingsStatus | null }) {
  const [status, setStatus] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(initial?.fromEmail || "newsletter@provlajky.cz");
  const [fromName, setFromName] = useState(initial?.fromName || "PROVLAJKY");
  const [msg, setMsg] = useState<Msg>(null);
  const [isPending, startTransition] = useTransition();

  if (!status) {
    return <p className="muted">Stav Resendu se nepodařilo načíst. Zkus obnovit stránku.</p>;
  }

  const hasStoredKey = status.source === "settings";

  function save() {
    startTransition(async () => {
      setMsg(null);
      const res = await saveResendSettings({ apiKey, fromEmail, fromName });
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      if (res.data) setStatus(res.data);
      setApiKey("");
      setMsg(
        res.warning
          ? { kind: "warn", text: `Uloženo, ale pozor: ${res.warning}` }
          : { kind: "ok", text: "Uloženo. Klíč je ověřený a newsletter může odesílat." }
      );
    });
  }

  function test() {
    startTransition(async () => {
      setMsg(null);
      const res = await testResendSettings();
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      setMsg(res.warning ? { kind: "warn", text: res.warning } : { kind: "ok", text: "Klíč funguje a doména je ověřená." });
    });
  }

  function remove() {
    if (!confirm("Smazat uložený Resend klíč? Newsletter pak nepůjde odesílat.")) return;
    startTransition(async () => {
      setMsg(null);
      const res = await deleteResendSettings();
      if (!res.ok) return setMsg({ kind: "error", text: res.error });
      if (res.data) setStatus(res.data);
      setMsg({ kind: "ok", text: "Klíč smazán." });
    });
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <p className="muted" style={{ marginTop: 0 }}>
        Přes Resend odchází newsletter (jezdci RTS, coldcall). Potvrzení objednávek a faktury dál jdou přes SMTP v záložce Maily.
      </p>

      {status.tableMissing && (
        <p style={{ ...MSG_STYLE.error, padding: "12px 14px" }}>
          Nejdřív je potřeba jednou spustit v Supabase → SQL Editor soubor <code>admin/supabase/2026-09-app-secrets.sql</code>.
          Založí zabezpečenou tabulku, kam se klíč uloží.
        </p>
      )}

      <div style={{ background: "#f7f8f9", padding: "12px 14px", borderRadius: 8, marginBottom: 16 }}>
        <strong>Stav: </strong>
        {status.source === "settings" && (
          <>
            klíč <code>{status.hint}</code> uložený v adminu
            {status.updatedAt && <span className="muted"> · změněno {new Date(status.updatedAt).toLocaleString("cs-CZ")}</span>}
          </>
        )}
        {status.source === "env" && (
          <>
            používá se klíč <code>{status.hint}</code> z proměnných prostředí na Vercelu. Klíč zadaný tady bude mít přednost.
          </>
        )}
        {status.source === "none" && <>žádný klíč není nastavený — newsletter zatím nejde odesílat.</>}
      </div>

      <div className="mail-grid">
        <label className="full">
          Resend API klíč
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            placeholder={hasStoredKey ? `Uložený ${status.hint} — pro změnu vlož nový` : "re_…"}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            Najdeš ho v Resend → API Keys. Uloží se zašifrovaný a po uložení už ho tu nikdo neuvidí celý.
          </span>
        </label>
        <label>
          E-mail odesílatele
          <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="newsletter@provlajky.cz" />
          <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
            Doména musí být v Resend ověřená.
          </span>
        </label>
        <label>
          Jméno odesílatele
          <input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="PROVLAJKY" />
        </label>
      </div>

      <div className="header-actions" style={{ marginTop: 14 }}>
        <button
          className="btn primary"
          disabled={isPending || status.tableMissing || (!apiKey.trim() && !hasStoredKey)}
          onClick={save}
        >
          {isPending ? "Ověřuji…" : "Ověřit a uložit"}
        </button>
        {status.source !== "none" && (
          <button className="btn" disabled={isPending} onClick={test}>
            Otestovat klíč
          </button>
        )}
        {hasStoredKey && (
          <button className="btn" disabled={isPending} onClick={remove}>
            Smazat klíč
          </button>
        )}
      </div>

      {msg && (
        <p role="status" style={{ ...MSG_STYLE[msg.kind], padding: "10px 14px", marginTop: 14 }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
