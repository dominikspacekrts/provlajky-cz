-- Registrace zákazníků + sleva za registraci (eshop, dev.provlajky.cz).
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  phone text,
  discount_code text unique not null,
  discount_pct numeric(5,2) not null default 10,
  used_at timestamptz,
  used_order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists customers_discount_code_idx on customers(discount_code);

alter table customers enable row level security;
drop policy if exists "public can register" on customers;
create policy "public can register" on customers for insert with check (true);
-- Žádná veřejná select/update policy — ověření a spotřebování kódu se děje
-- výhradně server-side přes service-role klienta (obchází RLS), nikdy
-- z prohlížeče, takže kódy nejde vytahat ani zkoušet hádáním.
