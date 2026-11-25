export interface CompanyInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
  state: string;
  bank_name: string;
  account_name: string;
  account_no: string;
  ifsc: string;
  branch?: string;
  terms_warranty: string;
}

export interface QuotationItem {
  id?: string;
  item_no?: number;
  name: string;
  hsn: string;
  size: string;
  qty: number;
  unit: string;
  price: number;
  amount: number;
}

export interface Quotation {
  id?: string;
  row_index?: number;
  quotation_no: string;
  date: string;
  client_header?: string;
  client_name: string;
  client_address: string;
  client_email: string;
  client_contact: string;
  client_gstin?: string;
  subject: string;
  terms: string;
  amount_words: string;
  product_type: string;
  pi_number?: string;
  pi_date?: string;
  po_number?: string;
  po_date?: string;
  client_po_no?: string;
  client_po_number?: string;
  client_po_date?: string;
  due_date?: string;
  delivery_date?: string;
  tax_invoice_no?: string;
  tax_invoice_number?: string;
  tax_invoice_date?: string;
  place_of_supply?: string;
  state?: string;
  payment_terms?: string;
  pi_payment_terms?: string;
  advance_received?: string | number;
  balance_amount?: string | number;
  step1_desc?: string;
  step2_desc?: string;
  step3_desc?: string;
  transport_name?: string;
  vehicle_number?: string;
  vehicle_no?: string;
  ship_to_address?: string;
  material_specs?: string;
  design_image_path?: string;
  technical_specs?: { [key: string]: string };
  items: QuotationItem[];
  subtotal: number;
  tax_rate?: number;
  tax_amount: number;
  round_off: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  is_maharashtra: boolean;
  original_quotation_no?: string;
  revision_index?: number;
  spec_profile_id?: string;
  revision_history?: Array<{ date: string; quote_no: string; note?: string }>;
  status?: "Draft" | "Sent" | "Accepted" | "Rejected";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "User" | "ADMIN" | "USER";
  status?: string;
  active?: boolean;
  password?: string;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  header?: string;
  contact?: string;
  email?: string;
  gstin?: string;
  address?: string;
  place_of_supply?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SpecProfile {
  name?: string;
  product?: string;
  specs?: { [key: string]: string };
  [key: string]: any;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person?: string;
  phone: string;
  email: string;
  gstin: string;
  pan?: string;
  address: string;
  shipping_address?: string;
  state: string;
  city?: string;
  pincode?: string;
  payment_terms?: string;
  notes?: string;
  created_at?: string;
}

export interface POItem {
  id?: string;
  name: string;
  hsn?: string;
  size?: string;
  qty: number;
  unit: string;
  rate?: number;
  price?: number;
  amount: number;
}

export interface PurchaseOrder {
  po_number: string;
  po_date: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_contact?: string;
  vendor_phone?: string;
  vendor_email?: string;
  vendor_address?: string;
  vendor_gstin?: string;
  vendor_state?: string;
  delivery_date?: string;
  payment_terms?: string;
  project_ref?: string;
  items: POItem[];
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  total?: number;
  terms?: string;
  client_name?: string;
  [key: string]: any;
}
