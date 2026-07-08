"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { buildSupplierBodyText } from "@/lib/email-templates";
import { customerLabel } from "@/lib/domain";
import type { Order, OrderItem } from "@/lib/types";

function dataUrlToAttachment(dataUrl: string, filename: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  return { filename, contentBase64: m[2], contentType: m[1] };
}

export default function SendSupplierButton({ order, items }: { order: Order; items: OrderItem[] }) {
  const { openEmailPreview } = useEmailPreview();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!items.length) {
      alert("Objednávka nemá položky.");
      return;
    }
    setBusy(true);
    try {
      const tpl = await getMailTemplatesForClient();
      if (!tpl.supplier) {
        alert("Nejdřív nastav e-mail dodavatele v Nastavení → Maily.");
        return;
      }
      const subject = `order - ${customerLabel(order)}`;
      const body = buildSupplierBodyText(order, items, tpl.signName, tpl.signPhone);
      const html = `<pre style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap">${body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`;

      const attachments = items
        .map((it, i) =>
          it.design?.thumb ? dataUrlToAttachment(it.design.thumb, `navrh_${it.shape || i + 1}_${it.size || ""}.png`) : null
        )
        .filter((a): a is NonNullable<typeof a> => Boolean(a));

      openEmailPreview({
        kind: "supplier",
        orderId: order.id,
        to: tpl.supplier,
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
      {busy ? "Připravuji…" : "Odeslat dodavateli"}
    </button>
  );
}
