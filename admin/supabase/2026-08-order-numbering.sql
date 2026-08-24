-- Automatické, atomické číslování objednávek — funguje stejně pro ruční
-- objednávky (admin) i objednávky z eshopu (service-role klient), protože
-- číslo se přiděluje triggerem přímo v databázi, ne v aplikačním kódu.
-- Formát: RRRRNNNN (rok + čtyřmístné pořadí v rámci roku), stejný formát,
-- jaký už používají faktury (viz invoices.number, komentář 'YYYYNNNN').
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists order_counters (
  year int primary key,
  next_val int not null default 1
);

-- Seed pro rok 2026: první číslo v pořadí bude 20260002, protože 20260001
-- je už použité jako číslo existující faktury (viz invoices.number) — číslo
-- objednávky se od téhle migrace stává i číslem faktury/variabilním symbolem
-- (viz 2026-08-invoice-number-is-order-number), takže se nesmí srazit.
insert into order_counters (year, next_val) values (2026, 2)
on conflict (year) do nothing;

create or replace function next_order_number() returns text as $$
declare
  y int := extract(year from now())::int;
  v int;
begin
  insert into order_counters (year, next_val) values (y, 1) on conflict (year) do nothing;
  update order_counters set next_val = next_val + 1 where year = y returning next_val - 1 into v;
  return y::text || lpad(v::text, 4, '0');
end;
$$ language plpgsql;

create or replace function set_order_number() returns trigger as $$
begin
  if new.order_number is null then
    new.order_number := next_order_number();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_order_number on orders;
create trigger trg_set_order_number before insert on orders
for each row execute function set_order_number();

-- Zpětné doplnění existujících objednávek bez čísla (podle data vzniku, ať
-- jsou čísla popořadě jako datum objednávky).
do $$
declare
  r record;
begin
  for r in select id from orders where order_number is null order by created_at asc loop
    update orders set order_number = next_order_number() where id = r.id;
  end loop;
end $$;
