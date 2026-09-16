-- Automatické maily z eshopu (potvrzení objednávky, slevový kód, obnova hesla)
-- neodesílá nikdo z týmu — odesílá je systém. Sloupec sent_by měl ale
-- "not null references allowed_users(email)" a eshop do něj dával SMTP login,
-- který v allowed_users typicky není. Insert kvůli tomu tiše spadl na cizí klíč
-- a mail se v Historii mailů vůbec neobjevil — ani úspěch, ani chyba.
--
-- Řešení: sent_by smí být null = "odeslal automat". Cizí klíč zůstává, takže
-- u mailů odeslaných ručně z adminu integrita platí dál (null FK neporušuje).
alter table email_history alter column sent_by drop not null;
