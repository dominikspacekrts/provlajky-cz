import type { Metadata } from "next";
import Link from "next/link";
import CookieSettingsLink from "@/components/CookieSettingsLink";

export const metadata: Metadata = {
  title: "Zásady ochrany osobních údajů",
  description:
    "Jaké osobní údaje zpracováváme při objednávce, registraci a měření návštěvnosti, jak dlouho je uchováváme a jaká máte práva.",
  alternates: { canonical: "/ochrana-osobnich-udaju" },
};

export default function PrivacyPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose">
        <h1 style={{ fontSize: 30 }}>Zásady ochrany osobních údajů</h1>

        <div style={{ color: "var(--gray)", marginTop: 16, lineHeight: 1.7 }}>
          <p>
            Tyto zásady popisují, jaké osobní údaje zpracováváme při provozu e-shopu provlajky.cz, proč je
            zpracováváme, jak dlouho je uchováváme a jaká máte práva. Postupujeme podle nařízení (EU) 2016/679 (GDPR)
            a zákona č. 110/2019 Sb.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>1. Kdo údaje zpracovává</h2>
          <p>Správcem osobních údajů je:</p>
          <ul>
            <li>Actual Pro s.r.o.</li>
            <li>IČ: 25882201, DIČ: CZ25882201</li>
            <li>Sídlo: nábřeží Míru 1055/82, 737 01 Český Těšín</li>
            <li>
              E-mail: <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>, telefon:{" "}
              <a href="tel:+420605981155">+420 605 981 155</a>
            </li>
          </ul>
          <p>
            Nejmenovali jsme pověřence pro ochranu osobních údajů — ve všech záležitostech ochrany údajů se obracejte
            na výše uvedený e-mail.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>2. Jaké údaje a proč zpracováváme</h2>

          <h3 style={{ fontSize: 16, marginTop: 20 }}>Objednávka</h3>
          <p>
            Jméno a příjmení nebo název firmy, fakturační a dodací adresu, e-mail, telefon a u firemních nákupů IČO
            a DIČ. Dále obsah objednávky včetně grafických podkladů, které nám nahrajete pro potisk.
          </p>
          <ul>
            <li>
              <strong>Právní základ:</strong> plnění smlouvy (čl. 6 odst. 1 písm. b GDPR) a plnění právních povinností
              v oblasti účetnictví a daní (písm. c).
            </li>
            <li>
              <strong>Doba uchování:</strong> po dobu plnění smlouvy, účetní a daňové doklady pak 10 let podle zákona
              o dani z přidané hodnoty. Nahrané grafické podklady uchováváme po dobu záruky, abychom mohli vyřídit
              případnou reklamaci nebo dotisk.
            </li>
          </ul>

          <h3 style={{ fontSize: 16, marginTop: 20 }}>Registrace a slevový kód</h3>
          <p>Při registraci k odběru slevového kódu zpracováváme vaši e-mailovou adresu a údaj o využití kódu.</p>
          <ul>
            <li>
              <strong>Právní základ:</strong> souhlas (čl. 6 odst. 1 písm. a GDPR), který můžete kdykoliv odvolat
              napsáním na náš e-mail.
            </li>
            <li>
              <strong>Doba uchování:</strong> do odvolání souhlasu, nejdéle 3 roky od registrace.
            </li>
          </ul>

          <h3 style={{ fontSize: 16, marginTop: 20 }}>Kontaktní formulář</h3>
          <p>Jméno, e-mail, telefon a text zprávy — jen proto, abychom vám mohli odpovědět.</p>
          <ul>
            <li>
              <strong>Právní základ:</strong> oprávněný zájem na vyřízení poptávky (čl. 6 odst. 1 písm. f GDPR).
            </li>
            <li>
              <strong>Doba uchování:</strong> 1 rok od poslední komunikace.
            </li>
          </ul>

          <h3 style={{ fontSize: 16, marginTop: 20 }}>Měření návštěvnosti a reklama</h3>
          <p>
            Pokud k tomu dáte souhlas v cookie liště, zpracováváme údaje o vašem pohybu na webu (navštívené stránky,
            zobrazené a objednané produkty, zdroj návštěvy) a identifikátory uložené v cookies.
          </p>
          <ul>
            <li>
              <strong>Právní základ:</strong> váš souhlas (čl. 6 odst. 1 písm. a GDPR). Bez souhlasu se analytické ani
              marketingové nástroje nespouštějí.
            </li>
            <li>
              <strong>Doba uchování:</strong> podle nastavení jednotlivých nástrojů, zpravidla do 26 měsíců. Váš
              souhlas ukládáme na 6 měsíců.
            </li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>3. Komu údaje předáváme</h2>
          <p>
            Údaje nepředáváme nikomu k jeho vlastním účelům. Využíváme ale zpracovatele, bez kterých bychom e-shop
            neprovozovali:
          </p>
          <ul>
            <li>poskytovatele hostingu webu a databáze objednávek,</li>
            <li>poskytovatele e-mailové služby, přes kterou odesíláme potvrzení objednávek,</li>
            <li>přepravce, kterému předáme dodací adresu a telefon kvůli doručení,</li>
            <li>účetní kancelář a v odůvodněných případech právní zástupce,</li>
            <li>
              provozovatele analytických a reklamních nástrojů (Google, Meta, Seznam) — pouze v rozsahu vašeho
              souhlasu.
            </li>
          </ul>
          <p>
            Někteří z těchto zpracovatelů mohou údaje zpracovávat mimo Evropskou unii. V takovém případě je předání
            kryté standardními smluvními doložkami schválenými Evropskou komisí.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>4. Cookies</h2>
          <p>Cookies dělíme do tří kategorií:</p>
          <ul>
            <li>
              <strong>Nezbytné</strong> — drží obsah košíku, rozpracovanou objednávku a váš souhlas s cookies. Bez nich
              e-shop nefunguje, proto se ukládají vždy.
            </li>
            <li>
              <strong>Analytické</strong> — anonymní statistiky návštěvnosti, ze kterých zjišťujeme, co na webu
              zlepšit.
            </li>
            <li>
              <strong>Marketingové</strong> — měření účinnosti reklamy a zobrazování relevantnějších nabídek.
            </li>
          </ul>
          <p>
            Analytické a marketingové cookies zapneme jen s vaším souhlasem. Rozhodnutí můžete kdykoliv změnit —{" "}
            <CookieSettingsLink />. Cookies lze také smazat nebo zablokovat přímo v nastavení prohlížeče; u nezbytných
            cookies tím ale přestane fungovat košík a objednávka.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>5. Vaše práva</h2>
          <p>Ve vztahu k vašim osobním údajům máte právo:</p>
          <ul>
            <li>vědět, jaké údaje o vás zpracováváme, a získat jejich kopii,</li>
            <li>nechat nepřesné údaje opravit a nepotřebné vymazat,</li>
            <li>omezit zpracování nebo proti němu vznést námitku,</li>
            <li>získat údaje ve strojově čitelném formátu a předat je jinému správci,</li>
            <li>kdykoliv odvolat udělený souhlas, aniž by to ovlivnilo zpracování před odvoláním.</li>
          </ul>
          <p>
            Uplatnit je můžete na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>. Vyřídíme je nejpozději do
            jednoho měsíce. Pokud budete mít za to, že údaje zpracováváme v rozporu s předpisy, můžete podat stížnost
            u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>6. Zabezpečení a změny zásad</h2>
          <p>
            Přístup k údajům mají jen osoby, které je potřebují k výkonu práce, a je chráněný přihlášením. Přenos dat
            mezi vaším prohlížečem a webem je šifrovaný.
          </p>
          <p>
            Znění zásad můžeme upravit, pokud se změní rozsah zpracování nebo právní předpisy. Aktuální verze je vždy
            na této stránce. Související dokumenty:{" "}
            <Link href="/obchodni-podminky">obchodní podmínky</Link> a{" "}
            <Link href="/reklamacni-rad">reklamační řád</Link>.
          </p>
          <p style={{ marginTop: 20, fontSize: 13 }}>Účinné od 11. 9. 2026.</p>
        </div>
      </div>
    </div>
  );
}
