export default function ContactPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose">
        <h1 style={{ fontSize: 30 }}>Kontaktujte nás</h1>
        <p style={{ color: "var(--gray)", marginTop: 16, lineHeight: 1.7 }}>
          Máte dotaz k produktu, rozměru nebo termínu dodání? Ozvěte se nám telefonicky nebo e-mailem — odpovídáme
          v pracovní dny.
        </p>
        <p style={{ marginTop: 24, lineHeight: 1.9 }}>
          <a href="tel:+420605981155">+420 605 981 155</a>
          <br />
          <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>
        </p>
        <p style={{ color: "var(--gray)", marginTop: 24, lineHeight: 1.7 }}>
          ACTUAL PRO S.R.O.
          <br />
          nábřeží Míru 1055/82
          <br />
          737 01 Český Těšín
          <br />
          IČO 25882201 · DIČ CZ25882201
        </p>
      </div>
    </div>
  );
}
