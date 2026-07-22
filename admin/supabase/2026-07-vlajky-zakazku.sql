-- PROVLAJKY — migrace: Vlajky na zakázku (kind custom_flag) + aktivace PVC banneru.
-- Spustit v Supabase SQL Editoru. Ceny za m² bez DPH (dle původního webu):
--   polyglans 220, polyglans B1 300, satén B1 290. Nákupní ceny doplní admin.

insert into products (slug, category, name, subtitle, description, kind, vat_rate, active, sort_order, config)
values
  (
    'vlajky-na-zakazku',
    'vlajky-na-zakazku',
    'Vlajky na zakázku',
    'Státní vlajky i vlastní grafika · různé materiály · cena za m²',
    'Vlajky na zakázku s plnobarevným potiskem. Vyberte státní vlajku (načte se grafika dané země) nebo nahrajte vlastní design, zvolte materiál, rozměr, typ a umístění oček. Cena se počítá podle plochy a materiálu.',
    'custom_flag',
    0.21,
    true,
    0,
    '{"customFlag":{"materials":[{"id":"m1","label":"polyglans","sellPerM2":220,"buyPerM2":0},{"id":"m2","label":"polyglans B1","sellPerM2":300,"buyPerM2":0},{"id":"m3","label":"satén B1","sellPerM2":290,"buyPerM2":0}],"eyeletSurchargePct":20,"maxDimState":300,"maxDimCustom":200}}'::jsonb
  )
on conflict (slug) do update set
  category = excluded.category,
  name = excluded.name,
  subtitle = excluded.subtitle,
  description = excluded.description,
  kind = excluded.kind,
  config = excluded.config,
  active = true,
  updated_at = now();

-- PVC banner „rovnou načíst" — zpřístupnit produkt (ceny za m² nastav v adminu, pokud ještě nejsou).
update products set active = true, updated_at = now() where slug = 'pvc-banner-na-miru';
