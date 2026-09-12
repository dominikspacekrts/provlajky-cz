import { NextResponse } from "next/server";
import { listOrdersForSession } from "@/lib/customer-orders";

export async function GET() {
  const orders = await listOrdersForSession();
  if (orders === null) {
    return NextResponse.json({ error: "Nepřihlášeni." }, { status: 401 });
  }
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
