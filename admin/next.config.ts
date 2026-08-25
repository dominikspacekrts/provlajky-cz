import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old vanilla app one level up also has a package-lock.json, which makes
  // Next.js guess the workspace root wrong. Pin it explicitly to this folder.
  turbopack: {
    root: path.join(__dirname),
  },
  // Produkty/objednávky/faktury dodavatele posílají fotky a soubory jako
  // base64 přímo v datech server akce (products.images, order_items.design,
  // supplier_invoices.file_data…) — výchozí limit 1 MB stačí jen na jednu
  // menší fotku a víc produktových fotek/PDF ho snadno přesáhne.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
