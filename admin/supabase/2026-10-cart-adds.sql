-- Vložení do košíku navázané na stejné visitor_id jako page_views.
-- Eshop zapisuje jen přes service role a jen po souhlasu s analytickými cookies.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists cart_adds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id text not null,
  session_id text,
  product_name text not null,
  product_slug text not null default '',
  variant text,
  qty integer not null default 1,
  path text
);

create index if not exists cart_adds_created_at_idx on cart_adds (created_at desc);
create index if not exists cart_adds_visitor_idx on cart_adds (visitor_id);

alter table cart_adds enable row level security;

drop policy if exists "allowed users read cart adds" on cart_adds;
create policy "allowed users read cart adds" on cart_adds for select
  using (is_allowed_user());
