"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-client";

export default function LoginForm() {
  const { setCustomer } = useCustomerAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/muj-ucet";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsPassword(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Přihlášení se nezdařilo.");
        setNeedsPassword(!!json.needsPassword);
        setLoading(false);
        return;
      }
      if (json.customer) setCustomer(json.customer);
      router.push(next);
    } catch {
      setError("Přihlášení se nezdařilo, zkuste to znovu.");
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
      <label>
        Heslo
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      {needsPassword && (
        <p className="auth-hint">
          <Link href={`/nastavit-heslo-zadost?email=${encodeURIComponent(email)}`}>Poslat odkaz na nastavení hesla</Link>
        </p>
      )}
      <button type="submit" className="btn-yellow" disabled={loading}>
        {loading ? "Přihlašuji…" : "Přihlásit se"}
      </button>
      <p className="auth-switch">
        Nemáte účet? <Link href="/registrace">Registrace</Link>
        {" · "}
        <Link href="/nastavit-heslo-zadost">Zapomenuté heslo</Link>
      </p>
    </form>
  );
}
