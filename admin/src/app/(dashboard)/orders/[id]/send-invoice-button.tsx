"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getInvoicePdfBase64, getOrCreateInvoiceForOrder } from "@/lib/actions/invoices";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { computeOrderTotals, customerEmail, fmtMoney } from "@/lib/domain";
import { DEFAULT_MAIL_TPL_ACCOUNTANT, DEFAULT_MAIL_TPL_INVOICE, fillTemplate, wrapEmailHtml } from "@/lib/email-templates";
import type { Invoice, Order, OrderItem } from "@/lib/types";

export default function SendInvoiceButton({
  order,
  items,
  existingInvoice,
}: {
  order: Order;
  items: OrderItem[];
  existingInvoice: Invoice | null;
}) {
  const { openEmailPreview } = useEmailPreview();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const to = customerEmail(order);
    if (!to) {
      alert("Objednávka nemá e-mail zákazníka (fakturační adresa → E-mail).");
      return;
    }
    if (!items.length) {
      alert("Objednávka nemá položky.");
      return;
    }
    if (order.customer?.billing?.isCompany && !order.customer.billing.ico?.trim()) {
      alert('Nákup je označen „na firmu" – vyplň prosím IČO ve fakturační adrese.');
      return;
    }

    setBusy(true);
    try {
      const invoice = existingInvoice || (await getOrCreateInvoiceForOrder(order.id));
      const { base64 } = await getInvoicePdfBase64(invoice.id);
      const tpl = await getMailTemplatesForClient();
      const totals = computeOrderTotals(order, items);
      const totalStr = fmtMoney(totals.grand, order.currency);
      const today = new Date().toLocaleDateString("cs-CZ");

      const subject = `Objednávka č. ${order.order_number || invoice.number} - Faktura`;
      const html = wrapEmailHtml(
        fillTemplate(tpl.tplInvoice || DEFAULT_MAIL_TPL_INVOICE, order, totalStr, { date: today, invoice: invoice.number }),
        tpl.signName,
        tpl.signPhone
      );
      const attachments = [{ filename: `faktura_${invoice.number}.pdf`, contentBase64: base64, contentType: "application/pdf" }];

      openEmailPreview({
        kind: "invoice",
        orderId: order.id,
        invoiceId: invoice.id,
        to,
        subject,
        html,
        attachments,
        onSent: () => {
          // Old app always sent a second, separate copy to the accountant right
          // after the customer invoice. We keep that, but as its own preview step
          // (per the "every send gets a preview" requirement) rather than silently.
          if (tpl.accountant) {
            openEmailPreview({
              kind: "accountant",
              orderId: order.id,
              invoiceId: invoice.id,
              to: tpl.accountant,
              subject: `provlajky - ${invoice.number}`,
              html: wrapEmailHtml(
                fillTemplate(tpl.tplAccountant || DEFAULT_MAIL_TPL_ACCOUNTANT, order, totalStr, { date: today, invoice: invoice.number }),
                tpl.signName,
                tpl.signPhone
              ),
              attachments,
            });
          }
        },
      });
    } catch (e) {
      alert("Chyba přípravy faktury: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="btn primary" onClick={handleClick} disabled={busy}>
      {busy ? "Připravuji…" : "Odeslat fakturu"}
    </button>
  );
}
