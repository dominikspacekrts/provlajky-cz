import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose">
        <h1 style={{ fontSize: 30 }}>Obchodní podmínky</h1>

        <div style={{ color: "var(--gray)", marginTop: 16, lineHeight: 1.7 }}>
          <p>
            <strong>Provozovatel e-shopu:</strong>
          </p>
          <ul>
            <li>Obchodní firma: Actual Pro s.r.o.</li>
            <li>IČ: 25882201</li>
            <li>DIČ: CZ25882201</li>
            <li>Sídlo: nábřeží Míru 1055/82, Český Těšín</li>
            <li>Zapsaná v obchodním rejstříku vedeném u Krajského soudu v Ostravě, oddíl C, vložka 12345</li>
            <li>
              E-mail: <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>
            </li>
            <li>
              Telefon: <a href="tel:+420605981155">+420 605 981 155</a>
            </li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>1. Úvodní ustanovení</h2>
          <p>
            Tyto obchodní podmínky upravují vzájemná práva a povinnosti mezi společností Actual Pro s.r.o. (dále jen
            „prodávající“) a kupujícím (zákazníkem) při prodeji zboží vyrobeného na zakázku prostřednictvím
            internetového obchodu provlajky.cz.
          </p>
          <p>Kupující souhlasí s těmito obchodními podmínkami uzavřením kupní smlouvy, tj. dokončením objednávky v e-shopu.</p>
          <p>
            <strong>Upozornění:</strong> Všechny produkty jsou vyráběny <strong>na zakázku</strong> dle specifikací
            kupujícího. Z tohoto důvodu není možné odstoupit od smlouvy bez udání důvodu.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>2. Objednávka a uzavření smlouvy</h2>
          <p>
            Kupní smlouva mezi prodávajícím a kupujícím vzniká okamžikem odeslání objednávky kupujícím a jejím
            potvrzením prodávajícím. Potvrzení objednávky probíhá e-mailem zaslaným na adresu uvedenou kupujícím.
            Vzhledem k zakázkové výrobě je kupující povinen uhradit kupní cenu předem, a to bez možnosti odstoupení od
            smlouvy bez udání důvodu.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>3. Cena zboží a platební podmínky</h2>
          <p>Vzhledem k zakázkovému charakteru zboží je platba možná pouze předem. Kupující může zvolit následující způsoby platby:</p>
          <ul>
            <li>Bankovním převodem.</li>
            <li>Platební kartou přes zabezpečenou platební bránu.</li>
          </ul>
          <p>
            Kupní cena je splatná ihned po potvrzení objednávky. Objednávka bude zpracována až po připsání částky na
            účet prodávajícího.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>4. Dodací podmínky</h2>
          <ul>
            <li>Prodávající doručuje zboží prostřednictvím smluvních přepravců na území České republiky.</li>
            <li>Cena za doručení je stanovena dle hmotnosti a rozměrů zásilky a je uvedena při objednání.</li>
            <li>
              Zákazník si u vybraných produktů může zvolit expresní doručení (do 14 dní) nebo economy doručení (do 2
              měsíců); lhůta dodání běží od přijetí platby na účet prodávajícího. U ostatního zboží platí standardní
              doba dodání 10–15 pracovních dnů po přijetí platby. Tento časový rámec může být delší vzhledem k povaze
              zakázkové výroby — o případném prodloužení doby dodání bude kupující informován.
            </li>
          </ul>
          <p>
            Kupující je povinen zboží při dodání převzít. Pokud kupující nepřevezme zboží, prodávající si vyhrazuje
            právo požadovat náklady spojené s opětovným doručením.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>5. Reklamace a záruka</h2>
          <p>
            Zboží vyráběné na zakázku má standardní záruku 24 měsíců na vady materiálu a zpracování. Reklamaci lze
            uplatnit prostřednictvím e-mailu na adrese <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> nebo
            písemně na adresu sídla prodávajícího.
          </p>
          <p>Postup reklamace:</p>
          <ul>
            <li>Kupující zašle reklamované zboží na vlastní náklady na adresu sídla prodávajícího.</li>
            <li>Prodávající posoudí reklamaci do 30 dnů od obdržení.</li>
            <li>
              V případě oprávněné reklamace má kupující nárok na opravu, výměnu zboží nebo přiměřenou slevu.
              Prodávající se zavazuje proplatit kupujícímu náklady spojené s odesláním reklamovaného zboží, pokud je
              reklamace oprávněná.
            </li>
            <li>Pokud je reklamace neoprávněná, nese kupující náklady na zpětné doručení zboží.</li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>6. Vrácení zboží</h2>
          <p>
            Vzhledem k tomu, že se jedná o zakázkovou výrobu, na základě § 1837 občanského zákoníku nemá kupující
            právo odstoupit od kupní smlouvy bez udání důvodu. Zboží lze vrátit pouze v případě, že je vadné nebo
            došlo k dodání nesprávného zboží.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>7. Práva a povinnosti prodávajícího a kupujícího</h2>
          <ul>
            <li>Prodávající se zavazuje dodat zboží v souladu s objednávkou a zajistit jeho odpovídající kvalitu.</li>
            <li>Kupující se zavazuje poskytnout správné a úplné údaje při objednávání a uhradit kupní cenu předem.</li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>8. Ochrana osobních údajů</h2>
          <p>
            Prodávající zpracovává osobní údaje kupujícího v souladu s platnými právními předpisy, zejména GDPR.
            Podrobnosti o zpracování osobních údajů jsou uvedeny v{" "}
            <Link href="/ochrana-osobnich-udaju">Zásadách ochrany osobních údajů</Link>.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>9. Řešení sporů</h2>
          <p>
            V případě sporu může kupující využít mimosoudní řešení sporů prostřednictvím České obchodní inspekce
            nebo platformy ODR na adrese{" "}
            <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>10. Závěrečná ustanovení</h2>
          <p>
            Tyto obchodní podmínky jsou platné od 29. 8. 2026 a vztahují se na všechny kupní smlouvy uzavřené
            prostřednictvím e-shopu provlajky.cz. Prodávající si vyhrazuje právo obchodní podmínky kdykoliv změnit.
            Změny jsou účinné zveřejněním na webových stránkách.
          </p>
        </div>
      </div>
    </div>
  );
}
