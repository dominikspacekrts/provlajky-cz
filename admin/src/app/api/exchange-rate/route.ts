import { NextResponse } from "next/server";

// Ported from the old server.js handleExchangeRate() — ČNB daily fixing,
// used to convert supplier EUR invoices to CZK for the finance/profit page.
// GET /api/exchange-rate?date=YYYY-MM-DD&currency=EUR
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const currency = (searchParams.get("currency") || "EUR").toUpperCase();
  const date = searchParams.get("date") || "";

  let cnbDate = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split("-");
    cnbDate = `${d}.${m}.${y}`;
  }

  const cnbUrl =
    "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt" +
    (cnbDate ? `?date=${encodeURIComponent(cnbDate)}` : "");

  try {
    const res = await fetch(cnbUrl);
    const data = await res.text();
    const lines = data.trim().split("\n");
    const header = lines[0] || "";
    const effDate = (header.split(" ")[0] || "").trim();

    let found: { amount: number; rate: number } | null = null;
    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length === 5 && parts[3].trim() === currency) {
        const amount = parseInt(parts[2], 10) || 1;
        const rate = parseFloat(parts[4].replace(",", "."));
        found = { amount, rate };
        break;
      }
    }
    if (!found) throw new Error(`Měna ${currency} nenalezena.`);

    return NextResponse.json({
      ok: true,
      currency,
      amount: found.amount,
      rate: found.rate,
      perUnit: found.rate / found.amount,
      date: effDate,
      source: "ČNB",
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Chyba ČNB API." }, { status: 502 });
  }
}
