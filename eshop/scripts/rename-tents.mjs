// Jednorázové přejmenování produktů řady stanů v Supabase: nůžkové → HEX,
// nafukovací → AIR (slugy se nemění, jen name a subtitle).
//
//   node scripts/rename-tents.mjs           — vypíše, co by se změnilo
//   node scripts/rename-tents.mjs --apply   — zapíše změny do databáze
//
// Původní názvy se před zápisem uloží do .tent-names-backup.json o adresář
// výš (mimo repo), takže se dá vrátit zpět.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const HEX_SUB = "Prémiový skládací pop-up stan · hliníková hexagonová konstrukce HEX · plnobarevný potisk";

function rename(p) {
  // Kód řady se přidává jen jednou; opakovaný běh nesmí vyrobit "HEX HEX".
  if (/\b(HEX|AIR)\b/.test(p.name)) return null;
  if (p.category === "nuzkove-stany") {
    return { name: p.name.replace(/^Nůžkový stan /, "Nůžkový stan HEX "), subtitle: HEX_SUB };
  }
  if (p.category === "nafukovaci-stany") {
    return { name: p.name.replace(/^Nafukovací stan \(tetrahedron\) /, "Nafukovací stan AIR "), subtitle: p.subtitle };
  }
  if (p.category === "nahradni-dily") {
    if (/^Náhradní díly ke stanu /.test(p.name))
      return { name: p.name.replace(/^Náhradní díly ke stanu /, "Náhradní díly ke stanu HEX "), subtitle: p.subtitle };
    if (p.name === "Náhradní díly k nůžkovým stanům")
      return { name: "Náhradní díly ke stanům HEX", subtitle: p.subtitle };
  }
  return null;
}

const { data, error } = await db.from("products")
  .select("id, slug, category, name, subtitle")
  .in("category", ["nuzkove-stany", "nafukovaci-stany", "nahradni-dily"]).order("category").order("sort_order");
if (error) { console.error(error); process.exit(1); }

// Zálohu píšeme jen poprvé — druhý běh by do ní uložil už přejmenované
// názvy a nebylo by z čeho vrátit se zpět.
const BACKUP = "../.tent-names-backup.json";
if (!fs.existsSync(BACKUP)) {
  fs.writeFileSync(BACKUP, JSON.stringify(data, null, 2));
  console.log("záloha původních názvů:", BACKUP);
} else {
  console.log("záloha už existuje, nechávám ji být:", BACKUP);
}

let n = 0;
for (const p of data) {
  const next = rename(p);
  if (!next || (next.name === p.name && next.subtitle === p.subtitle)) { console.log("— beze změny:", p.name); continue; }
  console.log(`${APPLY ? "ZAPSÁNO" : "návrh"}: ${JSON.stringify(p.name)} → ${JSON.stringify(next.name)}`);
  if (next.subtitle !== p.subtitle) console.log(`          podtitul → ${JSON.stringify(next.subtitle)}`);
  if (APPLY) {
    const { error: e } = await db.from("products").update({ name: next.name, subtitle: next.subtitle }).eq("id", p.id);
    if (e) { console.error("CHYBA u", p.slug, e.message); process.exit(1); }
  }
  n++;
}
console.log(APPLY ? `hotovo, přepsáno ${n} produktů` : `návrh: ${n} produktů ke změně (záloha původních názvů uložena)`);
