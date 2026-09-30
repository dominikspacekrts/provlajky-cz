// Meta Conversions API — serverové dvojče pixelu. Token nesmí do prohlížeče.
// Bez META_CAPI_ACCESS_TOKEN se nic neodesílá a objednávka běží dál.
//
// Purchase má stejné event_id jako pixel (`purchase_<číslo objednávky>`),
// Meta si oba hity sloučí do jedné konverze.

import { createHash } from "crypto";
import { META_PIXEL_ID } from "./meta-pixel";
import { isProduction } from "./site";

const API_VERSION = "v23.0";

type PurchaseItem = { item_id: string; quantity: number; price: number };

export type MetaPurchaseInput = {
  eventId: string;
  transactionId: string;
  value: number;
  items: PurchaseItem[];
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hash(value: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized ? sha256(normalized) : undefined;
}

function hashName(value: string | undefined) {
  return hash((value || "").replace(/[^\p{L}\s]/gu, "").replace(/\s+/g, " "));
}

function hashCity(value: string | undefined) {
  return hash((value || "").replace(/[^\p{L}]/gu, ""));
}

function hashZip(value: string | undefined) {
  return hash((value || "").replace(/\s+/g, ""));
}

function hashPhone(value: string | undefined) {
  let digits = (value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `420${digits}`;
  else if (digits.length === 10 && digits.startsWith("0")) digits = `420${digits.slice(1)}`;
  if (digits.length < 11) return undefined;
  return sha256(digits);
}

function hashed(value: string | undefined) {
  return value ? [value] : undefined;
}

export async function sendMetaPurchase(input: MetaPurchaseInput) {
  const token = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (!token) return;
  // Na neprodukci jen s testovacím kódem z Events Manageru, ať se ostré
  // kampaně nekontaminují. Na produkci se testovací kód schválně nepřidává.
  if (!isProduction() && !testCode) return;

  const userData: Record<string, unknown> = {};
  const em = hash(input.email);
  const ph = hashPhone(input.phone);
  const fn = hashName(input.firstName);
  const ln = hashName(input.lastName);
  const ct = hashCity(input.city);
  const zp = hashZip(input.postalCode);
  const country = hash((input.country || "cz").slice(0, 2));
  if (em) userData.em = hashed(em);
  if (ph) userData.ph = hashed(ph);
  if (fn) userData.fn = hashed(fn);
  if (ln) userData.ln = hashed(ln);
  if (ct) userData.ct = hashed(ct);
  if (zp) userData.zp = hashed(zp);
  if (country) userData.country = hashed(country);
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.userAgent) userData.client_user_agent = input.userAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.sourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: {
          currency: "CZK",
          value: input.value,
          content_type: "product",
          content_ids: input.items.map((item) => item.item_id).filter(Boolean),
          contents: input.items.map((item) => ({
            id: item.item_id,
            quantity: item.quantity,
            item_price: item.price,
          })),
          num_items: input.items.reduce((sum, item) => sum + (item.quantity || 0), 0),
          order_id: input.transactionId,
        },
      },
    ],
  };
  if (!isProduction() && testCode) body.test_event_code = testCode;

  const url = `https://graph.facebook.com/${API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(2500),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 300)}`);
  }
}
