import type { Metadata } from "next";
import Link from "next/link";
import { getCheckoutSettings } from "@/lib/checkoutSettings";
import { STANDARD_VAT_RATE, fmtMoney, withVat } from "@/lib/money";

export const metadata: Metadata = {
  title: "Doprava a platba",
  description:
    "Způsoby dopravy a platby v e-shopu provlajky.cz, dodací lhůty u zakázkové výroby a podmínky dopravy zdarma.",
  alternates: { canonical: "/doprava-a-platba" },
};

// Ceny se čtou z nastavení v adminu (Nastavení → Doprava a platby), ať se
// stránka nerozejde s tím, co zákazník vidí v objednávce.
export const dynamic = "force-dynamic";

export default async function ShippingPaymentPage() {
  const { shippingMethods, paymentMethods, shippingFreeOverAmount } = await getCheckoutSettings();

  return (
    <div className="container">
      <div className="page-panel is-prose">
        <h1 style={{ fontSize: 30 }}>Doprava a platba</h1>

        <div style={{ color: "var(--gray)", marginTop: 16, lineHeight: 1.7 }}>
          <h2 style={{ fontSize: 20, marginTop: 28 }}>Dodací lhůty</h2>
          <p>
            Veškeré zboží vyrábíme na zakázku, takže dodací lhůta začíná běžet až od schválení vizualizace a připsání
            platby. U vybraných produktů si v konfigurátoru volíte rychlost dodání:
          </p>
          <ul>
            <li>
              <strong>Expresní doručení</strong> — do 14 dnů, zboží putuje letecky.
            </li>
            <li>
              <strong>Economy doručení</strong> — do 2 měsíců, zboží putuje vlakem. Levnější varianta, pokud máte čas.
            </li>
          </ul>
          <p>
            U menších produktů skladem a příslušenství expedujeme zpravidla do několika pracovních dnů. Konkrétní
            termín vždy potvrdíme e-mailem spolu s vizualizací.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>Způsoby dopravy</h2>
          {shippingMethods.length > 0 ? (
            <table className="info-table">
              <thead>
                <tr>
                  <th>Způsob dopravy</th>
                  <th>Cena bez DPH</th>
                </tr>
              </thead>
              <tbody>
                {shippingMethods.map((method) => (
                  <tr key={method.id}>
                    <td>{method.label}</td>
                    <td>
                      {method.price > 0 ? (
                        <>
                          {fmtMoney(method.price)}
                          <span className="vat" style={{ display: "block", marginTop: 2 }}>
                            {fmtMoney(withVat(method.price, STANDARD_VAT_RATE))} s DPH
                          </span>
                        </>
                      ) : (
                        "Zdarma"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              Cenu dopravy počítáme podle rozměru a váhy zásilky — u vlajek a banneru je jiná než u stanu na paletě.
              Konkrétní částku uvidíte při dokončování objednávky ještě před jejím odesláním, případně vám ji rádi
              spočítáme předem na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>.
            </p>
          )}

          {shippingFreeOverAmount > 0 && (
            <p>
              <strong>Doprava zdarma</strong> při objednávce nad {fmtMoney(shippingFreeOverAmount)} bez DPH.
            </p>
          )}

          <p>Doručujeme po celé České republice. O dodání na Slovensko nebo jinam v EU se nám ozvěte, domluvíme se.</p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>Způsoby platby</h2>
          {paymentMethods.length > 0 ? (
            <table className="info-table">
              <thead>
                <tr>
                  <th>Způsob platby</th>
                  <th>Poplatek bez DPH</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((method) => (
                  <tr key={method.id}>
                    <td>{method.label}</td>
                    <td>
                      {method.price > 0 ? (
                        <>
                          {fmtMoney(method.price)}
                          <span className="vat" style={{ display: "block", marginTop: 2 }}>
                            {fmtMoney(withVat(method.price, STANDARD_VAT_RATE))} s DPH
                          </span>
                        </>
                      ) : (
                        "Bez poplatku"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          <p>
            Protože jde o zakázkovou výrobu, <strong>platí se předem na základě zálohové faktury</strong>, kterou vám
            pošleme e-mailem po potvrzení objednávky. Výrobu spouštíme po připsání platby a schválení vizualizace.
          </p>
          <p>
            Nakupujete-li na firmu, uveďte v objednávce IČO a DIČ — daňový doklad vystavíme na firmu a pošleme
            e-mailem.
          </p>

          <h2 style={{ fontSize: 20, marginTop: 28 }}>Převzetí zásilky</h2>
          <p>
            Zásilku si při převzetí prohlédněte. Je-li obal viditelně poškozený, sepište s dopravcem zápis o škodě —
            usnadní to vyřízení případné reklamace. Poškození zjištěné po rozbalení nám nahlaste co nejdřív, viz{" "}
            <Link href="/reklamacni-rad">reklamační řád</Link>.
          </p>

          <p style={{ marginTop: 24 }}>
            Podrobnosti najdete v <Link href="/obchodni-podminky">obchodních podmínkách</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
