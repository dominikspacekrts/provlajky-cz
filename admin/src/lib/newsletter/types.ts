/** Typy a konstanty pro newsletter sekci (viz 2026-09-newsletter.sql). */

export type NewsletterCountry = "CZ" | "SK" | "PL" | "HU" | "AT" | "DE" | "EN";

export type NewsletterRider = {
  id: string;
  name: string;
  email: string;
  country: NewsletterCountry;
  phone: string | null;
  event_label: string | null;
  created_at: string;
  updated_at: string;
};

export type ColdcallStatus =
  | "nova"
  | "zavolano"
  | "poslat_email"
  | "nemaji_zajem"
  | "jedname"
  | "zakaznik";

export const COLDCALL_STATUS_LABELS: Record<ColdcallStatus, string> = {
  nova: "Nová",
  zavolano: "Zavoláno",
  poslat_email: "Poslat email",
  nemaji_zajem: "Nemají zájem",
  jedname: "Jednáme",
  zakaznik: "Zákazník",
};

export const COLDCALL_STATUSES = Object.keys(COLDCALL_STATUS_LABELS) as ColdcallStatus[];

export type ColdcallCompany = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: ColdcallStatus;
  default_discount_type: "percent" | "fixed";
  default_discount_value: number;
  created_at: string;
  updated_at: string;
  last_contacted_at: string | null;
  /** Sloupce z 2026-09-coldcall-team.sql — před migrací chybí. */
  assigned_to?: string | null;
  updated_by?: string | null;
  last_contacted_by?: string | null;
};

export type TeamMember = { email: string; display_name: string };

/** Nepoužitý a platný / už uplatněný / propadlý bez použití. */
export type PromoCodeState = "active" | "used" | "expired";

export const PROMO_STATE_LABELS: Record<PromoCodeState, string> = {
  active: "Nepoužité",
  used: "Použité",
  expired: "Propadlé",
};

/** Jeden řádek výpisu kódů — komu patří, kolik dává a jak na tom je. */
export type PromoCodeListRow = {
  id: string;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  oneShot: boolean;
  maxUses: number | null;
  usedCount: number;
  validUntil: string | null;
  createdAt: string;
  source: "rts" | "coldcall" | "manual";
  /** Komu se kód připsal; null u kódu bez příjemce (např. test). */
  recipient: { kind: "company" | "rider"; name: string; email: string | null } | null;
  campaignSubject: string | null;
  orderNumber: string | null;
};

/** Firmě, které někdo psal za posledních N dní, se mail znovu nepošle bez potvrzení. */
export const CONTACT_COOLDOWN_DAYS = 7;

export type PromoDiscountType = "percent" | "fixed";

export type PromoCodeRules = {
  discountType: PromoDiscountType;
  discountValue: number;
  /** true = max 1 použití */
  oneShot: boolean;
  /** Když !oneShot — maximální počet použití (povinné pokud oneShot=false). */
  maxUses: number | null;
  /** Počet dní platnosti od vytvoření; null = bez expirace. */
  validDays: number | null;
  /** Začátek kódu, např. RACE10 → RACE10-7KQ2MX. Chybí = výchozí podle typu kampaně. */
  prefix?: string;
};

export type PromoCode = {
  id: string;
  code: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  one_shot: boolean;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  source: "rts" | "coldcall" | "manual";
  rider_id: string | null;
  company_id: string | null;
  campaign_id: string | null;
  last_used_order_id: string | null;
  created_at: string;
};

export type NewsletterCampaignKind = "rts" | "coldcall";
export type NewsletterCampaignStatus = "draft" | "sending" | "sent" | "partial" | "failed";

export type NewsletterCampaign = {
  id: string;
  kind: NewsletterCampaignKind;
  subject: string;
  intro_html: string;
  product_ids: string[];
  code_rules: PromoCodeRules;
  status: NewsletterCampaignStatus;
  created_at: string;
  sent_at: string | null;
};

export type NewsletterSend = {
  id: string;
  campaign_id: string | null;
  kind: "campaign" | "coldcall_manual" | "test";
  recipient_email: string;
  recipient_name: string | null;
  rider_id: string | null;
  company_id: string | null;
  promo_code_id: string | null;
  resend_id: string | null;
  status: "sent" | "failed" | "skipped";
  error_message: string | null;
  subject: string | null;
  html_body: string | null;
  sent_at: string;
};

export type NewsletterProductCard = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  /** Výchozí / nejnižší prodejní cena bez DPH. */
  fromPrice: number;
  /** Cena je za m² (bannery, mesh, vlajky na zakázku). */
  perM2?: boolean;
  url: string;
};
