"use server";

import { revalidatePath } from "next/cache";
import { wrapEmailHtml } from "@/lib/email-templates";
import { getLogoAttachment } from "@/lib/mail/logo";
import { getSettings } from "@/lib/actions/settings";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { parseRidersCsv } from "@/lib/newsletter/csv";
import { newsletterGreeting } from "@/lib/newsletter/greeting";
import { shopHomeUrl, toProductCard } from "@/lib/newsletter/products";
import {
  generatePromoCode,
  normalizeCodeRules,
  validUntilFromRules,
} from "@/lib/newsletter/promo-code";
import { resendConfigured, sendViaResend, sleep } from "@/lib/newsletter/resend";
import { buildColdcallBodyHtml, buildNewsletterBodyHtml } from "@/lib/newsletter/template";
import type {
  ColdcallCompany,
  ColdcallStatus,
  NewsletterCampaign,
  NewsletterProductCard,
  NewsletterRider,
  PromoCodeRules,
} from "@/lib/newsletter/types";
import { COLDCALL_STATUSES } from "@/lib/newsletter/types";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function revalidateNewsletter() {
  revalidatePath("/newsletter");
}

async function brandedHtml(body: string): Promise<{ html: string; logo: Awaited<ReturnType<typeof getLogoAttachment>> }> {
  const settings = await getSettings();
  const html = wrapEmailHtml(body, settings.mail.signName || "Dominik Špaček", settings.mail.signPhone || "+420 605 981 155");
  const logo = await getLogoAttachment();
  return { html, logo };
}

async function loadProductCards(ids: string[]): Promise<NewsletterProductCard[]> {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").in("id", ids);
  const byId = new Map(((data || []) as Product[]).map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((p) => toProductCard(p!));
}

export async function getNewsletterBootstrap(): Promise<{
  riders: NewsletterRider[];
  companies: ColdcallCompany[];
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  resendReady: boolean;
}> {
  const supabase = await createClient();
  const [ridersRes, companiesRes, productsRes, campaignsRes] = await Promise.all([
    supabase.from("newsletter_riders").select("*").order("name"),
    supabase.from("coldcall_companies").select("*").order("updated_at", { ascending: false }),
    supabase.from("products").select("*").eq("active", true).order("sort_order"),
    supabase.from("newsletter_campaigns").select("*").order("created_at", { ascending: false }).limit(20),
  ]);

  const missing =
    ridersRes.error?.message ||
    companiesRes.error?.message ||
    campaignsRes.error?.message;
  if (missing && /does not exist|schema cache|Could not find/i.test(missing)) {
    throw new Error(
      "Tabulky newsletteru ještě neexistují. Spusť v Supabase SQL Editoru soubor admin/supabase/2026-09-newsletter.sql."
    );
  }
  if (ridersRes.error) throw new Error(ridersRes.error.message);
  if (companiesRes.error) throw new Error(companiesRes.error.message);
  if (campaignsRes.error) throw new Error(campaignsRes.error.message);

  const products = ((productsRes.data || []) as Product[]).map(toProductCard);

  return {
    riders: (ridersRes.data || []) as NewsletterRider[],
    companies: (companiesRes.data || []) as ColdcallCompany[],
    products,
    campaigns: (campaignsRes.data || []) as NewsletterCampaign[],
    resendReady: resendConfigured(),
  };
}

/** Top produkty podle počtu prodaných ks v order_items. */
export async function getTopProductIds(limit = 6): Promise<ActionResult<string[]>> {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("order_items")
    .select("product_id, qty")
    .not("product_id", "is", null)
    .limit(5000);
  if (error) return { ok: false, error: error.message };

  const counts = new Map<string, number>();
  for (const row of items || []) {
    const id = (row as { product_id: string; qty: number }).product_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + Number((row as { qty: number }).qty || 1));
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  if (ranked.length >= limit) return { ok: true, data: ranked.slice(0, limit) };

  // Doplň aktivními produkty, pokud je málo prodejů.
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("active", true)
    .order("sort_order")
    .limit(limit);
  const extras = ((products || []) as { id: string }[]).map((p) => p.id).filter((id) => !ranked.includes(id));
  return { ok: true, data: [...ranked, ...extras].slice(0, limit) };
}

export async function importRidersCsv(
  csvText: string,
  eventLabel?: string
): Promise<ActionResult<{ imported: number; updated: number; skippedNonCzSk: number }>> {
  const parsed = parseRidersCsv(csvText);
  if (parsed.error) return { ok: false, error: parsed.error };
  if (!parsed.riders.length) {
    return {
      ok: false,
      error: parsed.skippedNonCzSk
        ? `Žádní CZ/SK jezdci (přeskočeno ${parsed.skippedNonCzSk} z jiných zemí).`
        : "CSV neobsahuje žádné použitelné řádky.",
    };
  }

  const supabase = await createClient();
  let imported = 0;
  let updated = 0;

  for (const r of parsed.riders) {
    const email = r.email.trim().toLowerCase();
    const { data: existing } = await supabase
      .from("newsletter_riders")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    const row = {
      name: r.name.trim(),
      email,
      country: r.country,
      phone: r.phone || null,
      event_label: eventLabel?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase.from("newsletter_riders").update(row).eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
      updated++;
    } else {
      const { error } = await supabase.from("newsletter_riders").insert(row);
      if (error) return { ok: false, error: error.message };
      imported++;
    }
  }

  revalidateNewsletter();
  return { ok: true, data: { imported, updated, skippedNonCzSk: parsed.skippedNonCzSk } };
}

export async function deleteRider(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_riders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateNewsletter();
  return { ok: true };
}

export async function upsertColdcallCompany(input: {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  note?: string;
  status?: ColdcallStatus;
  default_discount_type?: "percent" | "fixed";
  default_discount_value?: number;
}): Promise<ActionResult<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Zadej název firmy." };
  const status = input.status && COLDCALL_STATUSES.includes(input.status) ? input.status : "nova";
  const row = {
    name,
    phone: input.phone?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    note: input.note?.trim() || null,
    status,
    default_discount_type: input.default_discount_type === "fixed" ? "fixed" : "percent",
    default_discount_value: Number(input.default_discount_value) || 10,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (input.id) {
    const { error } = await supabase.from("coldcall_companies").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidateNewsletter();
    return { ok: true, data: { id: input.id } };
  }
  const { data, error } = await supabase.from("coldcall_companies").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: error?.message || "Uložení selhalo." };
  revalidateNewsletter();
  return { ok: true, data: { id: data.id } };
}

