"use client";

import { useTransition } from "react";
import {
  clearCustomerPassword,
  deleteCustomer,
  resendCustomerDiscount,
  sendCustomerPasswordLink,
} from "@/lib/actions/customers";

type Props = {
  customerId: string;
  email: string;
  hasPassword: boolean;
  discountUsed: boolean;
};

export default function CustomerActions({ customerId, email, hasPassword, discountUsed }: Props) {
  const [pending, startTransition] = useTransition();

  function run(
    label: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        alert(res.error || "Akce se nepovedla.");
        return;
      }
      alert(res.message || label);
    });
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
      <button
        type="button"
        className="btn mini"
        disabled={pending || discountUsed}
        title={discountUsed ? "Kód už byl uplatněn" : "Znovu poslat slevový kód e-mailem"}
        onClick={() => {
          if (!confirm(`Poslat slevový kód na ${email}?`)) return;
          run("Sleva", () => resendCustomerDiscount(customerId));
        }}
      >
        Sleva
      </button>
      <button
        type="button"
        className="btn mini"
        disabled={pending}
        title={hasPassword ? "Poslat odkaz na obnovení hesla" : "Poslat odkaz na nastavení hesla"}
        onClick={() => {
          if (!confirm(`Poslat odkaz na ${hasPassword ? "obnovení" : "nastavení"} hesla na ${email}?`)) return;
          run("Heslo", () => sendCustomerPasswordLink(customerId));
        }}
      >
        {hasPassword ? "Reset hesla" : "Nastavit heslo"}
      </button>
      {hasPassword && (
        <button
          type="button"
          className="btn mini"
          disabled={pending}
          title="Smazat heslo z účtu (zůstane jen e-mail + sleva)"
          onClick={() => {
            if (!confirm(`Zrušit heslo u ${email}? Zákazník se nepřihlásí, dokud si heslo znovu nenastaví.`)) return;
            run("Zrušit heslo", () => clearCustomerPassword(customerId));
          }}
        >
          Zrušit heslo
        </button>
      )}
      <button
        type="button"
        className="btn danger mini"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Smazat zákazníka ${email}? Smažou se i jeho adresy a tokeny hesla. Objednávky zůstanou. Tuhle akci nejde vzít zpět.`,
            )
          ) {
            return;
          }
          run("Smazat", () => deleteCustomer(customerId));
        }}
      >
        Smazat
      </button>
    </div>
  );
}
