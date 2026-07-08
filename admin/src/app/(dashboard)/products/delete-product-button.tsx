"use client";

import { useTransition } from "react";
import { deleteProduct } from "@/lib/actions/products";

export default function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="btn"
      disabled={isPending}
      onClick={() => {
        if (confirm(`Smazat produkt „${name}“?`)) startTransition(() => deleteProduct(productId));
      }}
    >
      Smazat
    </button>
  );
}
