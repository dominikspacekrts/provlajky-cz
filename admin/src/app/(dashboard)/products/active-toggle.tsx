"use client";

import { useTransition } from "react";
import { toggleProductActive } from "@/lib/actions/products";

export default function ActiveToggle({ productId, active }: { productId: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <span
      className={`paid-toggle${active ? " on" : ""}`}
      onClick={() => !isPending && startTransition(() => toggleProductActive(productId, !active))}
    >
      <span className="toggle-switch" />
      {active ? "Aktivní na eshopu" : "Skryto"}
    </span>
  );
}
