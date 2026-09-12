import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { CustomerAddress } from "@/lib/types";

export const SESSION_COOKIE = "provlajky_customer";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;
const MAX_SHIPPING_ADDRESSES = 10;

export type ShippingAddressRow = {
  id: string;
  customer_id: string;
  label: string | null;
  company: string | null;
  name: string | null;
  street: string;
  psc: string;
  city: string;
  created_at: string;
};

export type CustomerProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  discount_code: string;
  discount_pct: number;
  used_at: string | null;
  billing: CustomerAddress | null;
  has_password: boolean;
  shipping_addresses: ShippingAddressRow[];
};

function sessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  // Dočasný fallback, dokud není CUSTOMER_SESSION_SECRET ve Vercelu —
  // odvozený od service role, ať Preview/local nepádí.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback && fallback.length >= 32) return `customer-session:${fallback}`.slice(0, 64);
  throw new Error("CUSTOMER_SESSION_SECRET must be set (min. 32 characters).");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= 8;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payloadJson: string): string {
  const payload = b64url(Buffer.from(payloadJson, "utf8"));
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySigned(token: string): { customerId: string; exp: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      customerId?: string;
      exp?: number;
    };
    if (!data.customerId || !data.exp || data.exp < Date.now()) return null;
    return { customerId: data.customerId, exp: data.exp };
  } catch {
    return null;
  }
}

export async function createSessionCookie(customerId: string): Promise<void> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = signPayload(JSON.stringify({ customerId, exp }));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionCustomerId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return verifySigned(token)?.customerId ?? null;
  } catch {
    // Chybějící/krátký secret v runtime — bere se jako nepřihlášený.
    return null;
  }
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export const DISCOUNT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DISCOUNT_CODE_LENGTH = 8;
export const DEFAULT_DISCOUNT_PCT = 10;

export function generateDiscountCode(): string {
  let code = "";
  for (let i = 0; i < DISCOUNT_CODE_LENGTH; i++) {
    code += DISCOUNT_CODE_CHARS[Math.floor(Math.random() * DISCOUNT_CODE_CHARS.length)];
  }
  return code;
}

export { MAX_SHIPPING_ADDRESSES };
