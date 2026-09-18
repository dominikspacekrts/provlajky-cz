-- Recenze zákazníků. Admin u objednávky tlačítkem „Odeslat hodnocení“ vytvoří
-- pozvánku (řádek se status 'invited' a náhodným tokenem) a pošle zákazníkovi
-- odkaz na eshop /hodnoceni/<token>. Zákazník tam vyplní hvězdičky, text,
-- fotky a souhlas se zveřejněním → status 'submitted'. Na homepage eshopu jdou
-- jen recenze se souhlasem zákazníka, které admin v sekci Recenze zveřejní.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor → Run.

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  -- Odkaz v mailu. Nese jen právo vyplnit jedno hodnocení, proto se ukládá
  -- čitelně — admin tak může pozvánku poslat znovu se stejným odkazem.
  token text unique not null,
  status text not null default 'invited', -- 'invited' | 'submitted'
  invited_at timestamptz not null default now(),
  submitted_at timestamptz,
  rating smallint check (rating between 1 and 5),
  body text,
  author_name text,  -- podpis u recenze (jméno)
  author_role text,  -- firma / akce
  photos jsonb not null default '[]'::jsonb, -- cesty v bucketu review-photos
  cover_photo text,  -- která fotka jde na homepage (null = první)
  allow_publish boolean not null default false, -- souhlas zákazníka
  published boolean not null default false,     -- rozhodnutí adminu
  created_at timestamptz not null default now()
);
create unique index if not exists reviews_order_id_key on reviews(order_id) where order_id is not null;
create index if not exists reviews_published_idx on reviews(published) where published;

alter table reviews enable row level security;

-- Jen admin. Eshop čte i zapisuje přes service klienta na serveru, takže
-- anonymní návštěvník token ani cizí recenze přes API nikdy nevidí.
drop policy if exists "allowed users manage reviews" on reviews;
create policy "allowed users manage reviews" on reviews for all
  using (is_allowed_user()) with check (is_allowed_user());

-- Fotky od zákazníků. Veřejný bucket, aby šly zobrazit na homepage bez
-- podepisování odkazů; cesty obsahují náhodné UUID, takže neuhodnutelné.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
