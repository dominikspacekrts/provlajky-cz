// Eshop na SMTP nesahá. Veškerou poštu zákazníkům odesílá admin přes svou
// mailovou bránu (admin/src/app/api/mail/route.ts) — jedno místo s přístupem
// k údajům, jedna Historie mailů.
//
// Důvod: maily odeslané přímo z eshopu nedorazily, zatímco stejný SMTP účet
// z adminu fungoval. Tímhle eshop odesílání vůbec neřeší.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

type GatewayPayload = {
  to?: string;
  toOperator?: boolean;
  replyTo?: string;
  subject: string;
  html: string;
  kind: string;
  orderId?: string | null;
};

/** Nikdy nevyhazuje výjimku — objednávka ani registrace nesmí spadnout na poště. */
async function callGateway(payload: GatewayPayload): Promise<{ emailed: boolean; error?: string }> {
  const baseUrl = process.env.MAIL_GATEWAY_URL;
  const secret = process.env.MAIL_GATEWAY_SECRET;
  if (!baseUrl || !secret) {
    const error = "Mailová brána není nastavená (MAIL_GATEWAY_URL / MAIL_GATEWAY_SECRET).";
    console.error(`callGateway: ${error}`);
    return { emailed: false, error };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/mail`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify(payload),
      // Zápis do email_history dělá admin, takže nemá smysl čekat déle, než
      // žije funkce checkoutu (viz maxDuration v api/objednavka/route.ts).
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `Brána odpověděla ${res.status}. ${detail.slice(0, 200)}`.trim();
      console.error(`callGateway: ${error}`);
      return { emailed: false, error };
    }
    return { emailed: true };
  } catch (e) {
    // Sem spadne i vypršení AbortSignal.timeout.
    const error = e instanceof Error ? e.message : "Brána je nedostupná.";
    console.error("callGateway: gateway call failed", e);
    return { emailed: false, error };
  }
}

/** Mail zákazníkovi (potvrzení objednávky, slevový kód, obnova hesla). */
export async function sendCustomerMail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Typ pro filtr v Historii mailů. */
  kind?: string;
  /** Naváže mail na objednávku, ať je vidět u jejího detailu. */
  orderId?: string | null;
}): Promise<{ emailed: boolean; error?: string }> {
  return callGateway({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    kind: opts.kind || "other",
    orderId: opts.orderId ?? null,
  });
}

/**
 * Zpráva provozovateli (kontaktní formulář). Cílovou adresu zná jen admin
 * z nastavení, eshop ji nepotřebuje.
 */
export async function sendOperatorMail(opts: {
  subject: string;
  html: string;
  replyTo?: string;
  kind?: string;
}): Promise<{ emailed: boolean; error?: string }> {
  return callGateway({
    toOperator: true,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html: opts.html,
    kind: opts.kind || "other",
  });
}

export function discountCodeEmailHtml(name: string | undefined, code: string, pct: number): string {
  const greeting = name ? `Ahoj ${escapeHtml(name)},` : "Ahoj,";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>děkujeme za registraci na provlajky.cz. Váš slevový kód na <strong>${pct} %</strong> z první objednávky:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #ffe701; color: #08080a; padding: 12px 20px; display: inline-block;">${escapeHtml(code)}</p>
      <p>Kód zadejte v objednávce a klikněte na „Uplatnit“. Platí jednorázově na jednu objednávku.</p>
      <p>Tým PROVLAJKY.CZ</p>
    </div>
  `;
}

export function passwordLinkEmailHtml(name: string | undefined, link: string, kind: "set_password" | "reset_password"): string {
  const greeting = name ? `Ahoj ${escapeHtml(name)},` : "Ahoj,";
  const lead =
    kind === "set_password"
      ? "pro dokončení účtu na provlajky.cz si nastavte heslo na tomto odkazu (platí 24 hodin):"
      : "pro obnovení hesla na provlajky.cz použijte tento odkaz (platí 24 hodin):";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>${lead}</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ffe701;color:#08080a;padding:12px 20px;font-weight:bold;text-decoration:none;">Nastavit heslo</a></p>
      <p style="font-size:12px;color:#666;">Pokud jste o to nežádali, e-mail ignorujte.</p>
      <p>Tým PROVLAJKY.CZ</p>
    </div>
  `;
}
