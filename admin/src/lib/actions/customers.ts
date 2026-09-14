"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmailAction } from "@/lib/actions/send-email";

function eshopBaseUrl(): string {
  const raw =
    process.env.ESHOP_URL ||
    process.env.NEXT_PUBLIC_ESHOP_URL ||
    "https://provlajky.cz";
  return raw.replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CustomerActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function deleteCustomer(customerId: string): Promise<CustomerActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", customerId);
  if (error) {
    console.error("deleteCustomer", error);
    return { ok: false, error: "Smazání se nepovedlo." };
  }
  revalidatePath("/uzivatele");
  revalidatePath("/");
  return { ok: true, message: "Zákazník smazán." };
}

/** Pošle odkaz na nastavení / obnovení hesla (stejný flow jako eshop). */
export async function sendCustomerPasswordLink(customerId: string): Promise<CustomerActionResult> {
  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, email, name, password_hash")
    .eq("id", customerId)
    .maybeSingle();
  if (error || !customer) return { ok: false, error: "Zákazník nenalezen." };

  const kind = customer.password_hash ? "reset_password" : "set_password";
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Staré nepoužité tokeny zrušíme, ať platí jen ten nový.
  await supabase
    .from("customer_password_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("customer_id", customer.id)
    .is("used_at", null);

  const { error: tokenErr } = await supabase.from("customer_password_tokens").insert({
    customer_id: customer.id,
    token_hash: tokenHash,
    kind,
    expires_at: expiresAt,
  });
  if (tokenErr) {
    console.error("sendCustomerPasswordLink: token", tokenErr);
    return { ok: false, error: "Nepodařilo se vytvořit odkaz." };
  }

  const link = `${eshopBaseUrl()}/nastavit-heslo?token=${encodeURIComponent(raw)}`;
  const greeting = customer.name ? `Ahoj ${escapeHtml(customer.name)},` : "Ahoj,";
  const lead =
    kind === "set_password"
      ? "pro dokončení účtu na provlajky.cz si nastavte heslo na tomto odkazu (platí 24 hodin):"
      : "pro obnovení hesla na provlajky.cz použijte tento odkaz (platí 24 hodin):";

  const mail = await sendEmailAction({
    kind: "other",
    to: customer.email,
    cc: [],
    subject: kind === "set_password" ? "Dokončení účtu — provlajky.cz" : "Obnovení hesla — provlajky.cz",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
        <p>${greeting}</p>
        <p>${lead}</p>
        <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ffe701;color:#08080a;padding:12px 20px;font-weight:bold;text-decoration:none;">Nastavit heslo</a></p>
        <p style="font-size:12px;color:#666;">Odkaz poslala administrace PROVLAJKY.CZ.</p>
      </div>
    `,
    attachments: [],
  });

  if (!mail.ok) {
    return { ok: false, error: mail.error || "E-mail se nepodařilo odeslat." };
  }

  const { data: svRow } = await supabase
    .from("customers")
    .select("session_version")
    .eq("id", customer.id)
    .single();
  await supabase
    .from("customers")
    .update({ session_version: (Number(svRow?.session_version) || 1) + 1 })
    .eq("id", customer.id);

  revalidatePath("/uzivatele");
  return {
    ok: true,
    message: customer.password_hash
      ? `Odkaz na obnovení hesla odeslán na ${customer.email}.`
      : `Odkaz na nastavení hesla odeslán na ${customer.email}.`,
  };
}

/** Znovu pošle slevový kód (jen pokud ještě nebyl uplatněný). */
export async function resendCustomerDiscount(customerId: string): Promise<CustomerActionResult> {
  const supabase = await createClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, email, name, discount_code, discount_pct, used_at")
    .eq("id", customerId)
    .maybeSingle();
  if (error || !customer) return { ok: false, error: "Zákazník nenalezen." };
  if (customer.used_at) {
    return { ok: false, error: "Slevový kód už byl uplatněn — znovu poslat nejde." };
  }

  const pct = Number(customer.discount_pct) || 10;
  const greeting = customer.name ? `Ahoj ${escapeHtml(customer.name)},` : "Ahoj,";
  const mail = await sendEmailAction({
    kind: "other",
    to: customer.email,
    cc: [],
    subject: "Váš slevový kód — provlajky.cz",
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
        <p>${greeting}</p>
        <p>váš slevový kód na <strong>${pct} %</strong> z první objednávky:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #ffe701; color: #08080a; padding: 12px 20px; display: inline-block;">${escapeHtml(customer.discount_code)}</p>
        <p>Kód zadejte v objednávce a klikněte na „Uplatnit“. Platí jednorázově.</p>
        <p>Tým PROVLAJKY.CZ</p>
      </div>
    `,
    attachments: [],
  });

  if (!mail.ok) {
    return { ok: false, error: mail.error || "E-mail se nepodařilo odeslat." };
  }

  return { ok: true, message: `Slevový kód odeslán na ${customer.email}.` };
}

/** Vymaže heslo (účet zůstane, zákazník si musí znovu nastavit přes odkaz). */
export async function clearCustomerPassword(customerId: string): Promise<CustomerActionResult> {
  const supabase = await createClient();
  const { data: cur } = await supabase
    .from("customers")
    .select("session_version, password_hash")
    .eq("id", customerId)
    .maybeSingle();
  if (!cur) return { ok: false, error: "Zákazník nenalezen." };
  if (!cur.password_hash) return { ok: false, error: "Účet heslo nemá." };

  const nextSv = (Number(cur.session_version) || 1) + 1;
  const { error } = await supabase
    .from("customers")
    .update({
      password_hash: null,
      password_updated_at: null,
      session_version: nextSv,
    })
    .eq("id", customerId);
  if (error) {
    console.error("clearCustomerPassword", error);
    return { ok: false, error: "Heslo se nepodařilo zrušit." };
  }

  await supabase
    .from("customer_password_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("used_at", null);

  revalidatePath("/uzivatele");
  return { ok: true, message: "Heslo zrušeno. Pošli zákazníkovi odkaz na nastavení hesla." };
}
