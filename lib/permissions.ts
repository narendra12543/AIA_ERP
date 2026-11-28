import { User } from "./types";

export type CanonicalRole = "Admin" | "Sales" | "Accounts" | "Purchase" | "Store" | "Staff";

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
  | "purchase_order.view_all"
  | "purchase_order.view_own"
  | "purchase_order.submit"
  | "purchase_order.approve"
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
  | "finance.dashboard"
  | "finance.orders"
  | "finance.payments"
  | "finance.reports"
  | "finance.accounts"
  | "finance.export"
  | "employees.manage"
  | "expenses.view"
  | "expenses.view_own"
  | "expenses.create"
  | "expenses.submit"
  | "expenses.review"
  | "expenses.approve"
  | "expenses.reimburse"
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
      { key: "purchase_order.create", label: "Purchase Orders", description: "Create and edit Purchase Order drafts" },
      { key: "purchase_order.view_all", label: "View All Purchase Orders", description: "View all supplier Purchase Orders" },
      { key: "purchase_order.view_own", label: "View Own Purchase Orders", description: "View Purchase Orders created by the user" },
      { key: "purchase_order.submit", label: "Submit Purchase Orders", description: "Submit Purchase Orders for Admin approval" },
      { key: "purchase_order.approve", label: "Approve Purchase Orders", description: "Approve, reject, or request changes on Purchase Orders" },
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
    category: "Finance & Operations",
    items: [
      { key: "finance.dashboard", label: "Financial Dashboard", description: "Access Finance & Operations KPIs and charts" },
      { key: "finance.orders", label: "Completed Orders", description: "Convert quotations and manage financial orders" },
      { key: "finance.payments", label: "Customer Payments", description: "Record and reverse customer receipts" },
      { key: "finance.accounts", label: "Accounts & Cash Flow", description: "Manage Cash/Bank register transactions" },
      { key: "finance.reports", label: "Financial Reports", description: "View financial & profitability reports" },
      { key: "finance.export", label: "Export Financial Data", description: "Export authorized CSV/Excel financial reports" },
      { key: "employees.manage", label: "Manage Employees", description: "View and update employee profiles & IDs" },
    ],
  },
  {
    category: "Employee Expense Management",
    items: [
      { key: "expenses.submit", label: "Submit Own Expenses", description: "Submit personal expense claims and receipts" },
      { key: "expenses.view_own", label: "View Own Expenses", description: "View own expense and reimbursement history" },
      { key: "expenses.view", label: "View All Expenses", description: "View company-wide expense register" },
      { key: "expenses.create", label: "Create Expense Entries", description: "Create expense entries" },
      { key: "expenses.review", label: "Review Expenses", description: "Review and classify employee claims" },
      { key: "expenses.approve", label: "Approve Expenses", description: "Approve, reject, or request changes on claims" },
      { key: "expenses.reimburse", label: "Record Reimbursements", description: "Record employee reimbursement payouts" },
      { key: "expenses.export", label: "Export Expense Reports", description: "Export monthly/FY expense summaries" },
    ],
  },
  {
    category: "Administration & Security",
    items: [
      { key: "users.manage", label: "Manage Users", description: "Create, activate/deactivate, reset passwords" },
      { key: "permissions.manage", label: "Manage Permissions", description: "Configure role and user permissions" },
      { key: "audit_logs.view", label: "View Audit Logs", description: "Inspect security and business audit logs" },
      { key: "database.export", label: "Export Database", description: "Export quotation database records" },
      { key: "database.import", label: "Import Database", description: "Run Excel/JSON database imports" },
      { key: "security.manage", label: "Security Policies", description: "Configure password expiry and AI policies" },
    ],
  },
];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

export const DEFAULT_SALES_PERMISSIONS: PermissionKey[] = [
  "quotations.view_own",
  "quotations.view_all",
  "quotations.create",
  "quotations.edit",
  "quotations.revise",
  "quotations.export",
  "proforma.create",
  "clients.view",
  "clients.add",
  "spec_profiles.view",
  "mail.view",
  "mail.compose",
  "mail.send",
  "mail.sent_view",
  "expenses.submit",
  "expenses.view_own",
  "expenses.create",
];

export const DEFAULT_ACCOUNTS_PERMISSIONS: PermissionKey[] = [
  "finance.dashboard",
  "finance.orders",
  "finance.payments",
  "finance.accounts",
  "finance.reports",
  "finance.export",
  "expenses.view",
  "expenses.review",
  "expenses.reimburse",
  "expenses.submit",
  "expenses.view_own",
  "expenses.create",
  "expenses.export",
  "clients.view",
  "mail.view",
  "mail.compose",
  "mail.send",
  "mail.sent_view",
];

export const DEFAULT_PURCHASE_PERMISSIONS: PermissionKey[] = [
  "purchase_order.create",
  "purchase_order.view_own",
  "purchase_order.submit",
  "quotations.export", // Required by locked /api/export-pdf renderer; non-PO exports are blocked for Purchase in authorize-export
  "vendors.view",
  "vendors.add",
  "vendors.edit",
  "mail.view",
  "mail.compose",
  "mail.send",
  "mail.sent_view",
  "expenses.submit",
  "expenses.view_own",
  "expenses.create",
];

export const DEFAULT_STORE_PERMISSIONS: PermissionKey[] = [
  "mail.view",
  "mail.compose",
  "mail.send",
  "mail.sent_view",
  "expenses.submit",
  "expenses.view_own",
  "expenses.create",
];

export const DEFAULT_STAFF_PERMISSIONS: PermissionKey[] = [
  "mail.view",
  "mail.compose",
  "mail.send",
  "mail.sent_view",
  "expenses.submit",
  "expenses.view_own",
  "expenses.create",
];

export function normalizeRole(role?: string | null): CanonicalRole {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "sales") return "Sales";
  if (r === "accounts") return "Accounts";
  if (r === "purchase") return "Purchase";
  if (r === "store") return "Store";
  return "Staff";
}

export function getDefaultPermissionsForRole(role?: string | null): PermissionKey[] {
  const canon = normalizeRole(role);
  if (canon === "Admin") return ALL_PERMISSIONS;
  if (canon === "Sales") return DEFAULT_SALES_PERMISSIONS;
  if (canon === "Accounts") return DEFAULT_ACCOUNTS_PERMISSIONS;
  if (canon === "Purchase") return DEFAULT_PURCHASE_PERMISSIONS;
  if (canon === "Store") return DEFAULT_STORE_PERMISSIONS;
  return DEFAULT_STAFF_PERMISSIONS;
}

export function resolveEffectivePermissions(user?: Pick<User, "role" | "permissions"> | null): Set<PermissionKey> {
  if (!user) return new Set();
  if (normalizeRole(user.role) === "Admin") {
    return new Set(ALL_PERMISSIONS);
  }
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return new Set(user.permissions as PermissionKey[]);
  }
  return new Set(getDefaultPermissionsForRole(user.role));
}

export function hasPermission(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  perm: PermissionKey
): boolean {
  if (!user) return false;
  if (normalizeRole(user.role) === "Admin") return true;
  return resolveEffectivePermissions(user).has(perm);
}
