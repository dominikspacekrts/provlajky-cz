import type { MetadataRoute } from "next";
import { SITE_URL, isProduction } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Dev prostředí se neindexuje vůbec — jinak by se testovací verze prala
  // ve vyhledávání s ostrou doménou.
  if (!isProduction()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Košík a checkout nemají žádnou SEO hodnotu a jejich obsah je
      // per-návštěvník — nemá smysl je indexovat.
      disallow: ["/kosik", "/objednavka"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
