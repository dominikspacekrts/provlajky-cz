import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EmailPreviewProvider from "@/components/email/EmailPreviewProvider";
import NavLinks from "./nav-links";
import SignOutButton from "./sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — src/proxy.ts already redirects unauthenticated requests,
  // but Server Components should never trust that alone.
  if (!user) redirect("/login");

  return (
    <EmailPreviewProvider>
      <header className="app-header">
        <h1>PROVLAJKY admin</h1>
        <nav className="topnav">
          <NavLinks />
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#cbd5e1" }}>{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main>{children}</main>
    </EmailPreviewProvider>
  );
}
