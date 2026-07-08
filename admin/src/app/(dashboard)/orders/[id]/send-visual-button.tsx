"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { computeOrderTotals, customerEmail, fmtMoney } from "@/lib/domain";
import { DEFAULT_MAIL_TPL_VISUAL, fillTemplate, wrapEmailHtml } from "@/lib/email-templates";
import type { Order, OrderItem } from "@/lib/types";

function dataUrlToAttachment(dataUrl: string, filename: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  return { filename, contentBase64: m[2], contentType: m[1] };
}

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
      const attachments = designed
        .map((it, i) => dataUrlToAttachment(it.design!.thumb!, `navrh_${it.shape || i + 1}_${it.size || ""}.png`))
        .filter((a): a is NonNullable<typeof a> => Boolean(a));

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
