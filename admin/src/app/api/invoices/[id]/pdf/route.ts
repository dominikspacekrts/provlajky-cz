import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInvoicePdf } from "@/lib/pdf/invoice";
import type { Invoice } from "@/lib/types";

// PDF generation fetches a Czech-capable font from a CDN on first use — give
// it headroom beyond Vercel's default 10s function timeout (Hobby plan).
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error || !invoice) return NextResponse.json({ error: "Faktura nenalezena." }, { status: 404 });

  const bytes = await generateInvoicePdf(invoice as Invoice);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="faktura_${(invoice as Invoice).number}.pdf"`,
    },
  });
}
