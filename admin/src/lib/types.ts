// Mirrors admin/supabase/schema.sql (snake_case, as returned by supabase-js).

export type CustomerAddress = {
  company?: string;
  name?: string;
  street?: string;
  psc?: string;
  city?: string;
  ico?: string;
  dic?: string;
  email?: string;
  phone?: string;
  isCompany?: boolean;
};

export type Customer = {
  billing: CustomerAddress;
  shipping: CustomerAddress;
};

export type Design = {
  bgColor?: string;
  sleeveColor?: "white" | "black";
  logo?: { src: string; x: number; y: number; w: number; h: number; rotation: number } | null;
  fullArtwork?: {
    src: string;
    origSrc?: string;
    origType?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation: number;
  } | null;
  thumb?: string | null;
  flagBounds?: { x: number; y: number; w: number; h: number; pr: number } | null;
};

export type Order = {
  id: string;
  legacy_id: string | null;
  wc_id: string | null;
  order_number: string | null;
  title: string | null;
  status: string;
  currency: "CZK" | "EUR";
  is_foreign: boolean;
  shipping: number;
  ship_vat_rate: number;
  discount_pct: number;
  customer: Customer;
  created_at: string;
  updated_at: string;
  dirty: boolean;
  supplier_paid: boolean;
};

export type OrderItem = {
  id: string;
  legacy_id: string | null;
  order_id: string;
  type: "flag" | "banner";
  shape: string | null;
  size: string | null;
  width_cm: number | null;
  height_cm: number | null;
  qty: number;
  unit_price: number;
  vat_rate: number;
  wc_line_name: string | null;
  wc_product_id: string | null;
  artwork_images: string[];
  artwork_files: string[];
  design: Design | null;
  multi_artwork: Design[] | null;
};

export type OrderTotals = {
  prodEx: number;
  discountEx: number;
  netProdEx: number;
  netProdVat: number;
  shipEx: number;
  shipVat: number;
  totalEx: number;
  totalVat: number;
  grand: number;
};

export type InvoiceItem = {
  desc: string;
  qty: number;
  unitPrice: number;
  vatRate: number;
  thumb: string | null;
  thumbBounds: Design["flagBounds"] | null;
};

export type Invoice = {
  id: string;
  legacy_id: string | null;
  kind: "product" | "payout";
  number: string;
  order_id: string | null;
  order_number: string | null;
  payout_id: string | null;
  issued: string;
  tax_date: string | null;
  due: string | null;
  paid: boolean;
  currency: "CZK" | "EUR";
  is_foreign: boolean;
  customer: CustomerAddress | null;
  shipping_customer: Record<string, string> | null;
  items: InvoiceItem[];
  discount_pct: number;
  shipping: number;
  ship_vat_rate: number;
  totals: OrderTotals | null;
  supplier: { name: string; ico: string; dic: string; street: string; city: string; bank: string; person?: string } | null;
  payout_customer: { company: string; ico: string; dic: string; street: string; psc: string; city: string } | null;
  subject: string | null;
  amount: number | null;
  created_at: string;
};

export type Payout = {
  id: string;
  legacy_id: string | null;
  partner_id: string;
  partner_name: string | null;
  amount: number;
  date: string;
  created_at: string;
};

export type Partner = {
  id: string;
  name: string;
  share: number;
  billing: {
    company?: string;
    name?: string;
    ico?: string;
    dic?: string;
    street?: string;
    psc?: string;
    city?: string;
    bank?: string;
  };
};

export type SupplierInvoice = {
  id: string;
  legacy_id: string | null;
  order_id: string | null;
  supplier: string | null;
  invoice_num: string | null;
  date: string | null;
  amount: number | null;
  amount_czk: number | null;
  exchange_rate: number | null;
  filename: string | null;
  file_data: string | null;
  created_at: string;
};

export type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  from: string;
  accountant: string;
  supplier: string;
  tplInvoice: string;
  tplVisual: string;
  tplAccountant: string;
  signName: string;
  signPhone: string;
};

export type Settings = {
  id: 1;
  cost_per_size: { S: number; M: number; L: number; XL: number };
  mail: MailSettings;
  updated_at: string;
};

export type EmailKind = "invoice" | "visual" | "accountant" | "supplier" | "other";

export type EmailHistoryRow = {
  id: string;
  sent_at: string;
  sent_by: string;
  kind: EmailKind;
  order_id: string | null;
  invoice_id: string | null;
  to_addr: string;
  cc: string[];
  bcc: string[];
  subject: string;
  html_body: string;
  attachments_meta: { filename: string; contentType?: string; sizeBytes: number }[];
  status: "sent" | "failed";
  error_message: string | null;
};

export type AllowedUser = { email: string; display_name: string; created_at: string };

export type ProductCategory = "plazove-vlajky" | "vlajky-na-zakazku" | "pvc-bannery" | "prislusenstvi";
export type ProductKind = "simple" | "configurable";

export type Product = {
  id: string;
  slug: string;
  category: ProductCategory;
  name: string;
  subtitle: string | null;
  description: string | null;
  kind: ProductKind;
  price: number;
  price_by_size: { S?: number; M?: number; L?: number; XL?: number };
  vat_rate: number;
  images: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const PRODUCT_CATEGORIES: Record<ProductCategory, string> = {
  "plazove-vlajky": "Plážové vlajky",
  "vlajky-na-zakazku": "Vlajky na zakázku",
  "pvc-bannery": "PVC bannery",
  "prislusenstvi": "Příslušenství a stojany",
};
