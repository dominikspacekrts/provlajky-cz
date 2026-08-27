import { createClient } from "@/lib/supabase";
import { fromPrice } from "@/lib/money";
import type { Product } from "@/lib/types";
import { SITE_URL } from "@/lib/site";

// Google Merchant Center feed (RSS 2.0 + namespace g:, viz
// https://support.google.com/merchants/answer/7052112). URL pro Merchant
// Center: https://provlajky.cz/feed/products.xml
//
// banner_m2 a custom_flag se do feedu záměrně nedávají — fromPrice() u nich
// vrací cenu za m², ne cenu za kus, což by Merchant Center bralo jako
// zavádějící (feed cena musí odpovídat tomu, co se skutečně účtuje za tu
// položku). Konfigurátor si zákazník i tak najde přes web/reklamu na
// kategorii, jen ho nejde přímo "koupit" jedním klikem z Nákupů.
const SKIP_KINDS: Product["kind"][] = ["banner_m2", "custom_flag"];

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteImage(src: string | undefined) {
  if (!src) return null;
  return src.startsWith("http") ? src : `${SITE_URL}${src}`;
}

export async function GET() {
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").eq("active", true).order("sort_order");
  const products = (data || []) as Product[];

  const items = products
    .filter((p) => !SKIP_KINDS.includes(p.kind))
    .map((p) => {
      const price = fromPrice(p);
      const image = absoluteImage(p.images?.[0]);
      if (!price || price <= 0 || !image) return null;
      const description = p.subtitle || p.description || p.name;
      return `
    <item>
      <g:id>${escapeXml(p.slug)}</g:id>
      <title>${escapeXml(p.name)}</title>
      <description>${escapeXml(description)}</description>
      <link>${SITE_URL}/produkt/${escapeXml(p.slug)}</link>
      <g:image_link>${escapeXml(image)}</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>${price.toFixed(2)} CZK</g:price>
      <g:condition>new</g:condition>
      <g:brand>PROVLAJKY.CZ</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
    })
    .filter((x): x is string => x !== null)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>PROVLAJKY.CZ</title>
    <link>${SITE_URL}</link>
    <description>Reklamní vlajky, PVC bannery, nafukovací reklama a nůžkové stany na míru.</description>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
