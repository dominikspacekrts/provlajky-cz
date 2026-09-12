import type { Metadata } from "next";
import RegisterForm from "@/components/RegisterForm";

export const metadata: Metadata = { title: "Registrace" };

export default function RegisterPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <h1 style={{ fontSize: 30 }}>Registrace</h1>
        <p style={{ color: "var(--gray)", marginTop: 12 }}>
          Vytvořte si účet a získejte jednorázovou slevu 10 % na první objednávku.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
