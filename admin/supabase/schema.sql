-- PROVLAJKY admin — fáze 1 schéma.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- allowed_users — 3 jmenovaní uživatelé se stejným plným přístupem.
-- ---------------------------------------------------------------------------
create table if not exists allowed_users (
  email text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- partners — podíly na zisku (Alex, Dominik, ...).
-- ---------------------------------------------------------------------------
create table if not exists partners (
  id text primary key,
  name text not null,
  share numeric(5,2) not null default 0,
  billing jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- settings — singleton řádek, sdílené nastavení appky (náklady, SMTP, šablony).
-- Čte/píše se jen server-side (service role) kvůli SMTP heslu v mail.pass.
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  cost_per_size jsonb not null default '{"S":0,"M":0,"L":0,"XL":0}'::jsonb,
  mail jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  wc_id text,
  order_number text,
  title text,
  status text not null default 'pending',
  currency text not null default 'CZK',
  is_foreign boolean not null default false,
  shipping numeric(12,2) not null default 0,
  ship_vat_rate numeric(5,4) not null default 0.21,
  discount_pct numeric(5,2) not null default 0,
  customer jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dirty boolean not null default false,
  supplier_paid boolean not null default false
);
create index if not exists orders_status_idx on orders(status);
create index if not exists orders_order_number_idx on orders(order_number);
create index if not exists orders_legacy_id_idx on orders(legacy_id);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  order_id uuid not null references orders(id) on delete cascade,
  type text not null default 'flag', -- 'flag' | 'banner'
  shape text,                        -- 'A'..'F', banners: null
  size text,                         -- 'S'|'M'|'L'|'XL', banners: null
  width_cm numeric,
  height_cm numeric,
  qty int not null default 1,
  unit_price numeric(12,2) not null default 0,
  vat_rate numeric(5,4) not null default 0.21,
  wc_line_name text,
  wc_product_id text,
  artwork_images jsonb not null default '[]'::jsonb,
  artwork_files jsonb not null default '[]'::jsonb,
  design jsonb,          -- {bgColor, sleeveColor:'white'|'black', logo{...}, fullArtwork{...}, thumb, flagBounds}
  multi_artwork jsonb    -- banners: designs[] per-piece
);
create index if not exists order_items_order_id_idx on order_items(order_id);

-- ---------------------------------------------------------------------------
-- payouts
-- ---------------------------------------------------------------------------
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  partner_id text not null references partners(id),
  partner_name text,
  amount numeric(12,2) not null,
  date date not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- invoices — 'product' (zákazník) i 'payout' (výplata partnera).
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  kind text not null default 'product', -- 'product' | 'payout'
  number text not null unique,          -- 'YYYYNNNN'
  order_id uuid references orders(id) on delete set null,
  order_number text,
  payout_id uuid references payouts(id) on delete set null,
  issued date not null default current_date,
  tax_date date,
  due date,
  paid boolean not null default false,
  currency text not null default 'CZK',
  is_foreign boolean not null default false,
  customer jsonb,
  shipping_customer jsonb,
  items jsonb not null default '[]'::jsonb,
  discount_pct numeric(5,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  ship_vat_rate numeric(5,4) not null default 0.21,
  totals jsonb,
  supplier jsonb,
  payout_customer jsonb,
  subject text,
  amount numeric(12,2),
  created_at timestamptz not null default now()
);
create index if not exists invoices_order_id_idx on invoices(order_id);
create index if not exists invoices_number_idx on invoices(number);

-- ---------------------------------------------------------------------------
-- supplier_invoices — náklady od dodavatele (EUR → CZK dle ČNB kurzu).
-- ---------------------------------------------------------------------------
create table if not exists supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  order_id uuid references orders(id) on delete set null,
  supplier text,
  invoice_num text,
  date date,
  amount numeric(12,2),        -- EUR
  amount_czk numeric(12,2),
  exchange_rate numeric(10,4),
  filename text,
  file_data text,              -- optional receipt/invoice image or PDF as a data URL
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- email_history — NOVÁ tabulka: log každého odeslaného mailu.
-- ---------------------------------------------------------------------------
create table if not exists email_history (
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(),
  sent_by text not null references allowed_users(email),
  kind text not null default 'other', -- 'invoice' | 'visual' | 'accountant' | 'supplier' | 'other'
  order_id uuid references orders(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  to_addr text not null,
  cc jsonb not null default '[]'::jsonb,
  bcc jsonb not null default '[]'::jsonb,
  subject text not null,
  html_body text not null,
  attachments_meta jsonb not null default '[]'::jsonb, -- [{filename,contentType,sizeBytes}]
  status text not null default 'sent', -- 'sent' | 'failed'
  error_message text
);
create index if not exists email_history_order_id_idx on email_history(order_id);
create index if not exists email_history_sent_at_idx on email_history(sent_at desc);
create index if not exists email_history_kind_idx on email_history(kind);

-- ---------------------------------------------------------------------------
-- products — katalog pro nový eshop (dev.provlajky.cz). Spravuje se z adminu
-- (dlaždice Produkty), veřejně čitelné jsou jen řádky s active = true.
-- ---------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category text not null, -- 'plazove-vlajky' | 'vlajky-na-zakazku' | 'pvc-bannery' | 'prislusenstvi'
  name text not null,
  subtitle text,
  description text,
  kind text not null default 'simple', -- 'simple' (pevná cena) | 'configurable' (tvar/velikost jako u vlajek)
  price numeric(12,2) not null default 0,            -- 'simple': pevná cena bez DPH
  price_by_size jsonb not null default '{}'::jsonb,  -- 'configurable': {"S":.., "M":.., "L":.., "XL":..}
  vat_rate numeric(5,4) not null default 0.21,
  images jsonb not null default '[]'::jsonb,         -- pole data-URL (stejná konvence jako supplier_invoices.file_data)
  active boolean not null default false,             -- "připnuto" = viditelné na eshopu
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on products(category);
create index if not exists products_active_idx on products(active);

-- ---------------------------------------------------------------------------
-- RLS: "3 jmenovaní uživatelé, stejný plný přístup ke všemu".
-- ---------------------------------------------------------------------------
create or replace function is_allowed_user() returns boolean as $$
  select exists (
    select 1 from allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$ language sql stable security definer set search_path = public;

do $$
declare
  t text;
begin
  foreach t in array array[
    'allowed_users','partners','settings','orders','order_items',
    'payouts','invoices','supplier_invoices','email_history','products'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "allowed users full access" on %I', t);
    execute format(
      'create policy "allowed users full access" on %I for all using (is_allowed_user()) with check (is_allowed_user())',
      t
    );
  end loop;
end $$;

-- Eshop (anonymní návštěvníci) smí číst jen aktivní produkty.
drop policy if exists "public can view active products" on products;
create policy "public can view active products" on products for select using (active = true);

-- ---------------------------------------------------------------------------
-- Po spuštění: přidej 3 řádky s e-maily, které smí appku používat, např.:
-- insert into allowed_users (email, display_name) values
--   ('dominik@provlajky.cz', 'Dominik'),
--   ('ucetni@provlajky.cz', 'Účetní'),
--   ('alex@provlajky.cz', 'Alex');
-- Účty samotné se zakládají v Authentication → Users → Invite (musí sedět e-mail).
-- ---------------------------------------------------------------------------
