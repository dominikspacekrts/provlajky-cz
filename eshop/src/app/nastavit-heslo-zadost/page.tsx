import { Suspense } from "react";
import type { Metadata } from "next";
import RequestPasswordForm from "@/components/RequestPasswordForm";

export const metadata: Metadata = { title: "Nastavení hesla" };

export default function RequestPasswordPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <h1 style={{ fontSize: 30 }}>Nastavit nebo obnovit heslo</h1>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          Zadejte e-mail z registrace. Pošleme odkaz na dokončení účtu (pokud ještě nemáte heslo) nebo na obnovení
          hesla.
        </p>
        <Suspense fallback={<p>Načítám…</p>}>
          <RequestPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
