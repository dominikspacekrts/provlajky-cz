import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { deliverMail } from "@/lib/mail/deliver";

// Brána, přes kterou eshop posílá poštu zákazníkům (potvrzení objednávky,
// slevový kód, obnova hesla, kontaktní formulář). Eshop sám na SMTP nesahá —
// veškerou poštu odesílá admin, jediné místo s přístupem k údajům.
//
// Endpoint musí být v proxy.ts vyjmutý z přesměrování na /login, jinak sem
// nepřihlášený požadavek z eshopu nikdy nedojde (viz matcher v src/proxy.ts).

// SMTP handshake se musí vejít do limitu funkce, jinak eshop dostane chybu,
// i když se mail odeslal.
export const maxDuration = 30;

// Tenhle endpoint umí poslat libovolný text na libovolnou adresu. Kdyby klíč
// unikl, je z něj otevřené relé na rozesílání spamu z naší domény — proto
// minimální délka a porovnání v konstantním čase.
const MIN_SECRET_LENGTH = 24;

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual vyžaduje stejnou délku — jinak sám vyhodí výjimku.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type Body = {
  to?: string;
  /** true = na adresu provozovatele z nastavení (kontaktní formulář). */
  toOperator?: boolean;
  replyTo?: string;
  subject?: string;
  html?: string;
  kind?: string;
  orderId?: string | null;
};

export async function POST(req: NextRequest) {
  const expected = process.env.MAIL_GATEWAY_SECRET;
  if (!expected || expected.length < MIN_SECRET_LENGTH) {
    // Raději neodesílat vůbec, než nechat bránu otevřenou.
    console.error(
      `api/mail: MAIL_GATEWAY_SECRET není nastaven nebo je kratší než ${MIN_SECRET_LENGTH} znaků — brána je vypnutá.`
    );
    return NextResponse.json({ error: "Mailová brána není nastavená." }, { status: 503 });
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !secretMatches(token, expected)) {
    console.warn("api/mail: odmítnut požadavek s neplatným klíčem");
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const to = body.to?.trim();
  const subject = body.subject?.trim();
  const html = body.html;
  if ((!to && !body.toOperator) || !subject || !html) {
    return NextResponse.json({ error: "Chybí příjemce, subject nebo html." }, { status: 400 });
  }

  const result = await deliverMail({
    to,
    toOperator: body.toOperator,
    replyTo: body.replyTo,
    subject,
    html,
    kind: body.kind || "other",
    orderId: body.orderId ?? null,
    // null = odeslal automat, ne člověk z týmu.
    sentBy: null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
