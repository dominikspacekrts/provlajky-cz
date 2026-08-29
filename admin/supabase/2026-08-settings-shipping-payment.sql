-- Nové sloupce pro nastavení Doprava a platby (Nastavení → Doprava a platby) —
-- seznam způsobů dopravy (id/label/cena) + hranice pro dopravu zdarma, a
-- seznam způsobů platby (id/label/cena). Bez téhle migrace getSettings()
-- prostě vrátí prázdné seznamy (viz DEFAULT_SHIPPING/DEFAULT_PAYMENT v
-- actions/settings.ts).
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

alter table settings add column if not exists shipping jsonb default '{}'::jsonb;
alter table settings add column if not exists payment jsonb default '{}'::jsonb;
