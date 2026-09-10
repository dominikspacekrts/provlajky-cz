"use client";

// Sdílené UI chrome konfigurátorů — kontakt nad náhledem, mobilní kroky,
// desktopová hlavička panelu a dialog po přidání do košíku. Vzor je
// FlagConfigurator (plážové vlajky); ostatní konfigurátory jen skládají
// stejné díly.

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CheckMark, MailMark } from "@/components/Icons";

export function FcContactLink() {
  return (
    <Link href="/kontakt" target="_blank" className="fc-contact-link">
      <MailMark className="fc-contact-link-icon" />
      <span>Kontaktujte nás</span>
    </Link>
  );
}

export function FcDesktopHeader({ name, subtitle }: { name: string; subtitle?: string | null }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" className="config-hero-logo" style={{ marginBottom: 14 }} />
      <h1 style={{ fontSize: 23 }}>{name}</h1>
      {subtitle ? <p style={{ color: "var(--gray)", marginTop: 4, fontSize: 13.5 }}>{subtitle}</p> : null}
    </>
  );
}

export function FcStepHeader({ steps, step }: { steps: readonly string[]; step: number }) {
  return (
    <>
      <div className="fc-step-head">
        <span className="fc-step-name">{steps[step]}</span>
        <span className="fc-step-count">
          Krok {step + 1} ze {steps.length}
        </span>
      </div>
      <div className="fc-step-bar" aria-hidden="true">
        {steps.map((s, i) => (
          <i key={s} className={i <= step ? "is-done" : undefined} />
        ))}
      </div>
    </>
  );
}

export function FcStepBody({ step, children }: { step: number; children: ReactNode }) {
  return (
    <div className="fc-step" key={step}>
      {children}
    </div>
  );
}

export function FcStepNav({
  step,
  stepsCount,
  onBack,
  onNext,
}: {
  step: number;
  stepsCount: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const isLast = step >= stepsCount - 1;
  return (
    <div className="fc-step-nav">
      {step > 0 ? (
        <button type="button" className="fc-step-back" onClick={onBack}>
          Zpět
        </button>
      ) : (
        <span />
      )}
      {!isLast && (
        <button type="button" className="btn-yellow" onClick={onNext}>
          Pokračovat
        </button>
      )}
    </div>
  );
}

export function AddedToCartDialog({
  open,
  onClose,
  summary,
}: {
  open: boolean;
  onClose: () => void;
  summary: string;
}) {
  const router = useRouter();
  if (!open) return null;
  return (
    <div className="editor-backdrop" onClick={onClose}>
      <div className="ask-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ask-check">
          <CheckMark />
        </div>
        <h2>Přidáno do košíku</h2>
        <p>{summary}</p>
        <div className="ask-actions">
          <button className="btn-yellow" onClick={() => router.push("/kosik")}>
            K pokladně
          </button>
          <button className="btn-outline" onClick={onClose}>
            Pokračovat v nákupu
          </button>
        </div>
      </div>
    </div>
  );
}
