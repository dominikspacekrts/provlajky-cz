-- Nový sloupec pro nastavení Marketing (Nastavení → Marketing) — libovolný
-- HTML/JS kód (konverzní kódy Google Ads / Meta Pixel / GA4 od marketingové
-- agentury), který se vkládá do <head> eshopu. Bez téhle migrace getSettings()
-- prostě vrátí prázdnou hodnotu (viz DEFAULT_MARKETING v actions/settings.ts).
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

alter table settings add column if not exists marketing jsonb default '{}'::jsonb;
