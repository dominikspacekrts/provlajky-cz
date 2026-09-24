import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

// Jen pro serverový kód (server actions / route handlers). Tabulka app_secrets
// nemá RLS policy, čte ji pouze service role; hodnota je navíc zašifrovaná,
// takže ani výpis databáze sám o sobě klíč neprozradí.

export class SecretsTableMissingError extends Error {
  constructor() {
    super("Chybí tabulka app_secrets — spusť v Supabase SQL Editoru soubor admin/supabase/2026-09-app-secrets.sql.");
  }
}

function encryptionKey(): Buffer {
  const base = process.env.APP_SECRETS_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base) throw new Error("Server nemá SUPABASE_SERVICE_ROLE_KEY — tajné klíče nejde zašifrovat.");
  return createHash("sha256").update(`provlajky-app-secrets:${base}`).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Neznámý formát uloženého klíče.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === "42P01" || err.code === "PGRST205" || /app_secrets/.test(err.message || ""));
}

export type SecretMeta = { hint: string | null; updatedAt: string; updatedBy: string | null };

export async function readSecret<T>(name: string): Promise<{ value: T; meta: SecretMeta } | null> {
  const { data, error } = await createServiceClient()
    .from("app_secrets")
    .select("value, hint, updated_at, updated_by")
    .eq("name", name)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new SecretsTableMissingError();
    throw new Error(error.message);
  }
  if (!data) return null;
  let value: T;
  try {
    value = JSON.parse(decrypt(data.value)) as T;
  } catch {
    // Klíč pro šifrování se změnil (např. nový service role klíč) — uložená hodnota je nečitelná.
    return null;
  }
  return { value, meta: { hint: data.hint, updatedAt: data.updated_at, updatedBy: data.updated_by } };
}

export async function writeSecret(name: string, value: unknown, hint: string | null, updatedBy: string | null) {
  const { error } = await createServiceClient()
    .from("app_secrets")
    .upsert({
      name,
      value: encrypt(JSON.stringify(value)),
      hint,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    });
  if (error) {
    if (isMissingTable(error)) throw new SecretsTableMissingError();
    throw new Error(error.message);
  }
}

export async function deleteSecret(name: string) {
  const { error } = await createServiceClient().from("app_secrets").delete().eq("name", name);
  if (error) {
    if (isMissingTable(error)) throw new SecretsTableMissingError();
    throw new Error(error.message);
  }
}
