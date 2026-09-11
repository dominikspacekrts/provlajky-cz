import { buildFeedData, escapeXml, BRAND } from "@/lib/feed";

// Feed ve formátu Heureky (SHOP / SHOPITEM). Stejnou strukturu bere i Zboží.cz
// a Mergado, takže stačí jeden.
// URL: https://provlajky.cz/feeds/heureka.xml

export async function GET() {
  const { items, shippingPrice } = await buildFeedData();

  const entries = items
    .map(
      (item) => `
  <SHOPITEM>
    <ITEM_ID>${escapeXml(item.id)}</ITEM_ID>
    <PRODUCTNAME>${escapeXml(item.title)}</PRODUCTNAME>
    <DESCRIPTION>${escapeXml(item.description)}</DESCRIPTION>
    <URL>${escapeXml(item.link)}</URL>
    <IMGURL>${escapeXml(item.imageLink)}</IMGURL>
    <PRICE_VAT>${item.price.toFixed(2)}</PRICE_VAT>
    <MANUFACTURER>${BRAND}</MANUFACTURER>
    <CATEGORYTEXT>${escapeXml(item.productType)}</CATEGORYTEXT>
    <DELIVERY_DATE>0</DELIVERY_DATE>${
      item.variant ? `\n    <PARAM>\n      <PARAM_NAME>Provedení</PARAM_NAME>\n      <VAL>${escapeXml(item.variant)}</VAL>\n    </PARAM>` : ""
    }${item.itemGroupId ? `\n    <ITEMGROUP_ID>${escapeXml(item.itemGroupId)}</ITEMGROUP_ID>` : ""}${
      shippingPrice === null
        ? ""
        : `\n    <DELIVERY>\n      <DELIVERY_ID>CESKA_POSTA</DELIVERY_ID>\n      <DELIVERY_PRICE>${shippingPrice.toFixed(2)}</DELIVERY_PRICE>\n    </DELIVERY>`
    }
  </SHOPITEM>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SHOP>${entries}
</SHOP>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
