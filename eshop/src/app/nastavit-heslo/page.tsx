import { Suspense } from "react";
import type { Metadata } from "next";
import SetPasswordForm from "@/components/SetPasswordForm";

export const metadata: Metadata = { title: "Nastavit heslo" };

export default function SetPasswordPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <h1 style={{ fontSize: 30 }}>Nastavit heslo</h1>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          Zvolte nové heslo. Po uložení budete přihlášeni.
        </p>
        <Suspense fallback={<p>Načítám…</p>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
