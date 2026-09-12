"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-client";

export default function SetPasswordForm() {
  const { setCustomer } = useCustomerAuth();
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) {
      setError("Hesla se neshodují.");
      return;
    }
    if (password.length < 8) {
      setError("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (!token) {
      setError("Chybí odkaz z e-mailu. Požádejte o nový.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Heslo se nepodařilo uložit.");
        setLoading(false);
        return;
      }
      if (json.customer) setCustomer(json.customer);
      router.push("/muj-ucet");
    } catch {
      setError("Heslo se nepodařilo uložit, zkuste to znovu.");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div>
        <p className="auth-error">Chybí token z e-mailu.</p>
        <p className="auth-switch">
          <Link href="/nastavit-heslo-zadost">Požádat o nový odkaz</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Nové heslo
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        Heslo znovu
        <input
          type="password"
          required
          minLength={8}
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="auth-error">{error}</p>}
      <button type="submit" className="btn-yellow" disabled={loading}>
        {loading ? "Ukládám…" : "Uložit heslo a přihlásit"}
      </button>
    </form>
  );
}
