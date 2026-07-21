-- PROVLAJKY — seed příslušenství a stojanů (z provlajky.cz). Spustit v Supabase SQL Editoru.
-- Sloupec products.config už existuje z migrace 2026-07-stany-migrace.sql.
-- Ceny = prodejní bez DPH (dle webu). Nákupní cena (buyPrice) = 0 → doplní admin.
-- Obrázky = veřejné cesty; soubory jsou v eshop/public/prislusenstvi a admin/public/prislusenstvi.
-- active = true → hned viditelné na eshopu.

insert into products (slug, category, name, subtitle, kind, price, vat_rate, images, active, sort_order, config)
values
  ('drzak-pod-kolo', 'prislusenstvi', 'Držák pod kolo',
   'Uchycení plážové vlajky pod kolo vozu', 'simple', 990, 0.21,
   '["/prislusenstvi/drzak-pod-kolo.jpg"]'::jsonb, true, 0, '{"buyPrice":0}'::jsonb),

  ('drzak-pod-kolo-eco', 'prislusenstvi', 'Držák pod kolo ECO',
   'Úspornější držák pod kolo automobilu', 'simple', 690, 0.21,
   '["/prislusenstvi/drzak-pod-kolo-eco.jpg"]'::jsonb, true, 1, '{"buyPrice":0}'::jsonb),

  ('krizovy-stojan-vak', 'prislusenstvi', 'Křížový stojan s vakem na vodu',
   'Přenosný křížový stojan se zátěžovým vakem na vodu', 'simple', 590, 0.21,
   '["/prislusenstvi/krizovy-stojan-vak.jpg"]'::jsonb, true, 2, '{"buyPrice":0}'::jsonb),

  ('plastova-nadrz', 'prislusenstvi', 'Plastová nádrž',
   'Plnitelná plastová nádrž jako závaží pod vlajku', 'simple', 590, 0.21,
   '["/prislusenstvi/plastova-nadrz.jpg"]'::jsonb, true, 3, '{"buyPrice":0}'::jsonb),

  ('sroubovy-stojan', 'prislusenstvi', 'Šroubový stojan',
   'Zemní vrut pro ukotvení vlajky do měkkého terénu', 'simple', 350, 0.21,
   '["/prislusenstvi/sroubovy-stojan.jpg"]'::jsonb, true, 4, '{"buyPrice":0}'::jsonb),

  ('tezka-zakladna-eco', 'prislusenstvi', 'Těžká základna ECO',
   'Stabilní základna pod vlajku — cena dle hmotnosti', 'options', 0, 0.21,
   '["/prislusenstvi/tezka-zakladna-eco.jpg"]'::jsonb, true, 5,
   '{"options":[{"id":"o1","label":"5 kg","sellPrice":900,"buyPrice":0},{"id":"o2","label":"12 kg","sellPrice":1200,"buyPrice":0}]}'::jsonb),

  ('tezka-zelezna-zakladna', 'prislusenstvi', 'Těžká železná základna',
   'Ocelová základna pod vlajku — cena dle hmotnosti', 'options', 0, 0.21,
   '["/prislusenstvi/tezka-zelezna-zakladna.jpg"]'::jsonb, true, 6,
   '{"options":[{"id":"o1","label":"6 kg","sellPrice":1000,"buyPrice":0},{"id":"o2","label":"15 kg","sellPrice":1590,"buyPrice":0},{"id":"o3","label":"20 kg","sellPrice":1890,"buyPrice":0}]}'::jsonb),

  ('zapich-pro-vlajku', 'prislusenstvi', 'Zápich pro vlajku',
   'Kovový zápich do země pro plážovou vlajku', 'simple', 510, 0.21,
   '["/prislusenstvi/zapich-pro-vlajku.jpg"]'::jsonb, true, 7, '{"buyPrice":0}'::jsonb)
on conflict (slug) do update set
  category = excluded.category,
  name = excluded.name,
  subtitle = excluded.subtitle,
  kind = excluded.kind,
  price = excluded.price,
  images = excluded.images,
  active = excluded.active,
  config = excluded.config,
  updated_at = now();
