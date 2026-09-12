import type { CustomerAddress } from "@/lib/types";

export type CustomerOrderLine = {
  name: string;
  qty: number;
  unitPrice: number;
  lineEx: number;
  size: string | null;
  shape: string | null;
};

export type CustomerOrderSummary = {
  id: string;
  orderNumber: string | null;
  status: string;
  statusLabel: string;
  createdAt: string;
  totalEx: number;
  totalIncVat: number;
};

export type CustomerOrderDetail = CustomerOrderSummary & {
  discountPct: number;
  discountEx: number;
  shippingEx: number;
  items: CustomerOrderLine[];
  billing: CustomerAddress | null;
  shipping: CustomerAddress | null;
};
