"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  CONSENT_ALL,
  CONSENT_NONE,
  CONSENT_UNKNOWN,
  CONSENT_VERSION,
  applyConsent,
  parseConsent,
  readConsentRaw,
  serverConsentSnapshot,
  subscribeConsent,
} from "@/lib/consent";

// Událost, kterou si vyžádá odkaz „Nastavení cookies" v patičce — lišta se
// otevře znovu i pro toho, kdo už jednou rozhodl.
export const OPEN_CONSENT_EVENT = "provlajky:open-consent";

export default function CookieBanner() {
  // Souhlas je externí stav (cookie), ne stav Reactu — proto useSyncExternalStore.
  const raw = useSyncExternalStore(subscribeConsent, readConsentRaw, serverConsentSnapshot);
  const saved = useMemo(() => (raw === CONSENT_UNKNOWN ? null : parseConsent(raw)), [raw]);

  const [reopened, setReopened] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const reopen = () => {
      const current = parseConsent(readConsentRaw());
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setShowDetails(true);
      setReopened(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  function decide(state: { analytics: boolean; marketing: boolean }) {
    applyConsent({ version: CONSENT_VERSION, ...state });
    setReopened(false);
    setShowDetails(false);
  }

  // Dokud běží server render, o cookie nic nevíme — lišta se neukáže.
  if (raw === CONSENT_UNKNOWN) return null;
  if (saved && !reopened) return null;

  return (
    <div className="cc" role="dialog" aria-modal="false" aria-label="Nastavení souhlasu s cookies">
      <div className="cc-panel">
        <div className="cc-text">
          <h2 className="cc-title">Cookies na provlajky.cz</h2>
          <p>
            Nezbytné cookies potřebujeme k fungování košíku a objednávky. S vaším souhlasem navíc měříme
            návštěvnost a vyhodnocujeme reklamu. Souhlas můžete kdykoliv změnit.{" "}
            <Link href="/ochrana-osobnich-udaju">Více o zpracování údajů</Link>
          </p>
        </div>

        {showDetails && (
          <div className="cc-cats">
            <label className="cc-cat">
              <input type="checkbox" checked disabled readOnly />
              <span>
                <strong>Nezbytné</strong>
                <em>Košík, objednávka a bezpečnost. Bez nich web nefunguje.</em>
              </span>
            </label>
            <label className="cc-cat">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              <span>
                <strong>Analytické</strong>
                <em>Anonymní statistiky návštěvnosti, ať víme, co na webu zlepšit.</em>
              </span>
            </label>
            <label className="cc-cat">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>
                <strong>Marketingové</strong>
                <em>Měření reklamy a nabídka relevantnějších inzerátů.</em>
              </span>
            </label>
          </div>
        )}

        <div className="cc-actions">
          <button type="button" className="cc-btn" onClick={() => decide(CONSENT_ALL)}>
            Přijmout vše
          </button>
          <button type="button" className="cc-btn" onClick={() => decide(CONSENT_NONE)}>
            Odmítnout vše
          </button>
          {showDetails ? (
            <button type="button" className="cc-btn" onClick={() => decide({ analytics, marketing })}>
              Uložit výběr
            </button>
          ) : (
            <button type="button" className="cc-btn" onClick={() => setShowDetails(true)}>
              Nastavení
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
