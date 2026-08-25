"use client";

import { useState } from "react";
import { getVisualPdfBase64 } from "@/lib/actions/orders";
import type { Order, OrderItem } from "@/lib/types";

function downloadBase64Pdf(base64: string, filename: string) {
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Stažení vizualizace bez odeslání e-mailu — ať jde PDF zkontrolovat
// před tím, než ho "Odeslat vizualizaci" pošle zákazníkovi.
export default function DownloadVisualButton({ order, items }: { order: Order; items: OrderItem[] }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const designed = items.filter((i) => i.design?.thumb);
    if (!designed.length) {
      alert("Žádný uložený návrh ke stažení.");
      return;
    }
    setBusy(true);
    try {
      const base64 = await getVisualPdfBase64(order.id);
      downloadBase64Pdf(base64, `vizualizace_${order.order_number || order.id.slice(0, 8)}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn" onClick={handleClick} disabled={busy}>
      {busy ? "Připravuji…" : "Stáhnout vizualizaci"}
    </button>
  );
}
