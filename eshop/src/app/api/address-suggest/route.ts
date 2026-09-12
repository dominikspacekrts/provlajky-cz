import { NextRequest, NextResponse } from "next/server";
import type { AddressSuggestion } from "@/lib/address-suggest";

// Proxy na Mapy.com Suggest API — klíč zůstává jen na serveru (nikdy
// NEXT_PUBLIC_), navíc tu filtrujeme jen na ČR a zjednodušujeme odpověď na to,
// co checkout skutečně potřebuje (ulice, město, PSČ).
//
// Tvar požadavku/odpovědi ověřený přímo z JS kódu oficiálního testovacího
// labu (pro.mapy.cz/examples/geocode) a z OpenAPI specifikace projektu —
// veřejná dokumentace na developer.mapy.com se renderuje přes JS a přesný
// tvar polí (hlavně "zip" a "regionalStructure") z ní nejde vyčíst staticky.
type RegionalEntity = { name: string; type: string; isoCode?: string };
type SuggestItem = {
  name: string;
  // Mapy vrací v "label" jen kategorii ("Adresa"), ne čitelný popis —
  // pro dropdown bereme name + location (např. "Květná 174/24, Brno - Pisárky, Česko").
  label: string;
  location?: string;
  type: string;
  regionalStructure?: RegionalEntity[];
  zip?: string;
};

function suggestLabel(item: SuggestItem, city: string): string {
  if (item.location) return `${item.name}, ${item.location}`;
  return city ? `${item.name}, ${city}` : item.name;
}

function extractCity(regionalStructure: RegionalEntity[]): string | null {
  const part = regionalStructure.find((r) => r.type === "regional.municipality_part");
  const city = regionalStructure.find((r) => r.type === "regional.municipality");
  return (part ?? city)?.name ?? null;
}

function isCzech(regionalStructure: RegionalEntity[]): boolean {
  return regionalStructure.some((r) => r.type === "regional.country" && r.isoCode === "CZ");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ items: [] });

  const apiKey = process.env.MAPY_API_KEY;
  if (!apiKey) {
    // Appka běží dál i bez klíče — jen bez napovídání, nikdy chyba/blokování.
    return NextResponse.json({ items: [] });
  }

  const params = new URLSearchParams({
    query: q,
    lang: "cs",
    limit: "5",
    type: "regional.address",
  });

  try {
    const res = await fetch(`https://api.mapy.com/v1/suggest?${params.toString()}&apikey=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return NextResponse.json({ items: [] });

    const data = (await res.json()) as { items?: SuggestItem[] };
    const items: AddressSuggestion[] = (data.items ?? [])
      .filter((item) => item.regionalStructure && isCzech(item.regionalStructure))
      .map((item) => {
        const city = extractCity(item.regionalStructure!) ?? "";
        return {
          street: item.name,
          city,
          zip: item.zip ?? null,
          label: suggestLabel(item, city),
        };
      })
      .filter((item) => item.city);

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
