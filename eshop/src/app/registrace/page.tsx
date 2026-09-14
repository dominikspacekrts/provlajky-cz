import type { Metadata } from "next";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = { title: "Registrace účtu" };

export default function RegisterPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <h1 style={{ fontSize: 30 }}>Vytvořit účet</h1>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          Uložené adresy, historie objednávek a rychlejší příští nákup. Novým zákazníkům pošleme i jednorázovou
          slevu 10&nbsp;% — pokud chcete jen kód bez hesla, použijte tlačítko „Sleva 10&nbsp;%“ v horní liště.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
