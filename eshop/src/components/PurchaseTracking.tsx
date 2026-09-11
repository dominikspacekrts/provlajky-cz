"use client";

import { useEffect, useRef, useState } from "react";
import { trackPurchase, type PurchasePayload } from "@/lib/analytics";

// Event `purchase` se smí poslat jen jednou na objednávku. Refresh děkovací
// stránky ho proto nesmí zopakovat — hlídá to klíč v sessionStorage podle
// čísla objednávky (přežije reload, zmizí se zavřením panelu).
function alreadySent(transactionId: string) {
  try {
    return sessionStorage.getItem(`purchase_sent_${transactionId}`) === "1";
  } catch {
    // Soukromé prohlížení apod. — radši riskovat duplicitu než event neposlat.
    return false;
  }
}

function markSent(transactionId: string) {
  try {
    sessionStorage.setItem(`purchase_sent_${transactionId}`, "1");
  } catch {
    // Bez sessionStorage se dedup neuloží, event se ale odešle.
  }
}

export default function PurchaseTracking({ orderId }: { orderId: string }) {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    fetch(`/api/objednavka/${encodeURIComponent(orderId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: PurchasePayload | null) => {
        if (!payload?.transaction_id) return;
        setOrderNumber(payload.transaction_id);
        if (alreadySent(payload.transaction_id)) return;
        markSent(payload.transaction_id);
        trackPurchase(payload);
      })
      .catch(() => {
        // Výpadek měření nesmí zákazníkovi rozbít potvrzení objednávky.
      });
  }, [orderId]);

  if (!orderNumber) return null;

  return (
    <p style={{ color: "var(--gray)", marginTop: 4 }}>
      Číslo objednávky: <strong>{orderNumber}</strong>
    </p>
  );
}
