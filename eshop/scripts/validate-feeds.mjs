// Kontrola produktových feedů: well-formed XML a povinná pole.
//
//   npm run feeds:validate                     # proti localhost:3001
//   FEED_BASE=https://provlajky.cz npm run feeds:validate
//
// Nepoužívá žádný XML parser — feed je generovaný z jednoho místa, takže stačí
// ověřit, že se tagy uzavírají a že u každé položky sedí povinná pole. Kdyby
// tady byl plnohodnotný parser, jen by přibyla závislost na jednu kontrolu.

const BASE = process.env.FEED_BASE || "http://localhost:3001";

const GOOGLE_REQUIRED = ["g:id", "g:title", "g:description", "g:link", "g:image_link", "g:price", "g:availability"];
const HEUREKA_REQUIRED = ["ITEM_ID", "PRODUCTNAME", "DESCRIPTION", "URL", "IMGURL", "PRICE_VAT"];

let failures = 0;

function fail(message) {
  console.error(`  ✗ ${message}`);
  failures += 1;
}

function checkWellFormed(xml, label) {
  const stack = [];
  const tagRe = /<\/?([A-Za-z][\w:.-]*)(?:\s[^>]*?)?(\/?)>/g;
  let match;
  while ((match = tagRe.exec(xml)) !== null) {
    const [full, name, selfClosing] = match;
    if (full.startsWith("<?") || full.startsWith("<!")) continue;
    if (selfClosing === "/") continue;
    if (full.startsWith("</")) {
      const open = stack.pop();
      if (open !== name) {
        fail(`${label}: tag </${name}> neodpovídá otevřenému <${open ?? "—"}>`);
        return false;
      }
    } else {
      stack.push(name);
    }
  }
  if (stack.length > 0) {
    fail(`${label}: neuzavřené tagy: ${stack.join(", ")}`);
    return false;
  }
  return true;
}

function blocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
}

function checkItems(items, required, label, idTag) {
  if (items.length === 0) {
    fail(`${label}: feed neobsahuje žádnou položku`);
    return;
  }
  for (const [index, item] of items.entries()) {
    const id = item.match(new RegExp(`<${idTag}>([^<]*)</${idTag}>`))?.[1] ?? `#${index + 1}`;
    for (const field of required) {
      if (!item.includes(`<${field}>`)) fail(`${label}: položka ${id} nemá ${field}`);
    }
    const price = item.match(/<(?:g:price|PRICE_VAT)>([\d.]+)/)?.[1];
    if (price && Number(price) <= 0) fail(`${label}: položka ${id} má nulovou cenu`);
    const image = item.match(/<(?:g:image_link|IMGURL)>([^<]*)</)?.[1];
    if (image && !image.startsWith("https://") && !image.startsWith("http://")) {
      fail(`${label}: položka ${id} má obrázek bez absolutní adresy (${image})`);
    }
  }
  console.log(`  ${label}: ${items.length} položek`);
}

async function load(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} vrátil ${res.status}`);
  return res.text();
}

const google = await load("/feeds/google.xml");
console.log("Google Merchant Center:");
if (checkWellFormed(google, "google.xml")) {
  checkItems(blocks(google, "item"), GOOGLE_REQUIRED, "google.xml", "g:id");
}

const heureka = await load("/feeds/heureka.xml");
console.log("Heureka:");
if (checkWellFormed(heureka, "heureka.xml")) {
  checkItems(blocks(heureka, "SHOPITEM"), HEUREKA_REQUIRED, "heureka.xml", "ITEM_ID");
}

if (failures > 0) {
  console.error(`\n${failures} chyb.`);
  process.exit(1);
}
console.log("\nOba feedy jsou v pořádku.");
