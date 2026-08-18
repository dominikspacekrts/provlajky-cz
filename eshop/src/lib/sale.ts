// LETNÍ AKCE — jediné místo, kde se akce nastavuje.
// `active: false` schová pruh nahoře, nadpis v heru i plaketu u produktu
// a homepage se vrátí k neutrálnímu nadpisu. Po skončení akce stačí přepnout.
//
// `code` vyplň jen tehdy, když se sleva uplatňuje kódem v košíku;
// prázdný řetězec = sleva je už započítaná v cenách v adminu.

export const SALE = {
  active: true,
  percent: 10,
  /** Nadpis na homepage — první řádek. */
  title: "Plážové vlajky",
  /** Do věty v pruhu: „sleva 10 % na …". */
  what: "plážové vlajky",
  until: "30. 9. 2026",
  href: "/plazove-vlajky",
  /** Kategorie, u které se v mřížce ukáže žlutá plaketa. */
  tileId: "plazove-vlajky",
  code: "",
};

export const saleBadge = SALE.active ? `−${SALE.percent} %` : null;
