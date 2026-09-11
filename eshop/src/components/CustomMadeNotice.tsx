import Link from "next/link";

// Zboží se vyrábí na zakázku podle zadání zákazníka, takže podle § 1837 písm. d)
// občanského zákoníku nejde odstoupit od smlouvy do 14 dnů. Zákazník o tom musí
// vědět dřív, než objednávku odešle — proto to visí v košíku i v objednávce,
// ne jen v obchodních podmínkách.
export default function CustomMadeNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`custom-made-notice${compact ? " is-compact" : ""}`}>
      <p>
        <strong>Zboží vyrábíme na zakázku</strong> podle vašeho zadání (rozměr, potisk, materiál). U takového zboží
        nelze podle § 1837 písm. d) občanského zákoníku odstoupit od smlouvy do 14 dnů a vrátit ho bez udání důvodu.
      </p>
      <p>
        Práva z vadného plnění tím nejsou dotčená — vadné nebo poškozené zboží reklamovat lze, viz{" "}
        <Link href="/reklamacni-rad">reklamační řád</Link>.
      </p>
    </div>
  );
}
