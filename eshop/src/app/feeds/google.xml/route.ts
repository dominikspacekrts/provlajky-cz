import { buildFeedData, escapeXml, BRAND } from "@/lib/feed";
import { SITE_URL } from "@/lib/site";

// Feed pro Google Merchant Center (RSS 2.0 + namespace g:).
// URL pro Merchant Center: https://provlajky.cz/feeds/google.xml

export async function GET() {
  const { items, shippingPrice } = await buildFeedData();

  const shippingBlock =
    shippingPrice === null
      ? ""
      : `
      <g:shipping>
        <g:country>CZ</g:country>
        <g:price>${shippingPrice.toFixed(2)} CZK</g:price>
      </g:shipping>`;

  const entries = items
    .map(
      (item) => `
    <item>
      <g:id>${escapeXml(item.id)}</g:id>${
        item.itemGroupId ? `\n      <g:item_group_id>${escapeXml(item.itemGroupId)}</g:item_group_id>` : ""
      }
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>${item.price.toFixed(2)} CZK</g:price>
      <g:brand>${BRAND}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${escapeXml(item.productType)}</g:product_type>
      <g:google_product_category>${escapeXml(item.googleCategory)}</g:google_product_category>${shippingBlock}
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>PROVLAJKY.CZ</title>
    <link>${SITE_URL}</link>
    <description>Reklamní vlajky, PVC bannery, nafukovací reklama a nůžkové stany na míru.</description>${entries}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
