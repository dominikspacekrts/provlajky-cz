# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Firmy a pořadatelé akcí objednávající reklamní vlajky, bannery, nafukovací reklamu a nůžkové stany na míru — marketéři, provozovatelé prodejen, pořadatelé eventů a závodních akcí, kteří potřebují viditelnou značku na místě prodeje nebo na akci a chtějí to vyřídit rychle online, často opakovaně.

## Product Purpose

provlajky.cz je eshop s reklamními vlajkami, bannery, nafukovací reklamou a nůžkovými stany na míru (ACTUAL PRO S.R.O.). Zákazník si produkt nakonfiguruje online (tvar, velikost, vlastní grafika/potisk) a firma zajistí dodání. Úspěch = zákazník okamžitě pozná, který produkt potřebuje, nakonfiguruje si ho bez tření a objedná.

## Positioning

Rychlost a jednoduchost celého procesu: online konfigurátor s cenou hned (žádná poptávka a čekání na nabídku), potisk podle vlastní grafiky, a u stanů/nafukovací reklamy fakt, že stavbu zvládne jeden člověk sám.

**POZOR — NETVRDIT VLASTNÍ VÝROBU.** Dřívější verze tohoto dokumentu uváděla „vlastní výroba na míru (ne přeprodej)". Uživatel 15. 8. 2026 výslovně potvrdil, že **to není pravda**, a nechal to ze stránky odstranit. Na webu se nesmí objevit žádné tvrzení o tom, že firma zboží vyrábí, šije nebo kompletuje, ani o jeho původu. Držet se toho, co je nesporné: výběr, potisk na míru, cena předem, dodání.

## Operating Context

- Next.js (App Router) + TypeScript eshop, samostatný Next.js admin panel a Supabase backend sdílený s adminem (objednávky, produkty, sklad).
- Produktové kategorie: plážové vlajky, vlajky na zakázku, PVC bannery/meshe, nafukovací stany/totemy/brány, nůžkové stany, náhradní díly a příslušenství.
- Online konfigurátory pro každou kategorii (tvar, rozměr, barva, vlastní grafika/logo).
- Doručení přes vlastní dopravu (aktuální dodací lhůta u zboží dováženého vlakem: cca 2 měsíce; jinak individuálně dle produktu).
- Firemní údaje v patičce: ACTUAL PRO S.R.O., nábřeží Míru 1055/82, 737 01 Český Těšín, IČO 25882201, DIČ CZ25882201; kontakt +420 605 981 155, info@provlajky.cz.

## Capabilities and Constraints

- Konfigurátory: FlagConfigurator, BannerConfigurator, CustomFlagConfigurator, VariantConfigurator, OptionsConfigurator — každý řeší tvar/rozměr/barvu/potisk a nahrání vlastní grafiky (FlagEditorModal).
- Reálná čísla k dispozici a použitelná na webu: 3500+ vyrobených reklamních vlajek, 10000+ m² vyrobené reklamní plochy, 250+ spokojených zákazníků.
- Žádné jméno konkrétního klienta/reference ani testimonial není v projektu k dispozici — nevymýšlet.
- Vizuální identita (paleta, typografie, tón) je otevřená k reinterpretaci; jediný pevný závazek je čitelnost a rozpoznatelnost existujícího loga (soubory v `public/logo/`).
- Redesign nesmí působit přehnaně luxusně/"fashion" — jde o praktický B2B/event byznys, ale žádné jiné konkrétní omezení nebylo stanoveno (uživatel potvrdil, že jde hlavně o celkovou kvalitu provedení).

## Brand Commitments

- Název: provlajky.cz / PROVLAJKY.CZ, provozovatel ACTUAL PRO S.R.O.
- Existující logo (`public/logo/logo-tmave.png`, `logo-bile.png`, `logo-hero.png`) musí zůstat čitelné a rozpoznatelné v jakékoli nové paletě.

## Evidence on Hand

- Produktové fotky: `public/produkty/` (nafukovací stan, totem, brána, mesh banner, náhradní díly po kategoriích), `public/fotky/` (realizace), `public/stany/real-full.jpg`.
- Vykreslované vizuály v kódu: `FlagWave` (plážová vlajka ve větru), `TentFold` (skládací nůžkový stan animace), banner 3D mockup (`banner-card` + wrinkles/eyelets/cords) v CSS.
- Reálná čísla k použití: 3500+ vlajek, 10000+ m² plochy, 250+ zákazníků (již na webu, ověřená hodnota, ne vymyšlená).
- Žádné klientské logo/reference k dispozici — nefabrikovat.

## Product Principles

1. Zákazník musí do několika sekund poznat, který produkt (vlajka/banner/nafukovací reklama/stan) řeší jeho potřebu — orientace podle produktu, ne podle marketingové nálady.
2. Rychlost a jednoduchost (konfigurátor, rychlé dodání, jednoduchá stavba) je hlavní přesvědčovací argument, ne cena ani luxusní dojem.
3. Nikdy netvrdit vlastní výrobu ani mluvit o původu zboží — není to pravda (potvrzeno uživatelem 15. 8. 2026).
4. Logo musí zůstat čitelné a rozpoznatelné bez ohledu na zvolenou paletu/tón.
5. Žádné fabrikované reference, klientská loga ani čísla nad rámec potvrzených (3500/10000/250).

## Accessibility & Inclusion

Žádný specifický accessibility požadavek nebyl stanoven nad rámec obecného standardu.
