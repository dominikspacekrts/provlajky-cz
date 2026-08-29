import { NextResponse } from "next/server";
import { getCheckoutSettings } from "@/lib/checkoutSettings";

// Veřejné (bezpečné) — jen názvy a ceny způsobů dopravy/platby, žádná citlivá
// data. Používá ho košík (progress do dopravy zdarma) a checkout (výběr).
export async function GET() {
  const settings = await getCheckoutSettings();
  return NextResponse.json(settings);
}
