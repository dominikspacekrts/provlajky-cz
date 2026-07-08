import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="container" style={{ paddingTop: 80, paddingBottom: 100, textAlign: "center" }}>
      <div style={{ fontSize: 56 }}>✅</div>
      <h1 style={{ fontSize: 30, marginTop: 16 }}>Děkujeme za objednávku!</h1>
      <p style={{ color: "var(--gray)", marginTop: 12, maxWidth: 480, marginInline: "auto" }}>
        Vaši poptávku jsme přijali a brzy se vám ozveme s cenovou nabídkou a dalšími pokyny k platbě e-mailem.
      </p>
      <Link href="/" className="btn-yellow" style={{ marginTop: 24, display: "inline-flex" }}>
        Zpět na úvod
      </Link>
    </div>
  );
}
