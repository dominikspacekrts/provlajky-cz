import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
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
