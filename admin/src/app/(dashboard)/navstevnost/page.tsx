import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  PERIOD_LABELS,
  PERIODS,
  aggregateVisits,
  formatDuration,
  isMissingVisitsTable,
  loadVisitRows,
  parsePeriod,
  type Period,
} from "@/lib/visits";

export const dynamic = "force-dynamic";

const PERIOD_HINT: Record<Period, string> = {
  den: "Dnešek po hodinách (čas Prahy).",
  tyden: "Posledních 7 dní.",
  mesic: "Aktuální měsíc po dnech.",
  rok: "Aktuální rok po měsících.",
  celkem: "Všechny uložené návštěvy po rocích.",
};

const COUNTRY_NAMES: Record<string, string> = {
  CZ: "Česko",
  SK: "Slovensko",
  PL: "Polsko",
  DE: "Německo",
  AT: "Rakousko",
  HU: "Maďarsko",
  GB: "Velká Británie",
  US: "USA",
};

export default async function NavstevnostPage({
  searchParams,
}: {
  searchParams: Promise<{ obdobi?: string }>;
}) {
  const { obdobi } = await searchParams;
  const period = parsePeriod(obdobi);
  const supabase = await createClient();
  const loaded = await loadVisitRows(supabase, period);
  const missing = isMissingVisitsTable(loaded.error);
  const stats = missing || loaded.error ? null : aggregateVisits(loaded.rows, period);
  if (stats) stats.truncated = loaded.truncated;
  const max = Math.max(1, ...(stats?.buckets.map((bucket) => bucket.count) || [1]));

  return (
    <div>
      <h2>Návštěvnost</h2>
      <p className="muted">
        Vlastní počítání na webu — bez přihlašování do Google Ads, Mety ani Skliku. Počítá se jen po souhlasu
        s analytickými cookies. E-mail, reklamy a vyhledávání se poznají z odkazu (UTM / gclid / fbclid…).
      </p>

      <div className="period-switch">
        {PERIODS.map((item) => (
          <Link
            key={item}
            href={item === "den" ? "/navstevnost" : `/navstevnost?obdobi=${item}`}
            className={`btn mini${item === period ? " active" : ""}`}
          >
            {PERIOD_LABELS[item]}
          </Link>
        ))}
      </div>
      <p className="muted">{PERIOD_HINT[period]}</p>

      {missing && (
        <p className="visit-note">
          Chybí tabulka návštěv. V Supabase SQL Editoru spusť soubor{" "}
          <code>admin/supabase/2026-09-page-views.sql</code>.
        </p>
      )}
      {loaded.error && !missing && <p className="visit-note">{loaded.error.message}</p>}

      {stats && (
        <>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="label">Zobrazení stránek</div>
              <div className="value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <div className="label">Unikátní návštěvníci</div>
              <div className="value">{stats.unique}</div>
            </div>
            <div className="stat-card">
              <div className="label">Návštěvy (session)</div>
              <div className="value">{stats.sessions}</div>
            </div>
            <div className="stat-card">
              <div className="label">Prokliky z e-mailu</div>
              <div className="value">{stats.emailClicks}</div>
            </div>
            <div className="stat-card">
              <div className="label">Prům. čas na stránce</div>
              <div className="value visit-source">{formatDuration(stats.avgPageSec)}</div>
            </div>
            <div className="stat-card">
              <div className="label">Prům. čas návštěvy</div>
              <div className="value visit-source">{formatDuration(stats.avgSessionSec)}</div>
            </div>
          </div>

          {stats.truncated && <p className="visit-note">Zobrazeno je jen posledních 20 000 záznamů.</p>}

          <h3>Návštěvy v období</h3>
          <div className="visit-bars">
            {stats.buckets.map((bucket) => (
              <div key={bucket.key} className="visit-bar">
                <span>{bucket.label}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${Math.round((bucket.count / max) * 100)}%` }} />
                </div>
                <strong>{bucket.count}</strong>
              </div>
            ))}
          </div>

          <div className="visit-split">
            <section>
              <h3>Odkud přišli</h3>
              {stats.sources.length === 0 ? (
                <p className="muted">V tomhle období zatím žádná návštěva.</p>
              ) : (
                <table className="visit-table">
                  <tbody>
                    {stats.sources.map((source) => (
                      <tr key={source.key}>
                        <td>{source.label}</td>
                        <td>{source.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section>
              <h3>Nejsledovanější stránky</h3>
              {stats.pages.length === 0 ? (
                <p className="muted">Zatím nic.</p>
              ) : (
                <table className="visit-table">
                  <thead>
                    <tr>
                      <th>Stránka</th>
                      <th>Zobr.</th>
                      <th>Čas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.pages.map((page) => (
                      <tr key={page.path}>
                        <td className="visit-path">{page.path}</td>
                        <td>{page.count}</td>
                        <td>{formatDuration(page.avgSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section>
              <h3>Odkud jsou (země)</h3>
              {stats.countries.length === 0 ? (
                <p className="muted">Země se doplní z hostingu, jakmile návštěva přijde z produkce.</p>
              ) : (
                <table className="visit-table">
                  <tbody>
                    {stats.countries.map((country) => (
                      <tr key={country.code}>
                        <td>{COUNTRY_NAMES[country.code] || country.code}</td>
                        <td>{country.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
