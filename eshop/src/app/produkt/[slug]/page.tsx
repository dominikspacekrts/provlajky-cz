import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import ProductDetail from "@/components/ProductDetail";

export const dynamic = "force-dynamic";

const GALLERY_KINDS = new Set(["configurable", "custom_flag"]);

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

  // Konfigurátory plážových vlajek a vlajek na zakázku si container i
  // masthead s logem řídí samy (fc-page je vlastní full-bleed layout).
  if (GALLERY_KINDS.has(product.kind)) {
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
      // tabulka ještě nemusí existovat (migrace neproběhla) — galerie se prostě neukáže
    }
    return <ProductDetail product={product} galleryPhotos={galleryPhotos} />;
  }

  return (
    <div className="container">
      <div className="page-panel">
        <ProductDetail product={product} size={size} />
      </div>
    </div>
  );
}
