"use client";

import { useTransition } from "react";
import { deleteOrder } from "@/lib/actions/orders";

export default function DeleteOrderButton({ orderId, orderNumber }: { orderId: string; orderNumber: string | null }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="btn danger"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Smazat objednávku č. ${orderNumber || "—"}? Smažou se i její položky. Tuhle akci nejde vzít zpět.`)) {
          startTransition(() => deleteOrder(orderId));
        }
      }}
    >
      {isPending ? "Mažu…" : "Smazat objednávku"}
    </button>
  );
}
