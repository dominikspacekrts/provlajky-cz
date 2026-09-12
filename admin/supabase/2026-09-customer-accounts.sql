-- Zákaznické účty: heslo, fakturační údaje, dodací adresy, tokeny na nastavení hesla.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → Run.

alter table customers
  add column if not exists password_hash text,
  add column if not exists billing jsonb,
  add column if not exists password_updated_at timestamptz;

create table if not exists customer_shipping_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label text,
  company text,
  name text,
  street text not null,
  psc text not null,
  city text not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_shipping_addresses_customer_idx
  on customer_shipping_addresses(customer_id);

alter table customer_shipping_addresses enable row level security;
-- Žádná veřejná policy — čtení/zápis jen přes service-role (API eshopu).

create table if not exists customer_password_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  token_hash text not null unique,
  kind text not null check (kind in ('set_password', 'reset_password')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customer_password_tokens_customer_idx
  on customer_password_tokens(customer_id);

alter table customer_password_tokens enable row level security;

-- Admin (allowed_users) potřebuje číst/spravovat nové tabulky stejně jako customers.
drop policy if exists "allowed users full access" on customer_shipping_addresses;
create policy "allowed users full access" on customer_shipping_addresses
  for all using (is_allowed_user()) with check (is_allowed_user());

drop policy if exists "allowed users full access" on customer_password_tokens;
create policy "allowed users full access" on customer_password_tokens
  for all using (is_allowed_user()) with check (is_allowed_user());
