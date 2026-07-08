"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Heslo musí mít alespoň 8 znaků.");
      return;
    }
    if (password !== confirm) {
      setError("Hesla se neshodují.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
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
      <div
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

        {checking && (
          <p className="muted" style={{ fontSize: 13 }}>
            Ověřuji odkaz…
          </p>
        )}

        {!checking && !hasSession && (
          <>
            <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0 4px" }}>
              Odkaz z pozvánky už neplatí nebo byl použit dřív. Požádej o novou pozvánku.
            </p>
            <a href="/login" className="btn" style={{ marginTop: 12, textAlign: "center", display: "block" }}>
              Zpět na přihlášení
            </a>
          </>
        )}

        {!checking && hasSession && (
          <form onSubmit={handleSubmit} className="form-col">
            <p className="muted" style={{ margin: "0 0 4px", fontSize: 13 }}>
              Nastav si heslo k účtu.
            </p>
            <label>
              Nové heslo
              <input
                type="password"
                required
                autoFocus
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Heslo znovu
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}
            <button type="submit" className="btn primary" disabled={loading} style={{ marginTop: 6 }}>
              {loading ? "Ukládám…" : "Nastavit heslo a pokračovat"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
