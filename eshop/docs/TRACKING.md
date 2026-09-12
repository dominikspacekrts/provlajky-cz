# Měření na provlajky.cz — podklad pro GTM

Web **nenačítá žádné tagy napřímo**. Načte se jen Google Tag Manager
`GTM-PH243T36`, všechno ostatní (GA4, Google Ads, Meta, Sklik) se konfiguruje
v něm. Úkolem webu je dodat souhlas, `site_env` a e-commerce data v `dataLayer`.

- Produkce: `https://provlajky.cz`
- Testovací prostředí: `https://dev.provlajky.cz` (neindexované, za basic auth)
- Měna: `CZK`, jazyk `cs`
- **Všechny ceny v `dataLayer` jsou s DPH 21 % a jako číslo** (ne řetězec).
  V databázi i v košíku jsou bez DPH, přepočet dělá web.

---

## 1. Pořadí skriptů v `<head>`

Pořadí je závazné a hlídané kódem (`src/lib/head-scripts.ts`). Nic se mezi ně
nesmí vkládat, jinak přestane platit Consent Mode.

1. **Consent default** — všechno `denied` kromě `functionality_storage`
   a `security_storage`, s `wait_for_update: 500`.
2. **Consent update z cookie** — jen pokud návštěvník už dřív rozhodl.
3. **`site_env`** — `production` nebo `development`.
4. **GTM** — `<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-PH243T36">`.
5. Volitelný marketingový snippet z administrace (Nastavení → Marketing).

`<noscript>` iframe GTM je prvním prvkem hned za otevíracím `<body>`.

Konkrétně:

```js
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  functionality_storage: 'granted',
  security_storage: 'granted',
  wait_for_update: 500
});
// … případný consent update z cookie …
dataLayer.push({ site_env: 'production' });
dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
```

> Pozn.: GTM je vložený statickým `<script async src>` místo oficiálního
> snippetu, který si značku vkládá sám přes JS. Chová se to stejně, jen se tím
> nemění DOM a React nehlásí rozpor při hydrataci.

---

## 2. Souhlas s cookies

Vlastní lišta, žádná CMP třetí strany. Zdroj: `src/lib/consent.ts`,
`src/components/CookieBanner.tsx`.

**Kategorie → signály Consent Mode v2**

| Kategorie v liště | Signály |
|---|---|
| Nezbytné (vždy zapnuté) | `functionality_storage`, `security_storage` |
| Analytické | `analytics_storage` |
| Marketingové | `ad_storage`, `ad_user_data`, `ad_personalization` |

**Uložení souhlasu** — first-party cookie `provlajky_consent`, platnost 183 dní:

```json
{ "version": 1, "analytics": true, "marketing": false }
```

Zvýšení `version` v kódu vynutí nový souhlas u všech návštěvníků.

**Při každé změně** se pošle `gtag('consent','update', …)` a hned za ním:

```js
dataLayer.push({
  event: 'consent_update',
  consent_analytics: true,
  consent_marketing: false
});
```

Hodnoty jsou v `dataLayer` i jako samostatné proměnné kvůli Skliku, který
souhlas potřebuje jako parametr tagu.

Odkaz **„Nastavení cookies"** v patičce lištu znovu otevře.

---

## 3. Filtrování testovacího provozu

Před načtením GTM se pushne:

```js
dataLayer.push({ site_env: 'production' });  // nebo 'development'
```

Hodnota se řídí proměnnou `NEXT_PUBLIC_SITE_ENV` ve Vercelu, ne doménou.

**Doporučení pro GTM:** založit Data Layer Variable `site_env` a do všech
produkčních tagů dát výjimku (blocking trigger) na `site_env equals development`.
Testovací prostředí navíc posílá hlavičku `X-Robots-Tag: noindex, nofollow`
a `robots.txt` s `Disallow: /`.

---

## 4. E-commerce události

Formát GA4. **Před každou událostí se pushne `{ ecommerce: null }`**, aby se
položky nepřenášely mezi událostmi. Vše prochází jediným modulem
`src/lib/analytics.ts` — komponenty na `dataLayer` nesahají přímo.

### Struktura položky

```js
{
  item_id: "plazova-vlajka-m",        // slug produktu, shodný s g:id ve feedu
  item_name: "Plážová vlajka M",
  item_brand: "provlajky.cz",
  item_category: "Plážové vlajky",     // český název kategorie
  item_variant: "300×80 cm | pvc",     // konfigurace, jen když dává smysl
  price: 2035.00,                       // jednotková cena s DPH
  quantity: 2,
  index: 0                              // jen ve výpisech (view_item_list / select_item)
}
```

### Přehled událostí

| Událost | Kdy se spouští | Navíc v `ecommerce` |
|---|---|---|
| `view_item_list` | načtení výpisu kategorie | `item_list_name` |
| `select_item` | klik na produkt ve výpisu | `item_list_name` |
| `view_item` | detail produktu i otevření konfigurátoru | `value` |
| `add_to_cart` | přidání do košíku (všechny konfigurátory) | `value` |
| `remove_from_cart` | odebrání položky z košíku | `value` |
| `view_cart` | stránka `/kosik` | `value` |
| `begin_checkout` | vstup na `/objednavka` | `value` |
| `add_shipping_info` | volba dopravy | `value`, `shipping_tier` |
| `add_payment_info` | volba platby | `value`, `payment_type` |
| `purchase` | děkovací stránka po objednávce | viz níže |
| `generate_lead` | odeslání kontaktního formuláře | — |

`value` je vždy součet `price × quantity` daných položek, tedy **s DPH**.

