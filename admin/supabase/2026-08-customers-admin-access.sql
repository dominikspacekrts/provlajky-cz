-- Admin (3 jmenovaní uživatelé) potřebuje číst tabulku customers pro novou
-- stránku /uzivatele — dosud měla jen veřejnou insert policy (registrace na
-- eshopu), žádnou select. Stejný vzor jako ostatní tabulky v schema.sql.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

drop policy if exists "allowed users full access" on customers;
create policy "allowed users full access" on customers for all using (is_allowed_user()) with check (is_allowed_user());
