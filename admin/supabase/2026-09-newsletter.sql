-- Newsletter sekce adminu: jezdci RTS, coldcall firmy, promo kódy, kampaně, log odeslání.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.
-- Eshop čte/updatuje promo_codes přes service-role (obchází RLS), stejně jako customers.

-- ---------- riders ----------
create table if not exists newsletter_riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  country text not null default 'CZ',
  phone text,
  event_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists newsletter_riders_email_ci_idx
  on newsletter_riders (lower(email));
create index if not exists newsletter_riders_country_idx on newsletter_riders (country);

-- ---------- coldcall ----------
create table if not exists coldcall_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  note text,
  status text not null default 'nova'
    check (status in ('nova','zavolano','poslat_email','nemaji_zajem','jedname','zakaznik')),
  default_discount_type text not null default 'percent'
    check (default_discount_type in ('percent','fixed')),
  default_discount_value numeric(12,2) not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_contacted_at timestamptz
);
create index if not exists coldcall_companies_status_idx on coldcall_companies (status);
create index if not exists coldcall_companies_name_idx on coldcall_companies (lower(name));

-- ---------- campaigns ----------
create table if not exists newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rts','coldcall')),
  subject text not null,
  intro_html text not null default '',
  product_ids uuid[] not null default '{}',
  code_rules jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','sending','sent','partial','failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ---------- promo codes (oddělené od customers) ----------
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null default 'percent'
    check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null,
  one_shot boolean not null default true,
  max_uses int,
  used_count int not null default 0,
  valid_until timestamptz,
  source text not null default 'manual'
    check (source in ('rts','coldcall','manual')),
  rider_id uuid references newsletter_riders(id) on delete set null,
  company_id uuid references coldcall_companies(id) on delete set null,
  campaign_id uuid references newsletter_campaigns(id) on delete set null,
  last_used_order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint promo_codes_max_uses_positive check (max_uses is null or max_uses > 0),
  constraint promo_codes_used_nonneg check (used_count >= 0)
);
create unique index if not exists promo_codes_code_ci_idx on promo_codes (upper(code));
create index if not exists promo_codes_campaign_idx on promo_codes (campaign_id);

-- ---------- sends ----------
create table if not exists newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references newsletter_campaigns(id) on delete set null,
  kind text not null default 'campaign'
    check (kind in ('campaign','coldcall_manual','test')),
  recipient_email text not null,
  recipient_name text,
  rider_id uuid references newsletter_riders(id) on delete set null,
  company_id uuid references coldcall_companies(id) on delete set null,
  promo_code_id uuid references promo_codes(id) on delete set null,
  resend_id text,
  status text not null check (status in ('sent','failed','skipped')),
  error_message text,
  subject text,
  html_body text,
  sent_at timestamptz not null default now()
);
create index if not exists newsletter_sends_campaign_idx on newsletter_sends (campaign_id);
create index if not exists newsletter_sends_email_idx on newsletter_sends (lower(recipient_email));

-- ---------- RLS (admin only; eshop používá service role) ----------
alter table newsletter_riders enable row level security;
alter table coldcall_companies enable row level security;
alter table newsletter_campaigns enable row level security;
alter table promo_codes enable row level security;
alter table newsletter_sends enable row level security;

drop policy if exists "allowed users full access" on newsletter_riders;
create policy "allowed users full access" on newsletter_riders
  for all using (is_allowed_user()) with check (is_allowed_user());

drop policy if exists "allowed users full access" on coldcall_companies;
create policy "allowed users full access" on coldcall_companies
  for all using (is_allowed_user()) with check (is_allowed_user());

drop policy if exists "allowed users full access" on newsletter_campaigns;
create policy "allowed users full access" on newsletter_campaigns
  for all using (is_allowed_user()) with check (is_allowed_user());

drop policy if exists "allowed users full access" on promo_codes;
create policy "allowed users full access" on promo_codes
  for all using (is_allowed_user()) with check (is_allowed_user());

drop policy if exists "allowed users full access" on newsletter_sends;
create policy "allowed users full access" on newsletter_sends
  for all using (is_allowed_user()) with check (is_allowed_user());
