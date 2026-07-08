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

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <ProductDetail product={data as Product} />
    </div>
  );
}
