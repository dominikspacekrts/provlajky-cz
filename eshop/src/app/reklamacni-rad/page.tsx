import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reklamační řád",
  description:
    "Jak reklamovat vadné zboží vyrobené na zakázku, v jaké lhůtě, co k reklamaci doložit a jak ji vyřizujeme.",
  alternates: { canonical: "/reklamacni-rad" },
};

export default function ComplaintsPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose">
        <h1 style={{ fontSize: 30 }}>Reklamační řád</h1>

        <div style={{ color: "var(--gray)", marginTop: 16, lineHeight: 1.7 }}>
          <p>
            Reklamační řád upravuje postup při uplatnění práv z vadného plnění u zboží zakoupeného v e-shopu
            provlajky.cz. Prodávajícím je Actual Pro s.r.o., IČ 25882201, se sídlem nábřeží Míru 1055/82, 737 01 Český
            Těšín. Řídíme se občanským zákoníkem (zákon č. 89/2012 Sb.) a u spotřebitelů také zákonem o ochraně
            spotřebitele (zákon č. 634/1992 Sb.).
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>1. Zakázková výroba a vrácení zboží</h2>
          <p>
            Veškeré zboží vyrábíme na zakázku podle zadání kupujícího — rozměru, materiálu a dodané grafiky. U
            takového zboží nelze podle <strong>§ 1837 písm. d) občanského zákoníku</strong> odstoupit od smlouvy ve
            čtrnáctidenní lhůtě a vrátit ho bez udání důvodu.
          </p>
          <p>
            <strong>Práva z vadného plnění tím nejsou nijak dotčená.</strong> Pokud je zboží vadné, poškozené nebo
            neodpovídá objednávce, reklamaci uplatnit lze — postup popisují následující body.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>2. Lhůta pro uplatnění</h2>
          <p>
            Spotřebitel může vadu vytknout do <strong>dvou let</strong> od převzetí zboží. Projeví-li se vada do
            jednoho roku od převzetí, má se za to, že zboží bylo vadné již při převzetí.
          </p>
          <p>
            U kupujícího, který není spotřebitel (nákup na IČO), činí lhůta pro vytknutí vady <strong>12 měsíců</strong>{" "}
            od převzetí zboží.
          </p>
          <p>
            Zjevné vady — poškozený obal, chybějící kus, viditelně poškozený potisk — doporučujeme uplatnit co
            nejdříve po převzetí, ideálně do tří pracovních dnů. Usnadní to prokázání, že vada nevznikla až užíváním.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>3. Co reklamovat nelze</h2>
          <ul>
            <li>opotřebení způsobené běžným užíváním, zejména vyblednutí potisku dlouhodobým působením slunce,</li>
            <li>
              poškození způsobené nevhodným použitím — typicky ponechání vlajky nebo stanu venku za silného větru nad
              doporučenou mez, kterou uvádíme u produktu,
            </li>
            <li>poškození vzniklé neodbornou montáží, úpravou zboží nebo nešetrným skladováním,</li>
            <li>
              vady grafiky vyplývající z podkladů dodaných kupujícím — nízké rozlišení, chybný barevný prostor nebo
              překlep v textu, pokud kupující vizualizaci před výrobou schválil,
            </li>
            <li>
              barevná odchylka potisku v rozsahu obvyklém pro digitální tisk na textil; drobný rozdíl oproti obrazovce
              nebo vzorníku není vadou.
            </li>
          </ul>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>4. Jak reklamaci uplatnit</h2>
          <ol>
            <li>
              Napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> nebo zavolejte na{" "}
              <a href="tel:+420605981155">+420 605 981 155</a>.
            </li>
            <li>
              Uveďte číslo objednávky, popis vady a přiložte fotografie, ze kterých je vada patrná. U potisku pomůže
              i fotografie celého kusu.
            </li>
            <li>Domluvíme se na dalším postupu — u části vad stačí fotodokumentace, jinak vás vyzveme k zaslání zboží.</li>
            <li>
              Zboží zašlete na adresu sídla společnosti. <strong>Nezasílejte zboží na dobírku</strong>, takovou zásilku
              nemůžeme převzít.
            </li>
          </ol>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>5. Vyřízení reklamace</h2>
          <p>
            O přijetí reklamace vydáme potvrzení s datem uplatnění a popisem vady. Reklamaci vyřídíme{" "}
            <strong>do 30 dnů</strong> ode dne uplatnění, pokud se nedohodneme na delší lhůtě. O vyřízení vás
            informujeme e-mailem.
          </p>
          <p>Je-li reklamace oprávněná, můžete požadovat:</p>
          <ul>
            <li>odstranění vady dodáním nového kusu nebo opravou — volbu provedeme podle toho, co je přiměřenější,</li>
            <li>
              přiměřenou slevu z kupní ceny, případně odstoupení od smlouvy, pokud je vada podstatná, oprava ani výměna
              není možná nebo jsme vadu neodstranili v přiměřené době.
            </li>
          </ul>
          <p>
            U oprávněné reklamace máte nárok na náhradu účelně vynaložených nákladů na uplatnění reklamace, zejména
            poštovného. Nárok uplatněte do jednoho měsíce od vyřízení.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>6. Mimosoudní řešení sporů</h2>
          <p>
            Pokud jste spotřebitel a nesouhlasíte s vyřízením reklamace, máte právo obrátit se na Českou obchodní
            inspekci, Štěpánská 796/44, 110 00 Praha 1 (<a href="https://www.coi.cz">www.coi.cz</a>), která je
            subjektem mimosoudního řešení spotřebitelských sporů.
          </p>

          <p style={{ marginTop: 24 }}>
            Souvisí s tím <Link href="/obchodni-podminky">obchodní podmínky</Link> a{" "}
            <Link href="/doprava-a-platba">doprava a platba</Link>.
          </p>
          <p style={{ marginTop: 20, fontSize: 13 }}>Účinné od 11. 9. 2026.</p>
        </div>
      </div>
    </div>
  );
}
