import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmailPreviewProvider from "@/components/email/EmailPreviewProvider";
import BackButton from "./back-button";
import SignOutButton from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // proxy.ts already validated the session server-side (auth.getUser(), a network
  // round-trip to Supabase) for this exact request. Re-reading the local cookie
  // session here costs nothing extra and is safe because the proxy already gates
  // access to every route below.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  return (
    <EmailPreviewProvider>
      <header className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BackButton />
          <Link href="/" className="app-logo">
            PROVLAJKY<span>.CZ</span>
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#cbd5e1" }}>{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main>{children}</main>
    </EmailPreviewProvider>
  );
}
