-- Vlastní měření návštěv eshopu (admin → Návštěvnost).
-- Eshop zapisuje jen přes service role a jen po souhlasu s analytickými cookies.
-- Neukládá se IP ani klikací identifikátor (gclid, fbclid) — jen zařazený zdroj.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null,
  source text not null,
  country text,
  visitor_id text not null,
  session_id text,
  duration_sec integer not null default 0
);

alter table page_views add column if not exists session_id text;
alter table page_views add column if not exists duration_sec integer not null default 0;

create index if not exists page_views_created_at_idx on page_views (created_at desc);
create index if not exists page_views_source_idx on page_views (source);
create index if not exists page_views_path_idx on page_views (path);

alter table page_views enable row level security;

drop policy if exists "allowed users read page views" on page_views;
create policy "allowed users read page views" on page_views for select
  using (is_allowed_user());
