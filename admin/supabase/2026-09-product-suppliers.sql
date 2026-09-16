-- Dodavatel per produkt — stany, nafukovací reklamu a brány vyrábí někdo
-- jiný než plážové vlajky, takže "Odeslat dodavateli" musí umět poslat
-- poptávku na správnou adresu (a u smíšené objednávky zvlášť každému).
--
-- Proč zvlášť tabulka a ne sloupec v products: products má RLS politiku
-- "public can view active products" (schema.sql), takže by si kontakt na
-- našeho dodavatele přečetl kdokoliv přes veřejné API eshopu. Tahle
-- tabulka je vidět jen pro přihlášené adminy (is_allowed_user()).
--
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists product_suppliers (
  product_id uuid primary key references products(id) on delete cascade,
  name text not null default '',   -- jak dodavatele oslovujeme v adminu
  email text not null default '',  -- kam chodí "Odeslat dodavateli"
  updated_at timestamptz not null default now()
);

alter table product_suppliers enable row level security;

drop policy if exists "allowed users manage product suppliers" on product_suppliers;
create policy "allowed users manage product suppliers" on product_suppliers
  for all using (is_allowed_user()) with check (is_allowed_user());
