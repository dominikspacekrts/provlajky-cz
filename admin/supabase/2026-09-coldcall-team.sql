-- Coldcall pro víc lidí najednou:
--  * assigned_to      — kdo firmu řeší (uživatel adminu)
--  * updated_by       — kdo firmu naposledy upravil (spolu s updated_at hlídá přepsání cizí úpravy)
--  * last_contacted_by — kdo firmě naposledy poslal mail (ochrana před dvojím mailem)
--  * realtime         — změny od kolegy se v adminu objeví bez obnovení stránky

alter table coldcall_companies
  add column if not exists assigned_to text references allowed_users(email) on update cascade on delete set null,
  add column if not exists updated_by text,
  add column if not exists last_contacted_by text;

create index if not exists coldcall_companies_assigned_idx on coldcall_companies (assigned_to);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coldcall_companies'
     ) then
    alter publication supabase_realtime add table coldcall_companies;
  end if;
end $$;
