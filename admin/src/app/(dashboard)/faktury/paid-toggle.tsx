"use client";

import { useTransition } from "react";
import { setInvoicePaid } from "@/lib/actions/invoices";

export default function PaidToggle({ invoiceId, paid }: { invoiceId: string; paid: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <span
      className={`paid-toggle${paid ? " on" : ""}`}
      onClick={() => !isPending && startTransition(() => setInvoicePaid(invoiceId, !paid))}
    >
      <span className="toggle-switch" />
      {paid ? "Zaplaceno" : "Nezaplaceno"}
    </span>
  );
}
