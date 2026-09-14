import { NextResponse } from "next/server";
import { getLoggedInProfile } from "@/lib/customer-profile";

export async function GET() {
  const customer = await getLoggedInProfile();
  if (!customer) return NextResponse.json({ customer: null });
  return NextResponse.json({ customer });
}
