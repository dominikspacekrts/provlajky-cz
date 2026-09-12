import { NextResponse } from "next/server";
import { getOrderDetailForSession } from "@/lib/customer-orders";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }

  const detail = await getOrderDetailForSession(id);
  if (detail === "unauthorized") {
    return NextResponse.json({ error: "Nepřihlášeni." }, { status: 401 });
  }
  if (!detail) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }

  return NextResponse.json({ order: detail }, { headers: { "Cache-Control": "no-store" } });
}
