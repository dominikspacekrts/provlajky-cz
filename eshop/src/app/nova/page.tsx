import { redirect } from "next/navigation";

// /nova byla pracovní adresa nového designu — ten je od 16. 8. 2026 na `/`.
// Routa zůstává jen kvůli odkazům a záložkám z doby vývoje.
export default function NovaRedirect() {
  redirect("/");
}