export async function updateColdcallStatus(id: string, status: ColdcallStatus): Promise<ActionResult> {
  if (!COLDCALL_STATUSES.includes(status)) return { ok: false, error: "Neplatný stav." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("coldcall_companies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateNewsletter();
  return { ok: true };
}

export async function deleteColdcallCompany(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("coldcall_companies").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateNewsletter();
  return { ok: true };
}

export type PreviewCampaignInput = {
  kind: "rts" | "coldcall";
  subject: string;
  introHtml: string;
  productIds: string[];
  codeRules: Partial<PromoCodeRules>;
  /** Pro náhled — konkrétní jezdec / firma. */
  recipientRiderId?: string;
  recipientCompanyId?: string;
};

export async function previewNewsletterHtml(
  input: PreviewCampaignInput
): Promise<ActionResult<{ html: string; subject: string }>> {
  const rules = normalizeCodeRules(input.codeRules);
  const products = await loadProductCards(input.productIds.slice(0, 6));
  const supabase = await createClient();
  const sampleCode = "PV-NAHLED01";
  const validUntil = validUntilFromRules(rules);

  let body: string;
  let subject = input.subject.trim() || "Nabídka od PROVLAJKY";

  if (input.kind === "rts") {
    let name = "Jan Novák";
    let country = "CZ";
    if (input.recipientRiderId) {
      const { data } = await supabase.from("newsletter_riders").select("*").eq("id", input.recipientRiderId).maybeSingle();
      if (data) {
        name = data.name;
        country = data.country;
      }
    }
    body = buildNewsletterBodyHtml({
      greeting: newsletterGreeting(name, country),
      introHtml: input.introHtml,
      products,
      code: sampleCode,
      discountType: rules.discountType,
      discountValue: rules.discountValue,
      validUntil,
      ctaUrl: shopHomeUrl(),
    });
  } else {
    let companyName = "Ukázková firma s.r.o.";
    if (input.recipientCompanyId) {
      const { data } = await supabase.from("coldcall_companies").select("*").eq("id", input.recipientCompanyId).maybeSingle();
      if (data) companyName = data.name;
    }
    body = buildColdcallBodyHtml({
      greeting: "Dobrý den,",
      introHtml: input.introHtml,
      products,
      code: sampleCode,
      discountType: rules.discountType,
      discountValue: rules.discountValue,
      validUntil,
      ctaUrl: shopHomeUrl(),
      companyName,
    });
  }

  const { html } = await brandedHtml(body);
  return { ok: true, data: { html, subject } };
}

async function insertPromoForRecipient(opts: {
  rules: PromoCodeRules;
  source: "rts" | "coldcall";
  riderId?: string | null;
  companyId?: string | null;
  campaignId?: string | null;
  prefix?: string;
}): Promise<{ id: string; code: string; validUntil: string | null } | { error: string }> {
  const supabase = await createClient();
  const validUntil = validUntilFromRules(opts.rules);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generatePromoCode(opts.prefix || "PV");
    const { data, error } = await supabase
      .from("promo_codes")
      .insert({
        code,
        discount_type: opts.rules.discountType,
        discount_value: opts.rules.discountValue,
        one_shot: opts.rules.oneShot,
        max_uses: opts.rules.maxUses,
        used_count: 0,
        valid_until: validUntil,
        source: opts.source,
        rider_id: opts.riderId || null,
        company_id: opts.companyId || null,
        campaign_id: opts.campaignId || null,
      })
      .select("id, code, valid_until")
      .single();
    if (!error && data) {
      return { id: data.id, code: data.code, validUntil: data.valid_until };
    }
    if (error && !/duplicate|unique/i.test(error.message)) {
      return { error: error.message };
    }
  }
  return { error: "Nepodařilo se vygenerovat unikátní kód." };
}

export type SendCampaignInput = {
  kind: "rts" | "coldcall";
  subject: string;
  introHtml: string;
  productIds: string[];
  codeRules: Partial<PromoCodeRules>;
  /** Coldcall: omezit na stavy. Prázdné = všichni s emailem. */
  coldcallStatuses?: ColdcallStatus[];
  /** Jen znovu odeslat failed z této kampaně. */
  retryCampaignId?: string;
  /** Test: pošli jen na tuhle adresu (1 mail, 1 kód). */
  testTo?: string;
};

export async function sendNewsletterCampaign(
  input: SendCampaignInput
): Promise<
  ActionResult<{ campaignId: string; sent: number; failed: number; skipped: number }>
> {
  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: "Chybí předmět mailu." };
  const rules = normalizeCodeRules(input.codeRules);
  if (rules.discountValue <= 0) return { ok: false, error: "Sleva musí být větší než 0." };
  if (!input.productIds.length) return { ok: false, error: "Vyber aspoň jeden produkt do mailu." };

  if (!resendConfigured() && !input.testTo) {
    // i test potřebuje Resend — stejně
  }
  if (!resendConfigured()) {
    return {
      ok: false,
      error: "Resend není nastavený. Doplň RESEND_API_KEY a RESEND_FROM_EMAIL (viz .env.local).",
    };
  }

  const supabase = await createClient();
  const products = await loadProductCards(input.productIds.slice(0, 6));
  const { logo } = await brandedHtml("<p></p>");
  const settings = await getSettings();
  const logoAtt = logo
    ? [
        {
          filename: logo.filename,
          contentBase64: logo.contentBase64,
          contentType: logo.contentType,
          contentId: logo.cid || "provlajkylogo",
        },
      ]
    : [];

  let campaignId = input.retryCampaignId || "";
  if (!campaignId) {
    const { data: camp, error: campErr } = await supabase
      .from("newsletter_campaigns")
      .insert({
        kind: input.kind,
        subject,
        intro_html: input.introHtml || "",
        product_ids: input.productIds.slice(0, 6),
        code_rules: rules,
        status: "sending",
      })
      .select("id")
      .single();
    if (campErr || !camp) return { ok: false, error: campErr?.message || "Kampaň se neuložila." };
    campaignId = camp.id;
  } else {
    await supabase.from("newsletter_campaigns").update({ status: "sending" }).eq("id", campaignId);
  }

  type Recip = {
    email: string;
    name: string;
    country?: string;
    riderId?: string;
    companyId?: string;
    companyName?: string;
  };

  const recipients: Recip[] = [];

  if (input.testTo) {
    recipients.push({ email: input.testTo.trim().toLowerCase(), name: "Test", country: "CZ" });
  } else if (input.retryCampaignId) {
    const { data: failed } = await supabase
      .from("newsletter_sends")
      .select("recipient_email, recipient_name, rider_id, company_id")
      .eq("campaign_id", input.retryCampaignId)
      .eq("status", "failed");
    for (const f of failed || []) {
      recipients.push({
        email: f.recipient_email,
        name: f.recipient_name || "",
        riderId: f.rider_id || undefined,
        companyId: f.company_id || undefined,
      });
    }
  } else if (input.kind === "rts") {
    const { data } = await supabase.from("newsletter_riders").select("*").in("country", ["CZ", "SK"]);
    for (const r of (data || []) as NewsletterRider[]) {
      recipients.push({
        email: r.email,
        name: r.name,
        country: r.country,
        riderId: r.id,
      });
    }
  } else {
    let q = supabase.from("coldcall_companies").select("*").not("email", "is", null);
    if (input.coldcallStatuses?.length) {
      q = q.in("status", input.coldcallStatuses);
    }
    const { data } = await q;
    for (const c of (data || []) as ColdcallCompany[]) {
      if (!c.email?.trim()) continue;
      recipients.push({
        email: c.email.trim().toLowerCase(),
        name: c.name,
        companyId: c.id,
        companyName: c.name,
      });
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recip of recipients) {
    if (!recip.email.includes("@")) {
      skipped++;
      continue;
    }

    // Při retry přeskoč, pokud mezitím už sent
    if (input.retryCampaignId) {
      const { data: already } = await supabase
        .from("newsletter_sends")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("recipient_email", recip.email)
        .eq("status", "sent")
        .maybeSingle();
      if (already) {
        skipped++;
        continue;
      }
    }

    const promo = await insertPromoForRecipient({
      rules,
      source: input.kind === "rts" ? "rts" : "coldcall",
      riderId: recip.riderId,
      companyId: recip.companyId,
      campaignId,
      prefix: input.kind === "rts" ? "RTS" : "B2B",
    });
    if ("error" in promo) {
      failed++;
      await supabase.from("newsletter_sends").insert({
        campaign_id: campaignId,
        kind: input.testTo ? "test" : "campaign",
        recipient_email: recip.email,
        recipient_name: recip.name,
        rider_id: recip.riderId || null,
        company_id: recip.companyId || null,
        status: "failed",
        error_message: promo.error,
        subject,
      });
      continue;
    }

    const body =
      input.kind === "rts"
        ? buildNewsletterBodyHtml({
            greeting: newsletterGreeting(recip.name, recip.country || "CZ"),
            introHtml: input.introHtml,
            products,
            code: promo.code,
            discountType: rules.discountType,
            discountValue: rules.discountValue,
            validUntil: promo.validUntil,
            ctaUrl: shopHomeUrl(),
          })
        : buildColdcallBodyHtml({
            greeting: "Dobrý den,",
            introHtml: input.introHtml,
            products,
            code: promo.code,
            discountType: rules.discountType,
            discountValue: rules.discountValue,
            validUntil: promo.validUntil,
            ctaUrl: shopHomeUrl(),
            companyName: recip.companyName || recip.name,
          });

    const html = wrapEmailHtml(
      body,
      settings.mail.signName || "Dominik Špaček",
      settings.mail.signPhone || "+420 605 981 155"
    );

    const result = await sendViaResend({
      to: recip.email,
      subject,
      html,
      replyTo: settings.mail.from || undefined,
      attachments: logoAtt,
    });

    await supabase.from("newsletter_sends").insert({
      campaign_id: campaignId,
      kind: input.testTo ? "test" : "campaign",
      recipient_email: recip.email,
      recipient_name: recip.name,
      rider_id: recip.riderId || null,
      company_id: recip.companyId || null,
      promo_code_id: promo.id,
      resend_id: result.ok ? result.id : null,
      status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
      subject,
      html_body: html,
    });

    await supabase.from("email_history").insert({
      sent_by: null,
      kind: "newsletter",
      to_addr: recip.email,
      cc: [],
      bcc: [],
      subject,
      html_body: html,
      attachments_meta: [],
      status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
    });

    if (result.ok) {
      sent++;
      if (recip.companyId) {
        await supabase
          .from("coldcall_companies")
          .update({ last_contacted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", recip.companyId);
      }
    } else {
      failed++;
    }

    // ~8 mailů / s — šetrné k Resend free tieru
    await sleep(120);
  }

  const status = failed === 0 && sent > 0 ? "sent" : sent > 0 && failed > 0 ? "partial" : sent === 0 ? "failed" : "sent";
  await supabase
    .from("newsletter_campaigns")
    .update({ status, sent_at: new Date().toISOString() })
    .eq("id", campaignId);

  revalidateNewsletter();
  return { ok: true, data: { campaignId, sent, failed, skipped } };
}

export async function sendColdcallManual(input: {
  companyId: string;
  subject: string;
  introHtml: string;
  productIds: string[];
  codeRules?: Partial<PromoCodeRules>;
  flipStatusToJedname?: boolean;
}): Promise<ActionResult<{ sendId: string }>> {
  if (!resendConfigured()) {
    return { ok: false, error: "Resend není nastavený (RESEND_API_KEY / RESEND_FROM_EMAIL)." };
  }
  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: "Chybí předmět." };

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("coldcall_companies")
    .select("*")
    .eq("id", input.companyId)
    .maybeSingle();
  if (error || !company) return { ok: false, error: error?.message || "Firma nenalezena." };
  if (!company.email?.trim()) return { ok: false, error: "Firma nemá e-mail." };

  const rules = normalizeCodeRules(
    input.codeRules || {
      discountType: company.default_discount_type,
      discountValue: Number(company.default_discount_value) || 10,
      oneShot: true,
      maxUses: 1,
      validDays: 30,
    }
  );

  const products = await loadProductCards(input.productIds.slice(0, 6));
  const promo = await insertPromoForRecipient({
    rules,
    source: "coldcall",
    companyId: company.id,
    prefix: "B2B",
  });
  if ("error" in promo) return { ok: false, error: promo.error };

  const settings = await getSettings();
  const body = buildColdcallBodyHtml({
    greeting: "Dobrý den,",
    introHtml: input.introHtml,
    products,
    code: promo.code,
    discountType: rules.discountType,
    discountValue: rules.discountValue,
    validUntil: promo.validUntil,
    ctaUrl: shopHomeUrl(),
    companyName: company.name,
  });
  const html = wrapEmailHtml(
    body,
    settings.mail.signName || "Dominik Špaček",
    settings.mail.signPhone || "+420 605 981 155"
  );
  const logo = await getLogoAttachment();

  const result = await sendViaResend({
    to: company.email.trim().toLowerCase(),
    subject,
    html,
    replyTo: settings.mail.from || undefined,
    attachments: logo
      ? [
          {
            filename: logo.filename,
            contentBase64: logo.contentBase64,
            contentType: logo.contentType,
            contentId: logo.cid || "provlajkylogo",
          },
        ]
      : [],
  });

  const { data: sendRow, error: sendErr } = await supabase
    .from("newsletter_sends")
    .insert({
      campaign_id: null,
      kind: "coldcall_manual",
      recipient_email: company.email.trim().toLowerCase(),
      recipient_name: company.name,
      company_id: company.id,
      promo_code_id: promo.id,
      resend_id: result.ok ? result.id : null,
      status: result.ok ? "sent" : "failed",
      error_message: result.ok ? null : result.error,
      subject,
      html_body: html,
    })
    .select("id")
    .single();

  await supabase.from("email_history").insert({
    sent_by: null,
    kind: "newsletter",
    to_addr: company.email.trim().toLowerCase(),
    cc: [],
    bcc: [],
    subject,
    html_body: html,
    attachments_meta: [],
    status: result.ok ? "sent" : "failed",
    error_message: result.ok ? null : result.error,
  });

  if (!result.ok) return { ok: false, error: result.error };
  if (sendErr || !sendRow) return { ok: false, error: sendErr?.message || "Log se neuložil." };

  const patch: Record<string, unknown> = {
    last_contacted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.flipStatusToJedname) patch.status = "jedname";
  await supabase.from("coldcall_companies").update(patch).eq("id", company.id);

  revalidateNewsletter();
  return { ok: true, data: { sendId: sendRow.id } };
}
