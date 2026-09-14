import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = { title: "Přihlášení" };

export default function LoginPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <h1 style={{ fontSize: 30 }}>Přihlášení</h1>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          Přihlaste se e-mailem a heslem. Uložíme fakturační údaje a dodací adresy pro příští objednávky.
        </p>
        <Suspense fallback={<p>Načítám…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
