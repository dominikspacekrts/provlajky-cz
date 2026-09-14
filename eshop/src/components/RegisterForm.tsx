"use client";

// Registrace zákazníka s heslem → účet (+ volitelně 10% kód přes /api/auth/register).
// Sleva samotná bez hesla je popup → POST /api/registrace.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-client";
import { useDiscountPopup } from "@/components/DiscountPopup";

type Status = "idle" | "loading" | "done" | "error";

export default function RegisterForm({ redirectTo }: { redirectTo?: string }) {
  const { setCustomer } = useCustomerAuth();
  const { openDiscountPopup } = useDiscountPopup();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setMessage("Zadejte prosím e-mail.");
      return;
    }
    if (password.length < 8 || !/[A-Za-zÀ-ž]/.test(password) || !/[0-9]/.test(password)) {
      setStatus("error");
      setMessage("Heslo musí mít alespoň 8 znaků, jedno písmeno a jednu číslici.");
      return;
    }
    if (!consent) {
      setStatus("error");
      setMessage("Bez souhlasu se zpracováním e-mailu nemůžeme účet založit.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setStatus("error");
        setMessage(json.error || "Registraci se nepodařilo dokončit.");
        return;
      }
      if (json.customer) setCustomer(json.customer);
      setStatus("done");
      if (json.emailed) {
        setMessage(
          "Účet je hotový. Slevový kód jsme poslali na e-mail — můžete ho hned uplatnit v objednávce.",
        );
      } else if (json.discountCode) {
        setMessage(
          `Účet je hotový. Váš slevový kód: ${json.discountCode}. E-mail se teď nepodařilo odeslat — kód si zkopírujte, nebo se ozvěte na info@provlajky.cz.`,
        );
      } else {
        setMessage("Účet je hotový. Jste přihlášeni.");
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch {
      setStatus("error");
      setMessage("Nepodařilo se odeslat registraci, zkuste to prosím znovu.");
    }
  }

  if (status === "done") {
    return (
      <div className="nv-register-done">
        <p>{message}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/objednavka">Pokračovat k objednávce</Link>
          {" · "}
          <Link href="/muj-ucet">Můj účet</Link>
        </p>
      </div>
    );
  }

  return (
    <form className="nv-register-form" onSubmit={submit}>
      <div className="nv-register-fields">
        <label className="nv-register-field">
          <span>Jméno (volitelné)</span>
          <input
            type="text"
            placeholder="Jan Novák"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="nv-register-field">
          <span>E-mail</span>
          <input
            type="email"
            required
            placeholder="vas@email.cz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="nv-register-field">
          <span>Heslo (min. 8 znaků, písmeno + číslice)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
      </div>
      <label className="nv-register-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Souhlasím se zpracováním e-mailu za účelem založení účtu a obchodních sdělení. Souhlas můžu kdykoliv
          odvolat. Víc v{" "}
          <Link href="/ochrana-osobnich-udaju" target="_blank">
            zásadách ochrany osobních údajů
          </Link>
          .
        </span>
      </label>
      {message && status === "error" && <p className="nv-register-error">{message}</p>}
      <button type="submit" className="nv-btn nv-btn-yellow" disabled={status === "loading"}>
        <span className="nv-btn-l">{status === "loading" ? "Odesílám…" : "Vytvořit účet"}</span>
      </button>
      <p className="nv-register-switch">
        Už máte účet? <Link href="/prihlaseni">Přihlásit se</Link>
        {" · "}
        Jen slevu bez účtu?{" "}
        <button type="button" className="nv-link-btn" onClick={openDiscountPopup}>
          Získat 10 %
        </button>
        {" · "}
        Dřívější registrace bez hesla? <Link href="/nastavit-heslo-zadost">Nastavit heslo</Link>
      </p>
    </form>
  );
}
