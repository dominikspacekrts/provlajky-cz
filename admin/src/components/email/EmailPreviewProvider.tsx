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
  onSent?: () => void | Promise<void>;
  /** Read-only mode for browsing past e-mails from Historie mailů — no editing, no send. */
  readOnly?: boolean;
};

type Ctx = { openEmailPreview: (req: EmailPreviewRequest) => void };

const EmailPreviewContext = createContext<Ctx | null>(null);

function attachmentBytes(a: SendEmailAttachment) {
  // base64 má ~4 znaky na 3 bajty; padding (=) se zaokrouhlí nahoru.
  return Math.ceil(((a.contentBase64?.length || 0) * 3) / 4);
}

function formatBytes(n: number) {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

// Vercel serverless má limit request body ~4,5 MB. Po base64 kódování to
// prakticky znamená max ~2,5 MB surových příloh — jinak spadne celá stránka.
const MAX_ATTACHMENTS_BYTES = 2.5 * 1024 * 1024;

function payloadTooLargeMessage(bytes: number) {
  return `Přílohy jsou moc velké na odeslání z adminu (${formatBytes(bytes)}, limit ${formatBytes(MAX_ATTACHMENTS_BYTES)}). Bez zmenšení by stránka spadla (Vercel Reload). U dodavatele by měly jít zmenšené JPG + odkaz na originál.`;
}

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
    setSuccess(false);
    const bytes = req.attachments.reduce((s, a) => s + attachmentBytes(a), 0);
    setError(bytes > MAX_ATTACHMENTS_BYTES ? payloadTooLargeMessage(bytes) : null);
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

  const attachmentsBytes = request ? request.attachments.reduce((s, a) => s + attachmentBytes(a), 0) : 0;
  const attachmentsTooBig = attachmentsBytes > MAX_ATTACHMENTS_BYTES;

  function handleSend() {
    if (!request) return;
    if (attachmentsTooBig) {
      setError(payloadTooLargeMessage(attachmentsBytes));
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
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
          try {
            await request.onSent?.();
          } catch {
            /* vedlejší akce (např. kopie účetní) nesmí shodit úspěch zákaznického mailu */
          }
          setTimeout(() => setRequest(null), 900);
        } else {
          setError(res.error || "Odeslání selhalo.");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e || "");
        if (/body|too large|Payload|413|FETCH_ERROR|Failed to fetch|NetworkError|unexpected response/i.test(msg)) {
          setError(payloadTooLargeMessage(attachmentsBytes));
        } else {
          setError(msg || "Odeslání selhalo. Zkus to znovu.");
        }
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
                <div>
                  <div className="chip-list">
                    {request.attachments.map((a) => {
                      const bytes = attachmentBytes(a);
                      return (
                        <span key={a.filename} className="chip" title={`${a.filename} · ${formatBytes(bytes)}`}>
                          📎 {a.filename} · {formatBytes(bytes)}
                        </span>
                      );
                    })}
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      margin: "6px 0 0",
                      color: attachmentsTooBig ? "#dc2626" : "var(--color-gray-500)",
                      fontWeight: attachmentsTooBig ? 600 : 400,
                    }}
                  >
                    Přílohy celkem: {formatBytes(attachmentsBytes)}
                    {attachmentsTooBig
                      ? ` — moc velké (limit ${formatBytes(MAX_ATTACHMENTS_BYTES)}). Odeslat nejde, stránka by spadla.`
                      : ""}
                  </p>
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
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleSend}
                    disabled={isPending || attachmentsTooBig}
                    title={attachmentsTooBig ? "Přílohy jsou moc velké" : undefined}
                  >
                    {isPending ? "Odesílám…" : attachmentsTooBig ? "Přílohy moc velké" : error ? "Zkusit znovu" : "Odeslat"}
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
