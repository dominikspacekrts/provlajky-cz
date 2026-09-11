import { permanentRedirect } from "next/navigation";

// Původní adresa feedu. Merchant Center i Mergado si ji můžou pamatovat, takže
// tu zůstává trvalé přesměrování na nové umístění — viz /feeds/google.xml.
export async function GET() {
  permanentRedirect("/feeds/google.xml");
}
