"use client";

// Registrace zákazníka → 10% slevový kód poslaný e-mailem (POST /api/registrace).
// Kód se ověřuje a spotřebovává až v /api/objednavka, tenhle formulář jen
// zakládá zákazníka a spouští odeslání mailu.

import { useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setMessage("Zadejte prosím e-mail.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/registrace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined }),
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
          <span>Jméno</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label className="nv-register-field">
          <span>E-mail *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="nv-register-field">
          <span>Telefon</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
      </div>
      {message && status === "error" && <p className="nv-register-error">{message}</p>}
      <button type="submit" className="nv-btn nv-btn-yellow" disabled={status === "loading"}>
        <span className="nv-btn-l">{status === "loading" ? "Odesílám…" : "Získat 10% slevu"}</span>
      </button>
    </form>
  );
}
