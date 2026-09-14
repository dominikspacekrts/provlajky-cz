import Link from "next/link";
import { Suspense } from "react";
import PurchaseTracking from "@/components/PurchaseTracking";
import { OrderThanksMark } from "@/components/Icons";

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  return (
    <div className="container">
      <div className="page-panel is-centered thanks-page">
        {id && (
          <Suspense fallback={null}>
            <PurchaseTracking orderId={id} />
          </Suspense>
        )}
        <div className="thanks-mark">
          <OrderThanksMark />
        </div>
        <h1 className="thanks-title">Děkujeme za objednávku!</h1>
        <p className="thanks-body">
          Vaši poptávku jsme přijali a brzy se vám ozveme s cenovou nabídkou a dalšími pokyny k platbě e-mailem.
        </p>
        <Link href="/" className="btn-yellow thanks-cta">
          Zpět na úvod
        </Link>
      </div>
    </div>
  );
}
