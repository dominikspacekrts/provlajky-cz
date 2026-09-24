"use server";

import { revalidatePath } from "next/cache";
import { wrapEmailHtml } from "@/lib/email-templates";
import { getLogoAttachment } from "@/lib/mail/logo";
import { getSettings } from "@/lib/actions/settings";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";
import { parseRidersCsv } from "@/lib/newsletter/csv";
import { czechVocativeFirst, firstName, newsletterGreeting } from "@/lib/newsletter/greeting";
import { shopHomeUrl, toProductCard } from "@/lib/newsletter/products";
import {
  generatePromoCode,
  normalizeCodeRules,
  validUntilFromRules,
} from "@/lib/newsletter/promo-code";
import { loadResendConfig, resendConfigError, sendViaResend, sleep } from "@/lib/newsletter/resend";
import { buildColdcallBodyHtml, buildNewsletterBodyHtml } from "@/lib/newsletter/template";
import type {
  ColdcallCompany,
  ColdcallStatus,
  NewsletterCampaign,
  NewsletterProductCard,
  NewsletterRider,
  PromoCodeRules,
  TeamMember,
} from "@/lib/newsletter/types";
import { COLDCALL_STATUSES, CONTACT_COOLDOWN_DAYS } from "@/lib/newsletter/types";

function defaultCodePrefix(kind: "rts" | "coldcall") {
  return kind === "rts" ? "RACE10" : "B2B";
}

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

function revalidateNewsletter() {
  revalidatePath("/newsletter");
}

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

async function currentUserEmail(supabase: SupabaseServer): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.email?.toLowerCase() || null;
}

const TEAM_MIGRATION_HINT =
  "Chybí sloupce pro práci ve více lidech — spusť v Supabase SQL Editoru soubor admin/supabase/2026-09-coldcall-team.sql.";

function isMissingTeamColumn(message: string | undefined): boolean {
  return /assigned_to|updated_by|last_contacted_by/.test(message || "") && /column|schema cache/i.test(message || "");
}

function friendlyDbError(message: string | undefined, fallback: string): string {
  if (isMissingTeamColumn(message)) return TEAM_MIGRATION_HINT;
  return message || fallback;
}

function cooldownCutoff(): string {
  return new Date(Date.now() - CONTACT_COOLDOWN_DAYS * 864e5).toISOString();
}

/**
 * Zamluví firmu pro odeslání: zapíše last_contacted_* jen když jí nikdo nepsal
 * v posledních CONTACT_COOLDOWN_DAYS dnech. Jde o jeden UPDATE s podmínkou, takže
 * když dva lidé odesílají zároveň, projde jen jeden z nich.
 */
async function claimCompanyContact(
  supabase: SupabaseServer,
  companyId: string,
  me: string | null,
  enforceCooldown: boolean
): Promise<boolean> {
  let q = supabase
    .from("coldcall_companies")
    .update({ last_contacted_at: new Date().toISOString(), last_contacted_by: me })
    .eq("id", companyId);
  if (enforceCooldown) q = q.or(`last_contacted_at.is.null,last_contacted_at.lt.${cooldownCutoff()}`);
  const { data, error } = await q.select("id");
  if (error) throw new Error(friendlyDbError(error.message, "Firmu se nepodařilo zamluvit."));
  return (data || []).length > 0;
}

