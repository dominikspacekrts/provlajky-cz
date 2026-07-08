"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "invite-link-expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Špatný e-mail nebo heslo."
          : error.message
      );
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="form-col"
        style={{
          background: "white",
          border: "1px solid var(--color-border)",
          borderRadius: 14,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 360,
        }}
      >
        <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>PROVLAJKY admin</h1>
        <p className="muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
          Přihlaš se svým účtem.
        </p>
        {linkExpired && (
          <div style={{ color: "#dc2626", fontSize: 13, background: "#fee2e2", padding: "8px 10px", borderRadius: 6, marginBottom: 12 }}>
            Odkaz z pozvánky už neplatí nebo byl použit dřív. Požádej o novou pozvánku.
          </div>
        )}
        <label>
          E-mail
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Heslo
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>
        )}
        <button type="submit" className="btn primary" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? "Přihlašuji…" : "Přihlásit se"}
        </button>
      </form>
    </div>
  );
}
