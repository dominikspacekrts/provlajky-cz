-- Propojení položky objednávky s produktem (a konkrétní volbou u produktů,
-- které mají víc variant/materiálů) + rozdělení zisku položky mezi partnery.
-- Spustit v Supabase Dashboardu: SQL Editor → New query → vložit celý soubor
-- → Run without RLS (nové sloupce na existujících tabulkách RLS nemění).

alter table order_items add column if not exists product_id uuid references products(id) on delete set null;
-- banner_m2: 'pvc' | 'mesh'; custom_flag: FlagMaterial.id — pro dopočet marže
-- podle nákupní ceny materiálu z products.config.
alter table order_items add column if not exists material text;
-- kind = 'variant' (stany, totemy, brány, náhradní díly) → ProductVariant.id.
alter table order_items add column if not exists variant_id text;
-- kind = 'options' (těžké základny apod.) → ProductOption.id.
alter table order_items add column if not exists option_id text;
-- Rozdělení zisku TÉTO položky mezi partnery (rovný díl) — přednastaví se
-- podle products.partner_ids v okamžiku přidání položky, jde přepsat ručně
-- u konkrétní položky v detailu objednávky. Prázdné pole = nerozděleno.
alter table order_items add column if not exists partner_ids text[] not null default '{}';

create index if not exists order_items_product_id_idx on order_items(product_id);

-- Výchozí partneři pro rovný podíl na zisku produktu (nastavuje se ve
-- formuláři produktu). Prázdné pole = zatím nikomu nepřiřazeno.
alter table products add column if not exists partner_ids text[] not null default '{}';
