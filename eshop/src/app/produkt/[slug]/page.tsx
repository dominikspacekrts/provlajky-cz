import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";
import ProductDetail from "@/components/ProductDetail";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient();
  const { data } = await supabase.from("products").select("*").eq("slug", slug).eq("active", true).single();
  if (!data) notFound();
  const product = data as Product;

  // Konfigurátor (plážové vlajky) si container i masthead s logem řídí sám.
  if (product.kind === "configurable") {
    return <ProductDetail product={product} />;
  }

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="page-panel">
        <ProductDetail product={product} />
      </div>
    </div>
  );
}
