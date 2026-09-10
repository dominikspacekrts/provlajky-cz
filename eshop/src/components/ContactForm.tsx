"use client";

// Kontaktní formulář na /kontakt → POST /api/kontakt (e-mail provozovateli,
// reply-to na odesílatele). Vzor převzatý z RegisterForm.tsx.

import { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setStatus("error");
        setError(json.error || "Zprávu se nepodařilo odeslat.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Nepodařilo se odeslat zprávu, zkuste to prosím znovu.");
    }
  }

  if (status === "done") {
    return (
      <div className="contact-form-done">
        <p>Díky za zprávu — ozveme se co nejdřív.</p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-grid">
        <label>
          Jméno
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label>
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          Telefon (nepovinné)
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
        <label className="full-width">
          Zpráva
          <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
      </div>
      {error && <p className="contact-form-error">{error}</p>}
      <button type="submit" className="btn-yellow" disabled={status === "loading"}>
        {status === "loading" ? "Odesílám…" : "Odeslat zprávu"}
      </button>
    </form>
  );
}
