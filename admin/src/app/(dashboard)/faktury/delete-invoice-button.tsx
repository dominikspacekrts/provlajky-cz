"use client";

import { useTransition } from "react";
import { deleteInvoice } from "@/lib/actions/invoices";

export default function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
  orderId,
}: {
  invoiceId: string;
  invoiceNumber: string;
  orderId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="btn danger"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Smazat fakturu č. ${invoiceNumber}? Tuhle akci nejde vzít zpět.`)) {
          startTransition(() => deleteInvoice(invoiceId, orderId));
        }
      }}
    >
      {isPending ? "Mažu…" : "Smazat"}
    </button>
  );
}
