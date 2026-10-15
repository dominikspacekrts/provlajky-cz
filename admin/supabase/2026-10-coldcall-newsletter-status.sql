-- Nový stav coldcall firmy po odeslání newsletteru.
do $$
declare
  conname text;
begin
  select c.conname into conname
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public'
    and t.relname = 'coldcall_companies'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%status%';
  if conname is not null then
    execute format('alter table coldcall_companies drop constraint %I', conname);
  end if;
end $$;

alter table coldcall_companies
  add constraint coldcall_companies_status_check
  check (status in (
    'nova',
    'zavolano',
    'poslat_email',
    'newsletter_odeslan',
    'nemaji_zajem',
    'jedname',
    'zakaznik'
  ));
