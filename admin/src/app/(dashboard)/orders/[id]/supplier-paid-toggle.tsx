"use client";

import { useTransition } from "react";
import { setSupplierPaid } from "@/lib/actions/orders";

export default function SupplierPaidToggle({ orderId, paid }: { orderId: string; paid: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={`sup-pill ${paid ? "sup-paid" : "sup-unpaid"}`}
      disabled={isPending}
      onClick={() => startTransition(() => setSupplierPaid(orderId, !paid))}
      title="Kliknutím přepneš stav platby dodavateli"
    >
      {paid ? "Dodavatel zaplacen" : "Dodavatel nezaplacen"}
    </button>
  );
}
