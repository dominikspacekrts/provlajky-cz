"use client";

import { useState, useTransition } from "react";
import { runMigrationImport, type LegacyExport, type MigrationSummary } from "@/lib/actions/migrate";

export default function MigratePage() {
  const [data, setData] = useState<LegacyExport | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSummary(null);
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as LegacyExport;
        if (!parsed.orders || !parsed.settings) throw new Error("Soubor neobsahuje očekávaná data (orders/settings).");
        setData(parsed);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Neplatný JSON soubor.");
        setData(null);
      }
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!data) return;
    startTransition(async () => {
      const res = await runMigrationImport(data);
      setSummary(res);
    });
  }

  return (
    <div>
      <h2>Migrace dat ze staré appky</h2>
      <p className="muted">
        Jednorázový import. V staré appce: Nastavení → Export dat → „Exportovat vše (JSON)&rdquo;. Soubor nahraj níže, zkontroluj počty a
        spusť import. Import je bezpečné spustit vícekrát — záznamy se párují podle původního ID, takže se neduplikují.
      </p>

      <div className="form-col" style={{ maxWidth: 480 }}>
        <label>
          JSON export
          <input type="file" accept="application/json" onChange={handleFile} />
        </label>
      </div>
      {fileError && <p style={{ color: "#dc2626" }}>{fileError}</p>}

      {data && (
        <div className="stats-cards" style={{ marginTop: 16 }}>
          <div className="stat-card">
            <div className="label">Objednávky</div>
            <div className="value">{data.orders?.length || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Faktury</div>
            <div className="value">{data.invoices?.length || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Výplaty</div>
            <div className="value">{data.payouts?.length || 0}</div>
          </div>
          <div className="stat-card">
            <div className="label">Partneři</div>
            <div className="value">{data.settings?.partners?.length || 0}</div>
          </div>
        </div>
      )}

      {data && (
        <button className="btn primary" onClick={handleImport} disabled={isPending}>
          {isPending ? "Importuji…" : "Spustit import"}
        </button>
      )}

      {summary && (
        <div style={{ marginTop: 20 }}>
          <h3>Výsledek</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>Tabulka</th>
                <th>Importováno</th>
                <th>Selhalo</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([table, r]) => (
                <tr key={table}>
                  <td style={{ textAlign: "left" }}>{table}</td>
                  <td>{r.ok}</td>
                  <td>{r.failed > 0 ? r.failed : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
