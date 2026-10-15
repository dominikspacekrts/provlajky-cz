"use client";

import { useState, useTransition } from "react";
import { addSupplierInvoice, deleteSupplierInvoice, getSupplierInvoiceFile } from "@/lib/actions/finance";
import { fmtMoney } from "@/lib/domain";
import type { SupplierInvoice } from "@/lib/types";

export default function SupplierInvoices({ orderId, invoices }: { orderId: string; invoices: SupplierInvoice[] }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<"EUR" | "CZK">("EUR");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateNote, setRateNote] = useState<string | null>(null);
  const [file, setFile] = useState<{ filename: string; dataUrl: string } | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const total = invoices.reduce((s, i) => s + (i.amount_czk || 0), 0);
  const amountNum = Number(String(amount).replace(",", "."));
  const previewCzk =
    currency === "CZK"
      ? amountNum
      : rate != null && amountNum > 0
        ? amountNum * rate
        : null;

  function switchCurrency(next: "EUR" | "CZK") {
    setCurrency(next);
    setRate(null);
    setRateNote(null);
  }

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
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setRateNote("Zadej částku větší než 0.");
      return;
    }
    if (currency === "EUR" && !rate) {
      setRateNote("Nejdřív zadej částku a vyčti kurz.");
      return;
    }
    startTransition(async () => {
      try {
        await addSupplierInvoice({
          order_id: orderId,
          date,
          amount: currency === "EUR" ? amountNum : null,
          exchange_rate: currency === "EUR" ? rate : null,
          amount_czk: currency === "CZK" ? amountNum : null,
          filename: file?.filename ?? null,
          file_data: file?.dataUrl ?? null,
        });
        setAmount("");
        setRate(null);
        setRateNote(null);
        setFile(null);
      } catch (e) {
        setRateNote(e instanceof Error ? e.message : "Fakturu se nepodařilo uložit.");
      }
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
                  <button
                    type="button"
                    className="linkish"
                    style={{ background: "none", border: 0, padding: 0, color: "inherit", cursor: "pointer", textDecoration: "underline" }}
                    onClick={() =>
                      startTransition(async () => {
                        const file = await getSupplierInvoiceFile(inv.id);
                        if (!file?.file_data) {
                          alert("Soubor faktury se nepodařilo načíst.");
                          return;
                        }
                        window.open(file.file_data, "_blank", "noopener,noreferrer");
                      })
                    }
                  >
                    {inv.filename}
                  </button>
                )
              ) : (
                new Date(inv.date || inv.created_at).toLocaleDateString("cs-CZ")
              )}
            </span>
            <span className="sii-eur">
              {inv.exchange_rate ? fmtMoney(inv.amount || 0, "EUR") : "Kč"}
            </span>
            <span className="muted">
              {inv.exchange_rate ? `${inv.exchange_rate.toFixed(3)} Kč/€` : "zadáno v Kč"}
            </span>
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
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setRate(null);
              setRateNote(null);
            }}
          />
        </div>
        <div className="field">
          Měna
          <div className="cur-switch">
            <button type="button" className={currency === "EUR" ? "active" : ""} onClick={() => switchCurrency("EUR")}>
              EUR
            </button>
            <button type="button" className={currency === "CZK" ? "active" : ""} onClick={() => switchCurrency("CZK")}>
              Kč
            </button>
          </div>
        </div>
        <div className="field">
          {currency === "EUR" ? "Částka EUR" : "Částka Kč"}
          <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 120 }} />
        </div>
        {currency === "EUR" && (
          <button type="button" className="btn" onClick={lookupRate} disabled={rateLoading}>
            {rateLoading ? "Načítám…" : "Vyčíst kurz a převést"}
          </button>
        )}
        <label className="btn" style={{ cursor: "pointer" }}>
          {file ? file.filename : "Přiložit účtenku"}
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} hidden />
        </label>
        <button
          type="button"
          className="btn primary"
          onClick={handleAdd}
          disabled={isPending || (currency === "EUR" ? !rate || !(amountNum > 0) : !(amountNum > 0))}
        >
          {isPending ? "Přidávám…" : "Přidat fakturu"}
        </button>
      </div>
      {rateNote && <p className="muted" style={{ fontSize: 13 }}>{rateNote}</p>}
      {previewCzk != null && previewCzk > 0 && (
        <p className="muted" style={{ fontSize: 13 }}>
          {currency === "EUR"
            ? `Do nákladů se zapíše ${fmtMoney(previewCzk, "CZK")}.`
            : `Uloží se rovnou ${fmtMoney(previewCzk, "CZK")}, bez přepočtu kurzem.`}
        </p>
      )}

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
