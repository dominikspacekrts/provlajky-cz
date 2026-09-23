import type { PromoCodeRules } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePromoCode(prefix = "PV"): string {
  let body = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < bytes.length; i++) {
    body += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return `${prefix}-${body}`;
}

export function normalizeCodeRules(raw: Partial<PromoCodeRules> | null | undefined): PromoCodeRules {
  const discountType = raw?.discountType === "fixed" ? "fixed" : "percent";
  const discountValue = Math.max(0, Number(raw?.discountValue) || (discountType === "percent" ? 10 : 0));
  const oneShot = raw?.oneShot !== false;
  const maxUses = oneShot ? 1 : Math.max(1, Number(raw?.maxUses) || 1);
  const validDays =
    raw?.validDays == null || raw.validDays === ("" as unknown)
      ? null
      : Math.max(1, Math.floor(Number(raw.validDays)));
  return {
    discountType,
    discountValue,
    oneShot,
    maxUses: oneShot ? 1 : maxUses,
    validDays: Number.isFinite(validDays as number) ? validDays : null,
  };
}

export function validUntilFromRules(rules: PromoCodeRules, from = new Date()): string | null {
  if (rules.validDays == null) return null;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + rules.validDays);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

export function formatPromoDiscountLabel(type: "percent" | "fixed", value: number): string {
  if (type === "fixed") {
    return `${Math.round(value).toLocaleString("cs-CZ")} Kč`;
  }
  return `${value} %`;
}
