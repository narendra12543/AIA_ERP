import { User } from "./types";

export type CanonicalRole = "Admin" | "Staff";

export type PermissionKey =
  | "overview.view"
  | "quotations.view_all"
  | "quotations.view_own"
  | "quotations.create"
  | "quotations.edit"
  | "quotations.revise"
  | "quotations.delete"
  | "quotations.export"
  | "proforma.create"
  | "tax_invoice.create"
  | "purchase_order.create"
  | "clients.view"
  | "clients.add"
  | "clients.edit"
  | "clients.delete"
  | "vendors.view"
  | "vendors.add"
  | "vendors.edit"
  | "vendors.delete"
  | "vendors.approve"
  | "vendors.bank_view"
  | "spec_profiles.view"
  | "spec_profiles.manage"
  | "company.manage"
  | "banking.manage"
  | "mail.view"
  | "mail.compose"
  | "mail.send"
  | "mail.sent_view"
  | "mail.templates"
  | "mail.signatures"
  | "mail.settings"
  | "users.manage"
  | "permissions.manage"
  | "audit_logs.view"
  | "database.export"
  | "database.import"
  | "security.manage"
  | "expenses.view"
  | "expenses.create"
  | "expenses.approve"
  | "expenses.export";

export interface PermissionGroup {
  category: string;
  items: Array<{ key: PermissionKey; label: string; description: string }>;
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: "Overview & Quotations",
    items: [
      { key: "overview.view", label: "View Overview", description: "Access the ERP Overview dashboard" },
      { key: "quotations.view_all", label: "View All Quotations", description: "View every quotation in the database" },
      { key: "quotations.view_own", label: "View Own Quotations", description: "View only quotations created by the user" },
      { key: "quotations.create", label: "Create Quotations", description: "Create new quotations" },
      { key: "quotations.edit", label: "Edit Quotations", description: "Modify permitted quotations" },
      { key: "quotations.revise", label: "Revise Quotations", description: "Create quotation revisions (R1, R2...)" },
      { key: "quotations.delete", label: "Delete Quotations", description: "Permanently delete quotations" },
      { key: "quotations.export", label: "Generate PDFs", description: "Export quotation PDF documents" },
    ],
  },
  {
    category: "Invoices & Purchase Orders",
    items: [
      { key: "proforma.create", label: "Proforma Invoices", description: "Generate and export Proforma Invoices (PI)" },
      { key: "tax_invoice.create", label: "Tax Invoices", description: "Generate and export Tax Invoices (TI)" },
      { key: "purchase_order.create", label: "Purchase Orders", description: "Create and export Purchase Orders (PO)" },
    ],
  },
  {
    category: "Clients, Vendors & Tech Specs",
    items: [
      { key: "clients.view", label: "View Clients", description: "Search and auto-fetch existing clients" },
      { key: "clients.add", label: "Add Clients", description: "Create new client master records" },
      { key: "clients.edit", label: "Edit Clients", description: "Update existing client records" },
      { key: "clients.delete", label: "Delete Clients", description: "Remove client master records" },
      { key: "vendors.view", label: "View Vendors", description: "View PO vendor master list" },
      { key: "vendors.add", label: "Add Vendors", description: "Create new PO vendor records" },
      { key: "vendors.edit", label: "Edit Vendors", description: "Update PO vendor details" },
      { key: "vendors.delete", label: "Delete Vendors", description: "Remove PO vendor records" },
      { key: "vendors.approve", label: "Approve Vendors", description: "Approve, reject, or block PO vendors" },
      { key: "vendors.bank_view", label: "View Vendor Bank & Docs", description: "Access private vendor bank details and KYC documents" },
      { key: "spec_profiles.view", label: "View Spec Profiles", description: "Use Technical Specification Profiles" },
      { key: "spec_profiles.manage", label: "Manage Spec Profiles", description: "Create, edit, or delete spec profiles" },
    ],
  },
  {
    category: "Company & Banking",
    items: [
      { key: "company.manage", label: "Manage Company Profile", description: "Modify company legal info, GSTIN, PAN, logo" },
      { key: "banking.manage", label: "Manage Bank Details", description: "Modify bank account, IFSC, and branch" },
    ],
  },
  {
    category: "Zoho Mail Center",
    items: [
      { key: "mail.view", label: "Access Mail Center", description: "Open the ERP Mail Center" },
      { key: "mail.compose", label: "Compose & Save Drafts", description: "Compose emails and save drafts" },
      { key: "mail.send", label: "Send Emails", description: "Send emails via Zoho Mail integration" },
      { key: "mail.sent_view", label: "View Sent Emails", description: "View sent email history" },
      { key: "mail.templates", label: "Manage Email Templates", description: "Create and edit reusable email templates" },
      { key: "mail.signatures", label: "Manage Signatures", description: "Create and edit email signatures" },
      { key: "mail.settings", label: "Mail Settings", description: "Configure Zoho Mail connection and signatures" },
    ],
  },
  {
    category: "Administration & Security",
    items: [
      { key: "users.manage", label: "Manage Users", description: "Create, activate/deactivate, reset passwords" },
      { key: "permissions.manage", label: "Manage Permissions", description: "Configure Staff role permissions" },
      { key: "audit_logs.view", label: "View Audit Logs", description: "Inspect security and business audit logs" },
      { key: "database.export", label: "Export Database", description: "Export quotation database records" },
      { key: "database.import", label: "Import Database", description: "Run Excel/JSON database imports" },
      { key: "security.manage", label: "Security Policies", description: "Configure password expiry and AI policies" },
    ],
  },
  {
    category: "Expense Management (Future Ready)",
    items: [
      { key: "expenses.view", label: "View Expenses", description: "View project and daily expenses" },
      { key: "expenses.create", label: "Create Expenses", description: "Submit expense entries and receipts" },
      { key: "expenses.approve", label: "Approve Expenses", description: "Approve or reject expense claims" },
      { key: "expenses.export", label: "Export Expense Reports", description: "Export monthly/FY expense summaries" },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const DEFAULT_STAFF_PERMISSIONS: PermissionKey[] = [
  "overview.view",
  "quotations.view_all",
  "quotations.create",
  "quotations.edit",
  "quotations.export",
  "proforma.create",
  "purchase_order.create",
  "clients.view",
  "clients.add",
  "vendors.view",
  "spec_profiles.view",
  "mail.view",
  "mail.compose",
  "mail.send",
  "mail.sent_view",
];

export function normalizeRole(role?: string | null): CanonicalRole {
  const r = String(role || "").trim().toLowerCase();
  return r === "admin" ? "Admin" : "Staff";
}

export function resolveEffectivePermissions(user?: Pick<User, "role" | "permissions"> | null): Set<PermissionKey> {
  if (!user) return new Set();
  if (normalizeRole(user.role) === "Admin") {
    return new Set(ALL_PERMISSIONS);
  }
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return new Set(user.permissions as PermissionKey[]);
  }
  return new Set(DEFAULT_STAFF_PERMISSIONS);
}

export function hasPermission(user: Pick<User, "role" | "permissions"> | null | undefined, perm: PermissionKey): boolean {
  if (!user) return false;
  if (normalizeRole(user.role) === "Admin") return true;
  return resolveEffectivePermissions(user).has(perm);
}