async function releaseCompanyContact(
  supabase: SupabaseServer,
  companyId: string,
  previous: { at: string | null; by: string | null }
) {
  await supabase
    .from("coldcall_companies")
    .update({ last_contacted_at: previous.at, last_contacted_by: previous.by })
    .eq("id", companyId);
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

export type CampaignStats = { sent: number; failed: number; codesUsed: number };

export async function getNewsletterBootstrap(): Promise<{
  riders: NewsletterRider[];
  companies: ColdcallCompany[];
  products: NewsletterProductCard[];
  campaigns: NewsletterCampaign[];
  campaignStats: Record<string, CampaignStats>;
  resendReady: boolean;
  fromAddress: string;
  team: TeamMember[];
  me: string | null;
  teamReady: boolean;
}> {
  const supabase = await createClient();
  const [ridersRes, companiesRes, productsRes, campaignsRes, teamRes, teamColsRes, me] = await Promise.all([
    supabase.from("newsletter_riders").select("*").order("name"),
    supabase.from("coldcall_companies").select("*").order("updated_at", { ascending: false }),
    supabase.from("products").select("*").eq("active", true).order("sort_order"),
    supabase.from("newsletter_campaigns").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("allowed_users").select("email, display_name").order("display_name"),
    supabase.from("coldcall_companies").select("assigned_to, updated_by, last_contacted_by").limit(1),
    currentUserEmail(supabase),
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
  const campaigns = (campaignsRes.data || []) as NewsletterCampaign[];

  const campaignStats: Record<string, CampaignStats> = {};
  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length) {
    for (const id of campaignIds) campaignStats[id] = { sent: 0, failed: 0, codesUsed: 0 };
    const [sendsRes, codesRes] = await Promise.all([
      supabase
        .from("newsletter_sends")
        .select("campaign_id, recipient_email, status")
        .in("campaign_id", campaignIds)
        .limit(10000),
      supabase.from("promo_codes").select("campaign_id, used_count").in("campaign_id", campaignIds).limit(10000),
    ]);
    const byCampaign = new Map<string, { recipient_email: string; status: string }[]>();
    for (const s of (sendsRes.data || []) as { campaign_id: string; recipient_email: string; status: string }[]) {
      const list = byCampaign.get(s.campaign_id) || [];
      list.push(s);
      byCampaign.set(s.campaign_id, list);
    }
    for (const [id, rows] of byCampaign) {
      const st = campaignStats[id];
      if (st) Object.assign(st, summarizeSends(rows));
    }
    for (const c of (codesRes.data || []) as { campaign_id: string; used_count: number }[]) {
      const st = campaignStats[c.campaign_id];
      if (st && c.used_count > 0) st.codesUsed++;
    }
  }

  const resendCfg = await loadResendConfig();
  const fromEmail = resendCfg.fromEmail || "newsletter@provlajky.cz";
  const fromName = resendCfg.fromName || "PROVLAJKY";

  return {
    riders: (ridersRes.data || []) as NewsletterRider[],
    companies: (companiesRes.data || []) as ColdcallCompany[],
    products,
    campaigns,
    campaignStats,
    resendReady: !resendConfigError(resendCfg),
    fromAddress: `${fromName} <${fromEmail}>`,
    team: (teamRes.data || []) as TeamMember[],
    me,
    teamReady: !teamColsRes.error,
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
  /** undefined = nechat beze změny (u nové firmy se přiřadí tomu, kdo ji zakládá). */
  assigned_to?: string | null;
  /** updated_at, ze kterého úprava vycházela — když se mezitím změnil, nic se nepřepíše. */
  expectedUpdatedAt?: string;
}): Promise<ActionResult<ColdcallCompany> | { ok: false; error: string; conflict: ColdcallCompany }> {
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
  const me = await currentUserEmail(supabase);
  const teamFields: Record<string, unknown> = { updated_by: me };
  if (input.assigned_to !== undefined) teamFields.assigned_to = input.assigned_to || null;

  if (!input.id) {
    let res = await supabase
      .from("coldcall_companies")
      .insert({ ...row, ...teamFields, assigned_to: input.assigned_to === undefined ? me : input.assigned_to || null })
      .select("*")
      .single();
    if (res.error && isMissingTeamColumn(res.error.message)) {
      res = await supabase.from("coldcall_companies").insert(row).select("*").single();
    }
    const { data, error } = res;
    if (error || !data) return { ok: false, error: friendlyDbError(error?.message, "Uložení selhalo.") };
    revalidateNewsletter();
    return { ok: true, data: data as ColdcallCompany };
  }

  const updateRow = async (patch: Record<string, unknown>) => {
    let q = supabase.from("coldcall_companies").update(patch).eq("id", input.id!);
    if (input.expectedUpdatedAt) q = q.eq("updated_at", input.expectedUpdatedAt);
    return q.select("*");
  };
  let updated = await updateRow({ ...row, ...teamFields });
  if (updated.error && isMissingTeamColumn(updated.error.message)) updated = await updateRow(row);
  const { data, error } = updated;
  if (error) return { ok: false, error: friendlyDbError(error.message, "Uložení selhalo.") };
  if (!data?.length) {
    const { data: current } = await supabase.from("coldcall_companies").select("*").eq("id", input.id).maybeSingle();
    if (!current) return { ok: false, error: "Firmu mezitím někdo smazal." };
    return {
      ok: false,
      error: "Firmu mezitím upravil někdo jiný. Zkontroluj jeho změny a ulož znovu.",
      conflict: current as ColdcallCompany,
    };
  }
  revalidateNewsletter();
  return { ok: true, data: data[0] as ColdcallCompany };
}

export async function updateColdcallAssignee(id: string, assignedTo: string | null): Promise<ActionResult<ColdcallCompany>> {
  const supabase = await createClient();
  const me = await currentUserEmail(supabase);
  const { data, error } = await supabase
    .from("coldcall_companies")
    .update({ assigned_to: assignedTo || null, updated_by: me, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: friendlyDbError(error?.message, "Uložení selhalo.") };
  revalidateNewsletter();
  return { ok: true, data: data as ColdcallCompany };
}

export async function updateColdcallStatus(id: string, status: ColdcallStatus): Promise<ActionResult<ColdcallCompany>> {
  if (!COLDCALL_STATUSES.includes(status)) return { ok: false, error: "Neplatný stav." };
  const supabase = await createClient();
  const me = await currentUserEmail(supabase);
  let res = await supabase
    .from("coldcall_companies")
    .update({ status, updated_by: me, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (res.error && isMissingTeamColumn(res.error.message)) {
    res = await supabase
      .from("coldcall_companies")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
  }
  if (res.error || !res.data) return { ok: false, error: res.error?.message || "Uložení selhalo." };
  revalidateNewsletter();
  return { ok: true, data: res.data as ColdcallCompany };
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
): Promise<ActionResult<{ html: string; subject: string; to: string }>> {
  const rules = normalizeCodeRules(input.codeRules);
  const products = await loadProductCards(input.productIds.slice(0, 6));
  const supabase = await createClient();
  const sampleCode = `${rules.prefix || defaultCodePrefix(input.kind)}-7KQ2MX`;
  const validUntil = validUntilFromRules(rules);

  let body: string;
  const subject = input.subject.trim() || "(bez předmětu)";
  let to = "";

  if (input.kind === "rts") {
    let name = "Jan Novák";
    let country = "CZ";
    to = "jan.novak@example.cz";
    if (input.recipientRiderId) {
      const { data } = await supabase.from("newsletter_riders").select("*").eq("id", input.recipientRiderId).maybeSingle();
      if (data) {
        name = data.name;
        country = data.country;
        to = data.email;
      }
    }
    body = buildNewsletterBodyHtml({
      greeting: newsletterGreeting(name, country),
      firstName: country === "SK" ? firstName(name) : czechVocativeFirst(name),
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
    to = "info@firma.cz";
    if (input.recipientCompanyId) {
      const { data } = await supabase.from("coldcall_companies").select("*").eq("id", input.recipientCompanyId).maybeSingle();
      if (data) {
        companyName = data.name;
        to = data.email || "(firma nemá e-mail)";
      }
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

  const { html, logo } = await brandedHtml(body);
  // V mailu je logo inline příloha (cid:), v náhledu v prohlížeči ho musí nahradit data URI.
  const previewHtml = logo
    ? html.replace(/cid:provlajkylogo/g, `data:${logo.contentType};base64,${logo.contentBase64}`)
    : html;
  return { ok: true, data: { html: previewHtml, subject, to } };
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
  /** Coldcall: přeskočit firmy, kterým někdo psal za posledních CONTACT_COOLDOWN_DAYS dní. */
  skipRecentlyContacted?: boolean;
  /** Coldcall: jen firmy přiřazené tomuhle uživateli. */
  onlyAssignedTo?: string;
};

export async function sendNewsletterCampaign(
  input: SendCampaignInput
): Promise<
  ActionResult<{ campaignId: string | null; sent: number; failed: number; skipped: number }>
> {
  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: "Chybí předmět mailu." };
  const rules = normalizeCodeRules(input.codeRules);
  if (rules.discountValue <= 0) return { ok: false, error: "Sleva musí být větší než 0." };

  const resendCfg = await loadResendConfig();
  const resendErr = resendConfigError(resendCfg);
  if (resendErr) return { ok: false, error: resendErr };

  const supabase = await createClient();
  if (input.kind === "coldcall" && !input.testTo) {
    const { error: colsErr } = await supabase.from("coldcall_companies").select("last_contacted_by").limit(1);
    if (colsErr) return { ok: false, error: friendlyDbError(colsErr.message, "Firmy se nepodařilo načíst.") };
  }
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

  // Test se do historie kampaní nezapisuje — jen do newsletter_sends (kind "test").
  let campaignId: string | null = input.retryCampaignId || null;
  if (input.testTo) {
    campaignId = null;
  } else if (!campaignId) {
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
    previousContact?: { at: string | null; by: string | null };
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
    if (input.onlyAssignedTo) q = q.eq("assigned_to", input.onlyAssignedTo);
    const { data, error: companiesErr } = await q;
    if (companiesErr) return { ok: false, error: friendlyDbError(companiesErr.message, "Firmy se nepodařilo načíst.") };
    for (const c of (data || []) as ColdcallCompany[]) {
      if (!c.email?.trim()) continue;
      recipients.push({
        email: c.email.trim().toLowerCase(),
        name: c.name,
        companyId: c.id,
        companyName: c.name,
        previousContact: { at: c.last_contacted_at, by: c.last_contacted_by ?? null },
      });
    }
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const me = await currentUserEmail(supabase);

  for (const recip of recipients) {
    if (!recip.email.includes("@")) {
      skipped++;
      continue;
    }

    if (recip.companyId && !input.testTo) {
      const claimed = await claimCompanyContact(
        supabase,
        recip.companyId,
        me,
        !!input.skipRecentlyContacted && !input.retryCampaignId
      );
      if (!claimed) {
        skipped++;
        continue;
      }
    }

    // Při retry přeskoč, pokud mezitím už sent
    if (input.retryCampaignId) {
      const { data: already } = await supabase
        .from("newsletter_sends")
        .select("id")
        .eq("campaign_id", input.retryCampaignId)
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
      prefix: rules.prefix || defaultCodePrefix(input.kind),
    });
    if ("error" in promo) {
      failed++;
      if (recip.companyId && recip.previousContact) await releaseCompanyContact(supabase, recip.companyId, recip.previousContact);
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
            firstName: recip.country === "SK" ? firstName(recip.name) : czechVocativeFirst(recip.name),
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
    }, resendCfg);

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
    } else {
      failed++;
      if (recip.companyId && recip.previousContact) await releaseCompanyContact(supabase, recip.companyId, recip.previousContact);
    }

    // ~8 mailů / s — šetrné k Resend free tieru
    await sleep(120);
  }

  if (campaignId) {
    // Stav celé kampaně (i po opakovaném pokusu) z toho, kolik adres nakonec mail dostalo.
    const { data: rows } = await supabase
      .from("newsletter_sends")
      .select("recipient_email, status")
      .eq("campaign_id", campaignId)
      .limit(10000);
    const totals = summarizeSends((rows || []) as { recipient_email: string; status: string }[]);
    const status = totals.failed === 0 ? (totals.sent > 0 ? "sent" : "failed") : totals.sent > 0 ? "partial" : "failed";
    const patch: Record<string, unknown> = { status };
    if (!input.retryCampaignId) patch.sent_at = new Date().toISOString();
    await supabase.from("newsletter_campaigns").update(patch).eq("id", campaignId);
  }

  revalidateNewsletter();
  return { ok: true, data: { campaignId, sent, failed, skipped } };
}

/** Adresa, které mail aspoň jednou odešel, se nepočítá jako chyba, i když dřívější pokus selhal. */
function summarizeSends(rows: { recipient_email: string; status: string }[]): { sent: number; failed: number } {
  const sentTo = new Set<string>();
  const failedTo = new Set<string>();
  for (const r of rows) {
    const email = (r.recipient_email || "").toLowerCase();
    if (r.status === "sent") sentTo.add(email);
    else if (r.status === "failed") failedTo.add(email);
  }
  let failed = 0;
  for (const e of failedTo) if (!sentTo.has(e)) failed++;
  return { sent: sentTo.size, failed };
}

export async function sendColdcallManual(input: {
  companyId: string;
  subject: string;
  introHtml: string;
  productIds: string[];
  codeRules?: Partial<PromoCodeRules>;
  flipStatusToJedname?: boolean;
  /** Poslat i když firmě někdo psal před méně než CONTACT_COOLDOWN_DAYS dny (admin to potvrdil). */
  force?: boolean;
}): Promise<
  | ActionResult<{ sendId: string }>
  | { ok: false; error: string; recentContact: { at: string; by: string | null } }
> {
  const resendCfg = await loadResendConfig();
  const resendErr = resendConfigError(resendCfg);
  if (resendErr) return { ok: false, error: resendErr };
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

  const me = await currentUserEmail(supabase);
  const previousContact = { at: company.last_contacted_at as string | null, by: (company.last_contacted_by as string | null) ?? null };
  let claimed: boolean;
  try {
    claimed = await claimCompanyContact(supabase, company.id, me, !input.force);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Firmu se nepodařilo zamluvit." };
  }
  if (!claimed) {
    const { data: fresh } = await supabase
      .from("coldcall_companies")
      .select("last_contacted_at, last_contacted_by")
      .eq("id", company.id)
      .maybeSingle();
    return {
      ok: false,
      error: "Téhle firmě už někdo nedávno psal.",
      recentContact: { at: fresh?.last_contacted_at || new Date().toISOString(), by: fresh?.last_contacted_by ?? null },
    };
  }

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
    prefix: rules.prefix || defaultCodePrefix("coldcall"),
  });
  if ("error" in promo) {
    await releaseCompanyContact(supabase, company.id, previousContact);
    return { ok: false, error: promo.error };
  }

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
  }, resendCfg);

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

  if (!result.ok) {
    await releaseCompanyContact(supabase, company.id, previousContact);
    return { ok: false, error: result.error };
  }
  if (sendErr || !sendRow) return { ok: false, error: sendErr?.message || "Log se neuložil." };

  if (input.flipStatusToJedname && company.status !== "jedname") {
    await supabase
      .from("coldcall_companies")
      .update({ status: "jedname", updated_by: me, updated_at: new Date().toISOString() })
      .eq("id", company.id);
  }

  revalidateNewsletter();
  return { ok: true, data: { sendId: sendRow.id } };
}
