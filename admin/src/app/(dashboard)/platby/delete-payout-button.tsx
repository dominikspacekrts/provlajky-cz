"use client";

import { useTransition } from "react";
import { deletePayout } from "@/lib/actions/finance";
import { fmtMoney } from "@/lib/domain";

export default function DeletePayoutButton({ payoutId, amount }: { payoutId: string; amount: number }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="btn danger mini"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Zrušit výplatu ${fmtMoney(amount, "CZK")}? Tuhle akci nejde vzít zpět.`)) {
          startTransition(() => deletePayout(payoutId));
        }
      }}
    >
      {isPending ? "Ruším…" : "Zrušit"}
    </button>
  );
}