Pokud zákazník nechá u dopravy nebo platby předvybranou první možnost,
`add_shipping_info` / `add_payment_info` se pošle při odeslání objednávky, aby
v trychtýři nechyběl krok.

### `purchase`

Jediná událost, jejíž data pocházejí **ze serveru** (uložená objednávka), ne
z košíku v prohlížeči. Děkovací stránka si je vyzvedne z `/api/objednavka/[id]`.

```js
dataLayer.push({ ecommerce: null });
dataLayer.push({
  event: "purchase",
  event_id: "purchase_2026000123",   // pro deduplikaci s Meta Conversions API
  user_data: {
    email: "zakaznik@example.cz",
    phone_number: "+420605981155",
    address: { first_name: "Jan", last_name: "Novák", city: "Praha", postal_code: "11000", country: "CZ" }
  },
  ecommerce: {
    currency: "CZK",
    transaction_id: "2026000123",    // číslo objednávky
    value: 4070.00,                   // zboží s DPH po slevě, BEZ dopravy
    tax: 706.36,                      // DPH obsažená ve `value`
    shipping: 181.50,                 // doprava + platba s DPH
    coupon: "",                       // použitý slevový kód
    items: [ /* položky */ ]
  }
});
```

**Odešle se právě jednou na objednávku.** Refresh děkovací stránky ho
nezopakuje — hlídá to klíč `purchase_sent_<transaction_id>` v `sessionStorage`.

`user_data` je určené pro Enhanced Conversions. Endpoint tato data vydá jen do
**dvou hodin od založení objednávky**, potom vrací 404.

### `generate_lead`

Nemá `ecommerce`, jen:

```js
dataLayer.push({ event: 'generate_lead', form_name: 'kontaktni-formular', currency: 'CZK' });
```

---

## 5. Jak to otestovat

**V konzoli prohlížeče**

```js
window.dataLayer                                   // celá historie
dataLayer.filter(e => e.event === 'add_to_cart')   // konkrétní událost
```

Pořadí na začátku musí být: `consent default` → (`consent update`) → `site_env`
→ `gtm.js`.

**Consent**

1. Otevřít web v anonymním okně → lišta se zobrazí.
2. V Tag Assistantu zkontrolovat, že `ad_storage` i `analytics_storage` jsou
   `denied`.
3. Kliknout „Přijmout vše" → přijde `consent_update` a oba signály jsou `granted`.
4. Reload → souhlas se obnoví z cookie ještě před načtením GTM, lišta se
   nezobrazí.

**Trychtýř**

Kategorie → produkt → konfigurátor → košík → objednávka → děkovací stránka.
U každého kroku ověřit, že čísla jsou `number` a odpovídají cenám s DPH.

**GTM Preview (Tag Assistant)**

Připojit na `https://dev.provlajky.cz` (potřeba přístupové údaje k basic auth).
Testovací prostředí posílá `site_env: 'development'` — počítejte s tím při
nastavování výjimek u tagů.

---

## 6. Produktové feedy

| Feed | URL | Pro koho |
|---|---|---|
| Google Merchant Center | `/feeds/google.xml` | Google Nákupy, Performance Max |
| Heureka (`SHOP` / `SHOPITEM`) | `/feeds/heureka.xml` | Heureka, Zboží.cz, Mergado |

Obojí se generuje ze stejných dat jako web, cache 1 hodina. Původní
`/feed/products.xml` trvale přesměrovává na `/feeds/google.xml`.

- **`g:id` odpovídá `item_id` v `dataLayer`** — díky tomu jde spárovat
  objednávku s položkou v Nákupech.
- Ceny jsou **s DPH**, stejně jako v `dataLayer`.
- Varianty (velikosti plážových vlajek, provedení stanů) jsou samostatné
  položky se společným `g:item_group_id`. Odkaz u variant stanů míří rovnou
  na předvybrané provedení (`?size=`).
- **Bannery a vlajky na zakázku ve feedu nejsou.** Účtují se za m², takže by
  cena v Nákupech neodpovídala tomu, co zákazník zaplatí — Merchant Center to
  bere jako zavádějící údaj. Pokud by je agentura chtěla inzerovat, je potřeba
  nejdřív určit sadu pevných rozměrů a doplnit předvyplnění konfigurátoru
  z odkazu.
- Zboží „na dotaz" (varianty s nulovou cenou, např. náhradní díly) se do feedu
  nedostane.

Kontrola: `npm run feeds:validate` (proti běžícímu webu; pro produkci
`FEED_BASE=https://provlajky.cz npm run feeds:validate`).

## 7. Kde to v kódu žije

| Co | Soubor |
|---|---|
| Pořadí skriptů v hlavičce | `src/lib/head-scripts.ts` |
| Souhlas, cookie, consent update | `src/lib/consent.ts` |
| Cookie lišta | `src/components/CookieBanner.tsx` |
| Všechny e-commerce události | `src/lib/analytics.ts` |
| `add_to_cart` / `remove_from_cart` | `src/lib/cart.tsx` |
| Data pro `purchase` | `src/app/api/objednavka/[id]/route.ts` |
| Odeslání `purchase` + ochrana proti duplicitě | `src/components/PurchaseTracking.tsx` |
| Oddělení dev/produkce | `src/proxy.ts`, `src/lib/site.ts` |
| Podklad pro oba feedy | `src/lib/feed.ts` |

## 8. Adresní našeptávač (Mapy.com)

Checkout (`/objednavka`) napovídá ulici, město a PSČ přes Mapy Suggest.
Klíč `MAPY_API_KEY` patří jen na server (`.env.local` lokálně, ve Vercelu
Production i Preview). Bez něj objednávka funguje dál — jen bez dropdownu.
