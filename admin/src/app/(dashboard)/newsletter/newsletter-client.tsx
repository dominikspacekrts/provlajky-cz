"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CampaignStats } from "@/lib/actions/newsletter";
import type {
  ColdcallCompany,
  NewsletterCampaign,
  NewsletterProductCard,
  NewsletterRider,
} from "@/lib/newsletter/types";
import ColdcallTab from "./coldcall-tab";
import RtsTab from "./rts-tab";
import type { Notify } from "./parts";

type Tab = "rts" | "coldcall";

type Props = {
  riders: NewsletterRider[];
  companies: ColdcallCompany[];
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  campaignStats: Record<string, CampaignStats>;
  resendReady: boolean;
  fromAddress: string;
};

export default function NewsletterClient(props: Props) {
  const [tab, setTab] = useState<Tab>("rts");
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error"; id: number } | null>(null);

  const notify = useCallback<Notify>((text, kind = "ok") => setToast({ text, kind, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const riderCount = props.riders.filter((r) => r.country === "CZ" || r.country === "SK").length;

  return (
    <div className="nl">
      <header className="nl-head">
        <div>
          <h2>Newsletter</h2>
          <p className="muted">Kampaně pro jezdce RTS a nabídky firmám z coldcallů. Každý příjemce dostane vlastní slevový kód.</p>
        </div>
        <span className={`nl-pill ${props.resendReady ? "ok" : "warn"}`}>
          {props.resendReady ? `Odesílá se z ${props.fromAddress}` : "Odesílání není nastavené"}
        </span>
      </header>

      {!props.resendReady && (
        <div className="nl-alert" role="status">
          Maily zatím nejde odeslat — chybí Resend API klíč.{" "}
          <Link href="/settings?tab=newsletter">Zadej ho v Nastavení → Newsletter</Link>. Náhled mailu funguje i bez něj.
        </div>
      )}

      <div className="nl-tabs" role="tablist" aria-label="Typ newsletteru">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "rts"}
          className={`nl-tab${tab === "rts" ? " is-active" : ""}`}
          onClick={() => setTab("rts")}
        >
          Jezdci RTS <span className="nl-count">{riderCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "coldcall"}
          className={`nl-tab${tab === "coldcall" ? " is-active" : ""}`}
          onClick={() => setTab("coldcall")}
        >
          Coldcall firmy <span className="nl-count">{props.companies.length}</span>
        </button>
      </div>

      {tab === "rts" ? (
        <RtsTab
          riders={props.riders}
          products={props.products}
          campaigns={props.campaigns.filter((c) => c.kind === "rts")}
          campaignStats={props.campaignStats}
          resendReady={props.resendReady}
          fromAddress={props.fromAddress}
          notify={notify}
        />
      ) : (
        <ColdcallTab
          companies={props.companies}
          products={props.products}
          campaigns={props.campaigns.filter((c) => c.kind === "coldcall")}
          campaignStats={props.campaignStats}
          resendReady={props.resendReady}
          fromAddress={props.fromAddress}
          notify={notify}
        />
      )}

      {toast && (
        <div key={toast.id} className={`nl-toast${toast.kind === "error" ? " is-error" : ""}`} role={toast.kind === "error" ? "alert" : "status"}>
          <span>{toast.text}</span>
          <button type="button" aria-label="Zavřít" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
