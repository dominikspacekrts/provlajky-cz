import type { Metadata } from "next";
import Link from "next/link";
import ReviewForm from "@/components/ReviewForm";
import { loadReviewInvite } from "@/lib/reviews";

export const dynamic = "force-dynamic";

// Osobní odkaz z mailu — nesmí do vyhledávačů ani na produkci.
export const metadata: Metadata = {
  title: "Ohodnoťte objednávku",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await loadReviewInvite(token);

  if (!invite) {
    return (
      <div className="container">
        <div className="page-panel is-centered">
          <h1>Odkaz nefunguje</h1>
          <p className="muted">
            Odkaz na hodnocení je neplatný nebo už byl zrušen. Napište nám prosím na{" "}
            <a href="mailto:info@provlajky.cz">info@provlajky.cz</a>.
          </p>
          <p style={{ marginTop: 28 }}>
            <Link href="/" className="btn-outline">
              Na úvodní stránku
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-panel rv-page">
        <ReviewForm token={token} invite={invite} />
      </div>
    </div>
  );
}
