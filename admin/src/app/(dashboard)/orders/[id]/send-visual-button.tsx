"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getVisualPdfBase64 } from "@/lib/actions/orders";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { computeOrderTotals, customerEmail, fmtMoney } from "@/lib/domain";
import { DEFAULT_MAIL_TPL_VISUAL, fillTemplate, wrapEmailHtml } from "@/lib/email-templates";
import type { Order, OrderItem } from "@/lib/types";

export default function SendVisualButton({ order, items }: { order: Order; items: OrderItem[] }) {
  const { openEmailPreview } = useEmailPreview();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const to = customerEmail(order);
    if (!to) {
      alert("Objednávka nemá e-mail zákazníka (fakturační adresa → E-mail).");
      return;
    }
    const designed = items.filter((i) => i.design?.thumb);
    if (!designed.length) {
      alert("Žádný uložený návrh k odeslání.");
      return;
    }

    setBusy(true);
    try {
      const tpl = await getMailTemplatesForClient();
      const totals = computeOrderTotals(order, items);
      const totalStr = fmtMoney(totals.grand, order.currency);
      const subject = `Objednávka č. ${order.order_number || ""} - Cenová nabídka`;
      const html = wrapEmailHtml(
        fillTemplate(tpl.tplVisual || DEFAULT_MAIL_TPL_VISUAL, order, totalStr),
        tpl.signName,
        tpl.signPhone
      );
      const base64 = await getVisualPdfBase64(order.id);
      const attachments = [
        { filename: `vizualizace_${order.order_number || order.id.slice(0, 8)}.pdf`, contentBase64: base64, contentType: "application/pdf" },
      ];

      openEmailPreview({
        kind: "visual",
        orderId: order.id,
        to,
        subject,
        html,
        attachments,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn" onClick={handleClick} disabled={busy}>
      {busy ? "Připravuji…" : "Odeslat vizualizaci"}
    </button>
  );
}
