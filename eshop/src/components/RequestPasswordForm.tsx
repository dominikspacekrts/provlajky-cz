"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function RequestPasswordForm() {
  const search = useSearchParams();
  const [email, setEmail] = useState(search.get("email") || "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Odeslání se nezdařilo.");
        setLoading(false);
        return;
      }
      setMessage(json.message || "Pokud účet existuje, poslali jsme odkaz na e-mail.");
      setLoading(false);
    } catch {
      setError("Odeslání se nezdařilo, zkuste to znovu.");
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {message && <p className="auth-success">{message}</p>}
      <button type="submit" className="btn-yellow" disabled={loading}>
        {loading ? "Odesílám…" : "Poslat odkaz"}
      </button>
      <p className="auth-switch">
        <Link href="/prihlaseni">Zpět na přihlášení</Link>
      </p>
    </form>
  );
}
