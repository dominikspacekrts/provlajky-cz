"use client";

import { useMemo, useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import type { EmailHistoryRow, EmailKind } from "@/lib/types";

const KIND_LABELS: Record<EmailKind, string> = {
  invoice: "Faktura",
  visual: "Vizualizace",
  accountant: "Účetní",
  supplier: "Dodavatel",
  other: "Ostatní",
};

export default function EmailHistoryList({ rows }: { rows: EmailHistoryRow[] }) {
  const { openEmailPreview } = useEmailPreview();
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.to_addr.toLowerCase().includes(q) && !r.subject.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, kindFilter, search]);

  function open(row: EmailHistoryRow) {
    openEmailPreview({
      kind: row.kind,
      orderId: row.order_id,
      invoiceId: row.invoice_id,
      to: row.to_addr,
      cc: row.cc,
      subject: row.subject,
      html: row.html_body,
      attachments: [],
      readOnly: true,
    });
  }

  return (
    <div>
      <div className="orders-toolbar">
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="all">Všechny typy</option>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          placeholder="Hledat podle příjemce nebo předmětu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "7px 10px", border: "1px solid var(--color-border-input)", borderRadius: 6, minWidth: 260 }}
        />
      </div>

      <div className="orders-list">
        {filtered.map((r) => (
          <div key={r.id} className="order-card" onClick={() => open(r)}>
            <div>
              <div className="title">{r.subject}</div>
              <div className="meta">
                {r.to_addr}
                {r.cc.length > 0 ? ` (+ ${r.cc.length} v kopii)` : ""} · {new Date(r.sent_at).toLocaleString("cs-CZ")} · odeslal{" "}
                {r.sent_by}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="status-badge status-local">{KIND_LABELS[r.kind]}</span>
              <span className={`status-badge ${r.status === "sent" ? "status-completed" : "status-cancelled"}`}>
                {r.status === "sent" ? "Odesláno" : "Chyba"}
              </span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="muted">Žádné odeslané maily.</p>}
      </div>
    </div>
  );
}
