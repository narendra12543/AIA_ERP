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
  role: "Admin" | "Staff" | "User" | "ADMIN" | "STAFF" | "USER";
  status?: string;
  approval_status?: string;
  mfa_enabled?: boolean;
  active?: boolean;
  password?: string;
  permissions?: string[];
  password_changed_at?: string | null;
  password_expires_at?: string | null;
  must_change_password?: boolean;
  password_policy_days?: number;
  last_login_at?: string | null;
  locked_until?: number | null;
  created_at?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id?: string | null;
  actor_name?: string | null;
  action: string;
  module?: string | null;
  record_ref?: string | null;
  outcome?: string | null;
  request_id?: string | null;
  details?: any;
  created_at: string;
}

export interface EmailAttachment {
  name: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
  quoteRef?: string;
  docType?: "quotation" | "pi" | "ti" | "po" | "custom";
}

export interface EmailDraft {
  id: string;
  user_id?: string;
  to_emails: string;
  cc_emails?: string;
  bcc_emails?: string;
  subject: string;
  body_html: string;
  attachments?: EmailAttachment[];
  quote_ref?: string;
  quotation_no?: string | null;
  document_type?: string | null;
  updated_at: string;
  created_at?: string;
}

export interface EmailHistoryEntry {
  id: string;
  user_id?: string;
  from_email: string;
  to_emails: string;
  cc_emails?: string;
  subject: string;
  body_html: string;
  attachments?: EmailAttachment[];
  quote_ref?: string;
  quotation_no?: string | null;
  document_type?: string | null;
  sent_by?: string;
  status: "sent" | "failed";
  provider?: string;
  message_id?: string | null;
  error_message?: string | null;
  sent_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject?: string;
  subject_template?: string;
  body_html: string;
  is_system?: boolean;
  is_default?: boolean;
  updated_at?: string;
}

export interface EmailSignature {
  id: string;
  name: string;
  user_email?: string | null;
  html_content: string;
  logo_url?: string | null;
  font_family?: string;
  font_size?: string;
  is_default?: boolean;
  auto_insert?: boolean;
  updated_at?: string;
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
  vendor_code?: string;
  name: string;
  trade_name?: string;
  vendor_type?: string;
  category?: string;
  constitution?: string;
  contact_person?: string;
  designation?: string;
  phone: string;
  alt_phone?: string;
  email: string;
  alt_email?: string;
  website?: string;
  gst_type?: string;
  gstin: string;
  pan?: string;
  udyam_no?: string;
  cin?: string;
  address: string;
  address_line2?: string;
  shipping_address?: string;
  state: string;
  state_code?: string;
  city?: string;
  district?: string;
  pincode?: string;
  country?: string;
  payment_terms?: string;
  credit_period?: string;
  currency?: string;
  lead_time?: string;
  freight_terms?: string;
  preferred?: boolean;
  remarks?: string;
  bank_account_holder?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_account_no?: string;
  bank_account_no_masked?: string;
  bank_ifsc?: string;
  documents?: Array<{ name: string; type: string; url: string; uploaded_at?: string }>;
  approval_status?: "Pending Approval" | "Approved" | "Rejected";
  operational_status?: "Active" | "Inactive" | "Blocked";
  notes?: string;
  registered_at?: string;
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
