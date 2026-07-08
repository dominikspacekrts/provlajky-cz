"use server";

import { createClient } from "@/lib/supabase/server";
import type { Settings } from "@/lib/types";

const DEFAULT_MAIL: Settings["mail"] = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  fromName: "PROVLAJKY",
  from: "",
  accountant: "",
  supplier: "",
  tplInvoice: "",
  tplVisual: "",
  tplAccountant: "",
  signName: "Dominik Špaček",
  signPhone: "+420 605 981 155",
};

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return {
    id: 1,
    cost_per_size: { S: 0, M: 0, L: 0, XL: 0, ...(data?.cost_per_size || {}) },
    mail: { ...DEFAULT_MAIL, ...(data?.mail || {}) },
    updated_at: data?.updated_at,
  };
}

// Safe subset for client components that build e-mail HTML (e.g. SendInvoiceButton) —
// never includes host/user/pass, which stay entirely server-side.
export async function getMailTemplatesForClient() {
  const settings = await getSettings();
  const { tplInvoice, tplVisual, tplAccountant, signName, signPhone, accountant } = settings.mail;
  return { tplInvoice, tplVisual, tplAccountant, signName, signPhone, accountant };
}

export async function updateCostPerSize(costPerSize: Settings["cost_per_size"]) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ cost_per_size: costPerSize, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function updateMailSettings(mail: Settings["mail"]) {
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ mail, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) throw new Error(error.message);
}

export async function testSmtp(mail: Pick<Settings["mail"], "host" | "port" | "secure" | "user" | "pass">) {
  const nodemailer = (await import("nodemailer")).default;
  try {
    const transporter = nodemailer.createTransport({
      host: mail.host,
      port: Number(mail.port) || 587,
      secure: !!mail.secure,
      auth: { user: mail.user, pass: mail.pass },
    });
    await transporter.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chyba spojení." };
  }
}
