"use client";

import { useState, useTransition } from "react";
import { addSupplierInvoice, deleteSupplierInvoice } from "@/lib/actions/finance";
import { fmtMoney } from "@/lib/domain";
import type { SupplierInvoice } from "@/lib/types";

export default function SupplierInvoices({ orderId, invoices }: { orderId: string; invoices: SupplierInvoice[] }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountEur, setAmountEur] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [file, setFile] = useState<{ filename: string; dataUrl: string } | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const total = invoices.reduce((s, i) => s + (i.amount_czk || 0), 0);

  async function lookupRate() {
    setRateLoading(true);
    setRateNote(null);
    try {
      const res = await fetch(`/api/exchange-rate?date=${date}&currency=EUR`);
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Chyba ČNB API.");
      setRate(j.perUnit);
      setRateNote(`Kurz ČNB ${j.date}: ${j.perUnit.toFixed(3)} Kč/€`);
    } catch (e) {
      setRateNote(e instanceof Error ? e.message : "Chyba načtení kurzu.");
    } finally {
      setRateLoading(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFile({ filename: f.name, dataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  function handleAdd() {
    const eur = Number(amountEur);
    if (!eur || !rate) {
      setRateNote("Nejdřív zadej částku a vyčti kurz.");
      return;
    }
    startTransition(async () => {
      await addSupplierInvoice({
        order_id: orderId,
        date,
        amount: eur,
        exchange_rate: rate,
        filename: file?.filename ?? null,
        file_data: file?.dataUrl ?? null,
      });
      setAmountEur("");
      setRate(null);
      setRateNote(null);
      setFile(null);
    });
  }

  return (
    <div>
      <h3>Dodavatelské faktury</h3>
      <div className="sup-inv-list">
        {invoices.map((inv) => (
          <div key={inv.id} className="sup-inv-row">
            <span className="sii-file">
              {inv.filename ? (
                inv.file_data ? (
                  <a href={inv.file_data} target="_blank" rel="noreferrer">
                    {inv.filename}
                  </a>
                ) : (
                  inv.filename
                )
              ) : (
                new Date(inv.date || inv.created_at).toLocaleDateString("cs-CZ")
              )}
            </span>
            <span className="sii-eur">{fmtMoney(inv.amount || 0, "EUR")}</span>
            <span className="muted">{inv.exchange_rate ? `${inv.exchange_rate.toFixed(3)} Kč/€` : ""}</span>
            <span>{fmtMoney(inv.amount_czk || 0, "CZK")}</span>
            <button
              type="button"
              className="rm"
              onClick={() => startTransition(() => deleteSupplierInvoice(inv.id, orderId))}
              title="Smazat"
            >
              ×
            </button>
          </div>
        ))}
        {invoices.length === 0 && <p className="muted">Žádné dodavatelské faktury.</p>}
      </div>

      <div className="sup-inv-add">
        <div className="field">
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          Částka EUR
          <input type="number" step="0.01" value={amountEur} onChange={(e) => setAmountEur(e.target.value)} style={{ width: 110 }} />
        </div>
        <button type="button" className="btn" onClick={lookupRate} disabled={rateLoading}>
          {rateLoading ? "Načítám…" : "Vyčíst kurz a převést"}
        </button>
        <label className="btn" style={{ cursor: "pointer" }}>
          {file ? file.filename : "Přiložit účtenku"}
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} hidden />
        </label>
        <button type="button" className="btn primary" onClick={handleAdd} disabled={isPending || !rate}>
          {isPending ? "Přidávám…" : "Přidat fakturu"}
        </button>
      </div>
      {rateNote && <p className="muted" style={{ fontSize: 13 }}>{rateNote}</p>}

      {invoices.length > 0 && (
        <div className="sup-cost-summary">
          <div className="totals-row">
            <span>Náklady dodavateli celkem</span>
            <span>{fmtMoney(total, "CZK")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
