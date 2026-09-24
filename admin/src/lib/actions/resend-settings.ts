"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { deleteSecret, SecretsTableMissingError, writeSecret } from "@/lib/secrets";
import {
  loadResendConfig,
  maskApiKey,
  RESEND_SECRET_NAME,
  type StoredResendSettings,
} from "@/lib/newsletter/resend";

export type ResendSettingsStatus = {
  source: "settings" | "env" | "none";
  hint: string | null;
  fromEmail: string;
  fromName: string;
  updatedAt: string | null;
  tableMissing: boolean;
};

type Result<T = void> = { ok: true; data?: T; warning?: string } | { ok: false; error: string };

/**
 * Tyhle akce sahají na tajné klíče přes service role, takže RLS je nechrání —
 * přístup se ověří tady: přihlášený uživatel musí být v allowed_users
 * (tabulku přes session klienta vidí jen povolení uživatelé).
 */
async function requireAllowedUser(): Promise<string> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const email = auth.user?.email?.toLowerCase();
  if (!email) throw new Error("Nepřihlášený uživatel.");
  const { data } = await supabase.from("allowed_users").select("email").eq("email", email).maybeSingle();
  if (!data) throw new Error("Nemáš oprávnění měnit nastavení.");
  return email;
}

export async function getResendSettingsStatus(): Promise<ResendSettingsStatus> {
  await requireAllowedUser();
  const cfg = await loadResendConfig();
  return {
    source: cfg.source,
    hint: cfg.hint,
    fromEmail: cfg.fromEmail,
    fromName: cfg.fromName,
    updatedAt: cfg.updatedAt,
    tableMissing: cfg.tableMissing,
  };
}

type KeyCheck = { ok: true; warning?: string } | { ok: false; error: string };

/** Ověří klíč u Resendu a zkontroluje, že doména odesílatele je v účtu ověřená. */
async function checkResendKey(apiKey: string, fromEmail: string): Promise<KeyCheck> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, error: "Resend se nepodařilo kontaktovat, zkus to za chvíli." };
  }
  const json = (await res.json().catch(() => ({}))) as {
    name?: string;
    message?: string;
    data?: { name: string; status: string }[];
  };

  if (!res.ok) {
    // Klíč jen pro odesílání (Sending access) nesmí číst domény — je ale platný.
    if (json.name === "restricted_api_key") {
      return { ok: true, warning: "Klíč má jen oprávnění k odesílání, takže doménu odesílatele nešlo ověřit." };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Resend klíč odmítl — zkontroluj, že je zkopírovaný celý a nebyl smazán." };
    }
    return { ok: false, error: json.message || `Resend odpověděl ${res.status}.` };
  }

  const domain = fromEmail.split("@")[1]?.toLowerCase() || "";
  const found = (json.data || []).find((d) => d.name.toLowerCase() === domain);
  if (!found) {
    return {
      ok: true,
      warning: `Doména ${domain} v tomhle Resend účtu není — maily z ${fromEmail} neodejdou, dokud ji v Resend nepřidáš a neověříš.`,
    };
  }
  if (found.status !== "verified") {
    return {
      ok: true,
      warning: `Doména ${domain} zatím není v Resend ověřená (stav: ${found.status}). Dokonči ověření DNS záznamů.`,
    };
  }
  return { ok: true };
}

export async function saveResendSettings(input: {
  /** Prázdné = ponechat uložený klíč, změnit jen odesílatele. */
  apiKey: string;
  fromEmail: string;
  fromName: string;
}): Promise<Result<ResendSettingsStatus>> {
  try {
    const user = await requireAllowedUser();
    const fromEmail = input.fromEmail.trim().toLowerCase();
    const fromName = input.fromName.trim().slice(0, 80) || "PROVLAJKY";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return { ok: false, error: "Zadej platný e-mail odesílatele (např. newsletter@provlajky.cz)." };
    }

    let apiKey = input.apiKey.trim();
    if (!apiKey) {
      const current = await loadResendConfig();
      if (current.source !== "settings") return { ok: false, error: "Zadej Resend API klíč." };
      apiKey = current.apiKey;
    }
    if (!/^re_[A-Za-z0-9_-]{10,}$/.test(apiKey)) {
      return { ok: false, error: "Tohle nevypadá jako Resend API klíč — začíná na „re_“." };
    }

    const check = await checkResendKey(apiKey, fromEmail);
    if (!check.ok) return check;

    const stored: StoredResendSettings = { apiKey, fromEmail, fromName };
    await writeSecret(RESEND_SECRET_NAME, stored, maskApiKey(apiKey), user);
    revalidatePath("/newsletter");
    revalidatePath("/settings");
    return { ok: true, data: await getResendSettingsStatus(), warning: check.warning };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Uložení se nepovedlo." };
  }
}

export async function testResendSettings(): Promise<Result> {
  try {
    await requireAllowedUser();
    const cfg = await loadResendConfig();
    if (!cfg.apiKey) return { ok: false, error: "Není uložený žádný klíč." };
    const check = await checkResendKey(cfg.apiKey, cfg.fromEmail);
    return check.ok ? { ok: true, warning: check.warning } : check;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ověření se nepovedlo." };
  }
}

export async function deleteResendSettings(): Promise<Result<ResendSettingsStatus>> {
  try {
    await requireAllowedUser();
    await deleteSecret(RESEND_SECRET_NAME);
    revalidatePath("/newsletter");
    revalidatePath("/settings");
    return { ok: true, data: await getResendSettingsStatus() };
  } catch (e) {
    if (e instanceof SecretsTableMissingError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Smazání se nepovedlo." };
  }
}
