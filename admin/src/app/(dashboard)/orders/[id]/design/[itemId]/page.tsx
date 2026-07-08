import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrderItem } from "@/lib/types";
import DesignEditor from "./design-editor";

export const dynamic = "force-dynamic";

export default async function DesignEditorPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const supabase = await createClient();
  const { data: item, error } = await supabase.from("order_items").select("*").eq("id", itemId).eq("order_id", id).single();

  if (error || !item) notFound();

  return (
    <div>
      <Link href={`/orders/${id}`} className="back">
        ← Zpět na objednávku
      </Link>
      <DesignEditor orderId={id} item={item as OrderItem} />
    </div>
  );
}
