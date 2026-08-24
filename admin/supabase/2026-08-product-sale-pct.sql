-- Sleva per produkt (nahrazuje jednu natvrdo napsanou akci v eshop/src/lib/sale.ts,
-- která platila jen pro celou kategorii plážových vlajek). 0 = žádná sleva,
-- jinak procento, které se ukáže jako plaketa "−X %" — cena v price/price_by_size
-- se nemění, sleva je jen štítek (stejný vzor, jaký appka používala doteď:
-- viz komentář v eshop/src/lib/sale.ts — cena už slevu odráží, admin ji tam
-- zadává ručně).
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

alter table products add column if not exists sale_pct numeric(5,2) not null default 0;
