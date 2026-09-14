import type { Metadata } from "next";
import OrderDetailClient from "./OrderDetailClient";

export const metadata: Metadata = { title: "Detail objednávky" };

export default function AccountOrderPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <OrderDetailClient />
      </div>
    </div>
  );
}
