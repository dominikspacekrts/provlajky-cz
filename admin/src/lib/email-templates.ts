// Ported from app.js (DEFAULT_MAIL_TPL_*, wrapEmailHtml, fillTemplate) so the
// e-mail layout/wording stays identical to the old app.
import { customerLabel } from "./domain";
import type { Order } from "./types";

export const DEFAULT_MAIL_TPL_INVOICE = `<p>Dobrý den,</p>
<p>děkujeme za Vaši objednávku <strong>č. {{order}}</strong>. V příloze najdete fakturu na částku <strong>{{total}}</strong>, kterou prosím uhraďte převodem na účet uvedený ve faktuře (můžete využít QR platbu).</p>
<p style="background:#f7f8f9;border-left:3px solid #f4d03f;padding:12px 14px;margin:16px 0;color:#444">
<strong>Platba předem</strong><br>
Platbu předem požadujeme, protože zboží vyrábíme na zakázku podle individuálních potřeb zákazníka. Tímto eliminujeme riziko neprodejného vráceného zboží. Výrobu zahájíme až po úhradě, čímž garantujeme osobní přístup a precizní zpracování Vaší objednávky.<br><br>
Dodací lhůta se počítá ode dne, kdy nám platba přijde na účet.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`;

export const DEFAULT_MAIL_TPL_VISUAL = `<p>Dobrý den,</p>
<p>v příloze posíláme vizualizaci a cenovou nabídku k Vaší objednávce <strong>č. {{order}}</strong> v celkové výši <strong>{{total}}</strong>.</p>
<p>V případě dotazů nebo úprav nás neváhejte kontaktovat.</p>
<p>S pozdravem,<br>tým PROVLAJKY</p>`;

export const DEFAULT_MAIL_TPL_ACCOUNTANT = `<p>Ahoj,</p>
<p>zde je faktura provlajky zaslaná {{date}}.</p>
<p>Prosím o potvrzení zaplacení odpovědí na tento mail.</p>
<p>díky<br>Dominik Špaček</p>`;

export function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fillTemplate(
  tpl: string,
  order: Pick<Order, "customer" | "order_number">,
  totalStr: string,
  extra: { date?: string; invoice?: string } = {}
) {
  const cust = customerLabel(order);
  return (tpl || "")
    .replace(/\{\{customer\}\}/g, escapeHtml(cust))
    .replace(/\{\{order\}\}/g, escapeHtml(order.order_number || ""))
    .replace(/\{\{total\}\}/g, escapeHtml(totalStr || ""))
    .replace(/\{\{date\}\}/g, escapeHtml(extra.date || new Date().toLocaleDateString("cs-CZ")))
    .replace(/\{\{invoice\}\}/g, escapeHtml(extra.invoice || ""));
}

export function wrapEmailHtml(bodyHtml: string, signName: string, signPhone: string) {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1f2329;border-radius:12px;overflow:hidden;max-width:600px">
        <tr><td style="background:#ffffff;padding:22px 28px 16px;text-align:center">
          <img src="cid:provlajkylogo" alt="PROVLAJKY.CZ" width="300" style="display:block;margin:0 auto;max-width:80%;height:auto;border-radius:8px">
        </td></tr>
        <tr><td style="height:3px;background:#f4d03f"></td></tr>
        <tr><td style="background:#ffffff;padding:28px;font-size:15px;line-height:1.6;color:#1f2937">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:#1f2329;padding:18px 28px;text-align:center;color:#d1d5db;font-size:12px;line-height:1.8">
          <strong style="color:#ffffff">${escapeHtml(signName || "")}</strong><br>
          <span style="color:#9ca3af">🌐 PROVLAJKY.CZ</span><br>
          ${signPhone ? '<span style="color:#9ca3af">📞 ' + escapeHtml(signPhone) + "</span><br>" : ""}
          <span style="color:#9ca3af">✉️ info@provlajky.cz</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
