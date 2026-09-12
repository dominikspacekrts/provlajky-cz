"use client";

// Registrace zákazníka → 10% slevový kód poslaný e-mailem (POST /api/registrace).
// Kód se ověřuje a spotřebovává až v /api/objednavka, tenhle formulář jen
// zakládá zákazníka a spouští odeslání mailu.

import { useState } from "react";
import Link from "next/link";

type Status = "idle" | "loading" | "done" | "error";

export default function RegisterForm() {
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
        setMessage(json.error || "Registraci se nepodařilo dokončit.");
        return;
      }
      setStatus("done");
      setMessage(
        json.emailed
          ? "Kód s 10% slevou jsme poslali na e-mail."
          : "Registrace proběhla, ale e-mail se teď nepodařilo odeslat — ozvěte se nám prosím na info@provlajky.cz."
      );
    } catch {
      setStatus("error");
      setMessage("Nepodařilo se odeslat registraci, zkuste to prosím znovu.");
    }
  }

  if (status === "done") {
    return (
      <div className="nv-register-done">
        <p>{message}</p>
      </div>
    );
  }

  return (
    <form className="nv-register-form" onSubmit={submit}>
      <div className="nv-register-fields">
        <label className="nv-register-field">
          <span>E-mail</span>
          <input
            type="email"
            required
            placeholder="vas@email.cz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
      </div>
      {/* Zpracování e-mailu stojí na souhlasu, takže si ho musí zákazník
          vědomě odkliknout — předzaškrtnuté políčko souhlas podle GDPR není. */}
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
      <button type="submit" className="nv-btn nv-btn-yellow" disabled={status === "loading" || !consent}>
        <span className="nv-btn-l">{status === "loading" ? "Odesílám…" : "Získat 10% slevu"}</span>
      </button>
    </form>
  );
}
