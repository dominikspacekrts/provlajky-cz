-- Bezpečnostní oprava: "public can register" na customers dovolovala INSERT
-- s libovolnými hodnotami (with check (true)) — kdokoliv se znalostí veřejného
-- anon klíče (je v prohlížeči, veřejný by design) mohl přes Supabase REST API
-- přímo vložit vlastní řádek s discount_pct = 100, used_at = null a
-- discount_code dle svého výběru — vlastní neomezenou slevu bez registrace
-- přes /api/registrace. Appka sama žádný přímý public insert nepotřebuje —
-- registrace vždy jde přes service-role klienta v eshop/src/app/api/registrace
-- (obchází RLS), takže tahle policy byla jen zbytečná díra.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

drop policy if exists "public can register" on customers;
