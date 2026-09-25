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
          slevu 5&nbsp;% — pokud chcete jen kód bez hesla, použijte tlačítko „Chci slevu 5&nbsp;%“ dole na úvodní stránce.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
