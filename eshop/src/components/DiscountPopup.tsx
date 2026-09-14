"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

type Status = "idle" | "loading" | "done" | "error";

type DiscountPopupCtx = {
  open: boolean;
  openDiscountPopup: () => void;
  closeDiscountPopup: () => void;
};

const Ctx = createContext<DiscountPopupCtx | null>(null);

export function useDiscountPopup() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDiscountPopup must be used within DiscountPopupProvider");
  return ctx;
}

function DiscountSignupForm({ onDone }: { onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setMessage("Zadejte prosím e-mail.");
      return;
    }
    if (!consent) {
      setStatus("error");
      setMessage("Bez souhlasu se zpracováním e-mailu nemůžeme kód poslat.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/registrace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setStatus("error");
        setMessage(json.error || "Nepodařilo se odeslat.");
        return;
      }
      setStatus("done");
      setMessage(json.message || "Kód jsme poslali na e-mail.");
      onDone?.();
    } catch {
      setStatus("error");
      setMessage("Nepodařilo se odeslat, zkuste to znovu.");
    }
  }

  if (status === "done") {
    return (
      <div className="discount-popup-done">
        <p>{message}</p>
        <p className="discount-popup-hint">
          Kód uplatníte v objednávce tlačítkem „Uplatnit“.{" "}
          <Link href="/objednavka">Přejít k objednávce</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="discount-popup-form" onSubmit={submit}>
      <label className="nv-register-field">
        <span>E-mail</span>
        <input
          type="email"
          required
          placeholder="vas@email.cz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
        />
      </label>
      <label className="nv-register-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Souhlasím se zpracováním e-mailu za účelem zaslání slevového kódu a obchodních sdělení. Souhlas můžu
          kdykoliv odvolat. Víc v{" "}
          <Link href="/ochrana-osobnich-udaju" target="_blank">
            zásadách ochrany osobních údajů
          </Link>
          .
        </span>
      </label>
      {message && status === "error" && <p className="nv-register-error">{message}</p>}
      <button type="submit" className="nv-btn nv-btn-yellow" disabled={status === "loading"}>
        <span className="nv-btn-l">{status === "loading" ? "Odesílám…" : "Získat 10% slevu"}</span>
      </button>
    </form>
  );
}

function DiscountPopupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="discount-popup-root" role="presentation">
      <button type="button" className="discount-popup-backdrop" onClick={onClose} aria-label="Zavřít" tabIndex={-1} />
      <div
        className="discount-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discount-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="discount-popup-close" onClick={onClose} aria-label="Zavřít">
          ×
        </button>
        <h2 id="discount-popup-title" className="discount-popup-title">
          Sleva 10 % na první objednávku
        </h2>
        <p className="discount-popup-body">
          Zadejte e-mail — pošleme vám jednorázový slevový kód. Účet s heslem nepotřebujete.
        </p>
        <DiscountSignupForm />
        <p className="discount-popup-account">
          Chcete i uložené adresy a historii objednávek?{" "}
          <Link href="/registrace" onClick={onClose}>
            Vytvořit účet
          </Link>
        </p>
      </div>
    </div>
  );
}

export function DiscountPopupProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openDiscountPopup = useCallback(() => setOpen(true), []);
  const closeDiscountPopup = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const openFromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "sleva" || h === "registrace") openDiscountPopup();
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [openDiscountPopup]);

  return (
    <Ctx.Provider value={{ open, openDiscountPopup, closeDiscountPopup }}>
      {children}
      <DiscountPopupModal open={open} onClose={closeDiscountPopup} />
    </Ctx.Provider>
  );
}
