"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { sendEmailAction, type SendEmailAttachment } from "@/lib/actions/send-email";
import type { EmailKind } from "@/lib/types";

export type EmailPreviewRequest = {
  kind: EmailKind;
  orderId?: string | null;
  invoiceId?: string | null;
  to: string;
  cc?: string[];
  subject: string;
  html: string;
  attachments: SendEmailAttachment[];
  onSent?: () => void;
  /** Read-only mode for browsing past e-mails from Historie mailů — no editing, no send. */
  readOnly?: boolean;
};

type Ctx = { openEmailPreview: (req: EmailPreviewRequest) => void };

const EmailPreviewContext = createContext<Ctx | null>(null);

export function useEmailPreview() {
  const ctx = useContext(EmailPreviewContext);
  if (!ctx) throw new Error("useEmailPreview must be used within EmailPreviewProvider");
  return ctx;
}

export default function EmailPreviewProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<EmailPreviewRequest | null>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [rawEdit, setRawEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function openEmailPreview(req: EmailPreviewRequest) {
    setRequest(req);
    setTo(req.to);
    setCc(req.cc || []);
    setCcInput("");
    setSubject(req.subject);
    setHtml(req.html);
    setRawEdit(false);
    setError(null);
    setSuccess(false);
  }

  function close() {
    setRequest(null);
  }

  function addCc() {
    const v = ccInput.trim();
    if (v && !cc.includes(v)) setCc([...cc, v]);
    setCcInput("");
  }

  function removeCc(addr: string) {
    setCc(cc.filter((c) => c !== addr));
  }

  function handleSend() {
    if (!request) return;
    setError(null);
    startTransition(async () => {
      const res = await sendEmailAction({
        kind: request.kind,
        orderId: request.orderId,
        invoiceId: request.invoiceId,
        to,
        cc,
        subject,
        html,
        attachments: request.attachments,
      });
      if (res.ok) {
        setSuccess(true);
        request.onSent?.();
        setTimeout(() => setRequest(null), 900);
      } else {
        setError(res.error || "Odeslání selhalo.");
      }
    });
  }

  return (
    <EmailPreviewContext.Provider value={{ openEmailPreview }}>
      {children}
      {request && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !isPending && close()}>
          <div className="modal modal-wide">
            <div className="modal-header">
              <h3>{request.readOnly ? "Náhled mailu" : "Náhled a odeslání mailu"}</h3>
              <button className="modal-close" onClick={close}>
                ×
              </button>
            </div>

            <div className="form-col" style={{ marginTop: 14 }}>
              <label>
                Komu
                <input value={to} onChange={(e) => setTo(e.target.value)} disabled={request.readOnly} />
              </label>

              <label>
                Kopie (CC)
                {!request.readOnly && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={ccInput}
                      placeholder="přidat e-mail a Enter"
                      onChange={(e) => setCcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCc();
                        }
                      }}
                    />
                    <button type="button" className="btn" onClick={addCc}>
                      Přidat
                    </button>
                  </div>
                )}
              </label>
              {cc.length > 0 && (
                <div className="chip-list">
                  {cc.map((c) => (
                    <span key={c} className="chip">
                      {c}
                      {!request.readOnly && (
                        <button className="rm" onClick={() => removeCc(c)} type="button">
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <label>
                Předmět
                <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={request.readOnly} />
              </label>

              {request.attachments.length > 0 && (
                <div className="chip-list">
                  {request.attachments.map((a) => (
                    <span key={a.filename} className="chip">
                      📎 {a.filename}
                    </span>
                  ))}
                </div>
              )}

              <div className="row-between">
                <span className="muted" style={{ fontSize: 12 }}>
                  Náhled (přesně to, co uvidí příjemce)
                </span>
                {!request.readOnly && (
                  <button type="button" className="btn mini" onClick={() => setRawEdit((v) => !v)}>
                    {rawEdit ? "Zobrazit náhled" : "Upravit HTML"}
                  </button>
                )}
              </div>

              {rawEdit ? (
                <textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={14}
                  style={{ fontFamily: "monospace", fontSize: 12 }}
                />
              ) : (
                <iframe
                  srcDoc={html}
                  sandbox=""
                  style={{ width: "100%", height: 360, border: "1px solid var(--color-border)", borderRadius: 8, background: "white" }}
                />
              )}

              {error && (
                <div style={{ color: "#dc2626", fontSize: 13, background: "#fee2e2", padding: "8px 10px", borderRadius: 6 }}>
                  Odeslání selhalo: {error}
                </div>
              )}
              {success && (
                <div style={{ color: "#166534", fontSize: 13, background: "#dcfce7", padding: "8px 10px", borderRadius: 6 }}>
                  ✅ Odesláno.
                </div>
              )}

              <div className="row-between" style={{ marginTop: 4 }}>
                <button type="button" className="btn" onClick={close}>
                  {request.readOnly ? "Zavřít" : "Zrušit"}
                </button>
                {!request.readOnly && (
                  <button type="button" className="btn primary" onClick={handleSend} disabled={isPending}>
                    {isPending ? "Odesílám…" : error ? "Zkusit znovu" : "Odeslat"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </EmailPreviewContext.Provider>
  );
}
