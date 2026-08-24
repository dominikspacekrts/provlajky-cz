-- Galerie hotových produktů zobrazovaná v pravém sloupci konfigurátorů
-- (plážové vlajky, vlajky na zakázku) — fotky nahrává admin v nové sekci
-- "Konfigurace webu". Obrázek se ukládá jako base64 přímo do řádku, stejně
-- jako products.images v tomhle projektu — žádný Storage bucket navíc.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists configurator_gallery (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'plazove-vlajky' | 'vlajky-na-zakazku'
  image text not null,    -- base64 data URL
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists configurator_gallery_category_idx on configurator_gallery(category);

alter table configurator_gallery enable row level security;

-- Eshop (anonymní návštěvníci) galerii jen čte.
drop policy if exists "public can view gallery" on configurator_gallery;
create policy "public can view gallery" on configurator_gallery for select using (true);

-- Admin (3 jmenovaní uživatelé) galerii spravuje — stejný vzor jako ostatní
-- tabulky v schema.sql.
drop policy if exists "allowed users manage gallery" on configurator_gallery;
create policy "allowed users manage gallery" on configurator_gallery for all
  using (is_allowed_user()) with check (is_allowed_user());
