import { redirect } from "next/navigation";

// Homepage se přesunula na "/" — tahle stránka tu zůstává jen jako
// přesměrování pro staré odkazy na /nova2.
export default function Nova2Redirect() {
  redirect("/");
}
