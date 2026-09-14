import type { Metadata } from "next";
import AccountPageClient from "./AccountPageClient";

export const metadata: Metadata = { title: "Můj účet" };

export default function AccountPage() {
  return (
    <div className="container">
      <div className="page-panel is-prose auth-page">
        <h1 style={{ fontSize: 30 }}>Můj účet</h1>
        <AccountPageClient />
      </div>
    </div>
  );
}
