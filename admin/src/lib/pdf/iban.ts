// Czech SPD (Short Payment Descriptor) QR payment string — ported 1:1 from app.js.

function mod97(s: string) {
  let r = 0;
  for (const ch of s) r = (r * 10 + (ch.charCodeAt(0) - 48)) % 97;
  return r;
}

// Convert a Czech account number ("[prefix-]number/bankcode") to IBAN.
export function accountToIban(acc: string | null | undefined): string | null {
  if (!acc) return null;
  const m = String(acc)
    .replace(/\s/g, "")
    .match(/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/);
  if (!m) return null;
  const prefix = (m[1] || "").padStart(6, "0");
  const number = m[2].padStart(10, "0");
  const bank = m[3];
  const bban = bank + prefix + number; // 20 digits
  const check = 98 - mod97(bban + "1235" + "00"); // CZ → 12,35
  return "CZ" + String(check).padStart(2, "0") + bban;
}

export function buildSpdString({
  iban,
  amount,
  vs,
  msg,
  currency = "CZK",
}: {
  iban: string;
  amount?: number | null;
  vs?: string | null;
  msg?: string | null;
  currency?: string;
}) {
  const parts = ["SPD", "1.0", "ACC:" + iban];
  if (amount != null) parts.push("AM:" + Number(amount).toFixed(2));
  parts.push("CC:" + currency);
  if (vs) parts.push("X-VS:" + String(vs).replace(/\D/g, "").slice(0, 10));
  if (msg) parts.push("MSG:" + msg.replace(/\*/g, " ").slice(0, 60));
  return parts.join("*");
}
