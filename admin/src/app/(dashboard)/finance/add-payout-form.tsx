"use client";

import { useState, useTransition } from "react";
import { addPayout } from "@/lib/actions/finance";

export default function AddPayoutForm({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="btn mini" onClick={() => setOpen(true)}>
        + Výplata
      </button>
    );
  }

  return (
    <form
      style={{ display: "flex", gap: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(amount);
        if (!n) return;
        startTransition(async () => {
          await addPayout(partnerId, partnerName, n);
          setAmount("");
          setOpen(false);
        });
      }}
    >
      <input
        type="number"
        step="0.01"
        placeholder="Kč"
        autoFocus
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: 100, height: 30, padding: "0 8px", border: "1px solid var(--color-border-input)", borderRadius: 6 }}
      />
      <button className="btn mini" type="submit" disabled={isPending}>
        Uložit
      </button>
      <button className="btn mini" type="button" onClick={() => setOpen(false)}>
        Zrušit
      </button>
    </form>
  );
}
