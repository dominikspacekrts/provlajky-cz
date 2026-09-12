-- Přemapování starých stavů objednávek na novou pipeline.
-- Spustit v Supabase SQL Editoru (stejně jako 2026-09-customer-accounts.sql).
--
-- Nová pipeline: new → processing → invoiced → paid → awaiting_delivery → shipped → completed
-- (+ on-hold, cancelled). Dodavatel = orders.supplier_paid (checkbox, ne stav).

update orders set status = 'new' where status = 'pending';
update orders set status = 'awaiting_delivery' where status = 'paid-awaiting';
update orders set status = 'shipped' where status = 'paid-delivering';

-- processing / completed / on-hold / cancelled / refunded / failed beze změny
-- (refunded/failed zůstanou v DB; v admin selectu se zobrazí jen pokud je objednávka ještě má).
