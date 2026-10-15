"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getInvoicePdfBase64, getOrCreateInvoiceForOrder } from "@/lib/actions/invoices";
import { sendEmailAction } from "@/lib/actions/send-email";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { computeOrderTotals, customerEmail, customerLabel, fmtMoney } from "@/lib/domain";
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
  const [busy, setBusy] = useState<"customer" | "accountant" | null>(null);

  function validateOrderForInvoice() {
    if (!items.length) {
      alert("Objednávka nemá položky.");
      return false;
    }
    if (order.customer?.billing?.isCompany && !order.customer.billing.ico?.trim()) {
      alert('Nákup je označen „na firmu" – vyplň prosím IČO ve fakturační adrese.');
      return false;
    }
    return true;
  }

  async function prepareInvoiceMail() {
    const invoice = existingInvoice || (await getOrCreateInvoiceForOrder(order.id));
    const { base64 } = await getInvoicePdfBase64(invoice.id);
    const tpl = await getMailTemplatesForClient();
    const totals = computeOrderTotals(order, items);
    const totalStr = fmtMoney(totals.grand, order.currency);
    const today = new Date().toLocaleDateString("cs-CZ");
    const attachments = [{ filename: `faktura_${invoice.number}.pdf`, contentBase64: base64, contentType: "application/pdf" }];
    return { invoice, tpl, totalStr, today, attachments };
  }

  async function handleCustomerClick() {
    const to = customerEmail(order);
    if (!to) {
      alert("Objednávka nemá e-mail zákazníka (fakturační adresa → E-mail).");
      return;
    }
    if (!validateOrderForInvoice()) return;

    setBusy("customer");
    try {
      const { invoice, tpl, totalStr, today, attachments } = await prepareInvoiceMail();
      const subject = `Objednávka č. ${order.order_number || invoice.number} - Faktura`;
      const html = wrapEmailHtml(
        fillTemplate(tpl.tplInvoice || DEFAULT_MAIL_TPL_INVOICE, order, totalStr, {
          date: today,
          invoice: invoice.number,
          signName: tpl.signName,
        }),
        tpl.signName,
        tpl.signPhone
      );

      openEmailPreview({
        kind: "invoice",
        orderId: order.id,
        invoiceId: invoice.id,
        to,
        subject,
        html,
        attachments,
        onSent: async () => {
          // Po úspěšném odeslání zákazníkovi automaticky stejná faktura účetní —
          // bez druhého náhledu. Adresa je v Nastavení → Maily → E-mail účetní.
          if (!tpl.accountant?.trim()) return;
          const accountantHtml = wrapEmailHtml(
            fillTemplate(tpl.tplAccountant || DEFAULT_MAIL_TPL_ACCOUNTANT, order, totalStr, {
              date: today,
              invoice: invoice.number,
              signName: tpl.signName,
            }),
            tpl.signName,
            tpl.signPhone
          );
          const res = await sendEmailAction({
            kind: "accountant",
            orderId: order.id,
            invoiceId: invoice.id,
            to: tpl.accountant.trim(),
            cc: [],
            subject: `provlajky.cz — faktura ${invoice.number} · obj. ${order.order_number || "—"} · ${customerLabel(order)}`,
            html: accountantHtml,
            attachments,
          });
          if (!res.ok) {
            alert(
              `Faktura zákazníkovi odešla, ale účetní (${tpl.accountant}) ne: ${res.error || "neznámá chyba"}. Použij „Poslat fakturu účetní“ nebo zkontroluj Nastavení → Maily.`
            );
          }
        },
      });
    } catch (e) {
      alert("Chyba přípravy faktury: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  // Ruční přeposlání účetní (když auto-kopie nedorazila) — se stejným náhledem jako ostatní maily.
  async function handleAccountantClick() {
    if (!validateOrderForInvoice()) return;

    setBusy("accountant");
    try {
      const { invoice, tpl, totalStr, today, attachments } = await prepareInvoiceMail();
      const to = tpl.accountant?.trim();
      if (!to) {
        alert("Není nastaven e-mail účetní. Doplň ho v Nastavení → Maily → E-mail účetní.");
        return;
      }
      const html = wrapEmailHtml(
        fillTemplate(tpl.tplAccountant || DEFAULT_MAIL_TPL_ACCOUNTANT, order, totalStr, {
          date: today,
          invoice: invoice.number,
          signName: tpl.signName,
        }),
        tpl.signName,
        tpl.signPhone
      );
      openEmailPreview({
        kind: "accountant",
        orderId: order.id,
        invoiceId: invoice.id,
        to,
        subject: `provlajky.cz — faktura ${invoice.number} · obj. ${order.order_number || "—"} · ${customerLabel(order)}`,
        html,
        attachments,
      });
    } catch (e) {
      alert("Chyba přípravy faktury pro účetní: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button className="btn primary" onClick={handleCustomerClick} disabled={!!busy}>
        {busy === "customer" ? "Připravuji…" : "Odeslat fakturu"}
      </button>
      <button className="btn" onClick={handleAccountantClick} disabled={!!busy} title="Přeposlat fakturu účetní (např. když auto-kopie nedorazila)">
        {busy === "accountant" ? "Připravuji…" : "Poslat fakturu účetní"}
      </button>
    </>
  );
}
