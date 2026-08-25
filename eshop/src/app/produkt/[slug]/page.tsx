import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Product, ProductCategory } from "@/lib/types";
import ProductDetail from "@/components/ProductDetail";

export const dynamic = "force-dynamic";

// Ilustrační fotky pro sloupec s galerií, dokud si admin pro danou kategorii
// nenahraje vlastní fotky hotových realizací (Konfigurace webu → Galerie).
const FALLBACK_GALLERY: Record<ProductCategory, string[]> = {
  "plazove-vlajky": ["/fotky/foto-01.jpg", "/fotky/foto-03.jpg", "/fotky/foto-04.jpg", "/hero/plazove-vlajky.jpg"],
  "vlajky-na-zakazku": ["/fotky/foto-02.jpg", "/produkty/dily-vlajky.jpg"],
  "pvc-bannery": ["/produkty/mesh-banner.jpg", "/hero/bannery.jpg"],
  prislusenstvi: [
    "/prislusenstvi/drzak-pod-kolo.jpg",
    "/prislusenstvi/drzak-pod-kolo-eco.jpg",
    "/prislusenstvi/krizovy-stojan-vak.jpg",
    "/prislusenstvi/plastova-nadrz.jpg",
    "/prislusenstvi/sroubovy-stojan.jpg",
    "/prislusenstvi/tezka-zakladna-eco.jpg",
    "/prislusenstvi/tezka-zelezna-zakladna.jpg",
    "/prislusenstvi/zapich-pro-vlajku.jpg",
  ],
  "nuzkove-stany": ["/stany/real-full.jpg", "/stany/real-half.jpg", "/stany/real-none.jpg", "/produkty/dily-stany.jpg"],
  "nafukovaci-stany": ["/stany/nafukovaci.jpg", "/hero/nafukovaci-stan.jpg", "/produkty/nafukovaci-stan.jpg"],
  totemy: ["/produkty/nafukovaci-totem.jpg"],
  "nafukovaci-brany": ["/produkty/nafukovaci-brana.jpg"],
  "nahradni-dily": ["/produkty/dily-vlajky.jpg", "/produkty/dily-stany.jpg", "/produkty/dily-nafukovaci.jpg"],
};

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { slug } = await params;
  const { size } = await searchParams;
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").eq("slug", slug).eq("active", true).single();
  if (!data) notFound();
  const product = data as Product;

  // Všechny konfigurátory teď běží na fc-page (vlastní full-bleed layout s
  // masthead logem) — stránka je jen jejich obálka, container/page-panel
  // (papírová deska) by full-bleed rozvržení jen zúžil.
  let galleryPhotos: { id: string; image: string }[] = [];
  try {
    const { data: gallery } = await supabase
      .from("configurator_gallery")
      .select("id, image")
      .eq("category", product.category)
      .order("sort_order")
      .order("created_at", { ascending: false });
    galleryPhotos = gallery || [];
  } catch {
    // tabulka ještě nemusí existovat (migrace neproběhla) — spadneme na ilustrační fotky níž
  }
  if (galleryPhotos.length === 0) {
    galleryPhotos = (FALLBACK_GALLERY[product.category] ?? []).map((image, i) => ({ id: `fallback-${i}`, image }));
  }

  return <ProductDetail product={product} size={size} galleryPhotos={galleryPhotos} />;
}
