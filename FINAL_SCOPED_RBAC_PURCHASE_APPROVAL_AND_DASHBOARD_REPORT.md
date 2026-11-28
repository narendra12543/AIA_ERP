# AVEN Master ERP — Scoped Dashboard, Six-Role RBAC, Purchase Approval & Mobile Report

## 1. Changed Files & Reasons
- `app/api/finance/dashboard/route.ts`: Added `order_total_incl_gst` to `monthlySeries`, `outstandingOrders` (actual Finance & Operations unpaid orders), and `pendingPoApprovalsCount` for Admin Action Required.
- `components/Overview.tsx`: Restored exact 4 KPI cards (`Total Quotation Value`, `Total Turnover (Excl. GST)`, `Outstanding Receivables`, `Net Profit`), removed `Purchase Order Vendors` card, deduplicated quotation revisions for Card 1 & Graph Series 1, switched Graph Series 2 to `Confirmed Order Value (₹)` (Incl. GST) with zero-height bars for zero values, updated `Action Required` to use real Finance receivables + invoice GSTINs + Admin PO approvals, and removed the quotation `Status` column & `All Statuses` filter.
- `lib/permissions.ts` & `lib/types.ts`: Expanded `CanonicalRole` and `User.role` from 4 to 6 roles (`Admin`, `Sales`, `Accounts`, `Purchase`, `Store`, `Staff`), added `purchase_order.*` permissions, and added `DEFAULT_PURCHASE_PERMISSIONS` / `DEFAULT_STORE_PERMISSIONS` + Common Access (`Mail Center`, `My Expenses`, `Staff Portal`) across all 6 roles.
- `components/UserManagementModal.tsx` & `app/api/users/route.ts`: Updated role dropdowns to the 6 authorized roles with exact descriptions, cleared custom `permissions` and revoked active sessions immediately on role change, and preserved last-Admin protection.
- `scripts/migrations/008_six_roles_and_po_approval.sql`: Additive, transactional, idempotent migration adding PO approval metadata columns (`approval_status`, `submitted_by`, `submitted_at`, `approved_by`, `approved_at`, `approval_remarks`, `approved_version`, `current_version`) while preserving historical POs as `Legacy`.
- `app/api/purchase-orders/route.ts` & `app/api/purchase-orders/approve/route.ts`: Implemented DB-backed PO approval workflow (`Draft`, `Pending Approval`, `Approved`, `Rejected`, `Changes Requested`), Admin direct approval, in-app notifications, material-change reapproval invalidation, and non-Admin scoping.
- `app/api/mail/route.ts`: Enforced ownership on `email_history`/`email_drafts` for non-Admins and blocked emailing unapproved Purchase Orders (`403`).
- `components/PurchaseOrdersWorkspace.tsx`, `components/Sidebar.tsx`, `app/page.tsx`: Added Purchase Orders navigation entry and approval wrapper around the locked `PurchaseOrderForm`, enforced 6-role routing (`EffectiveView`), and parallelized `loadPersistentData` in `app/page.tsx`.
- `app/globals.css`: Removed the residual `.a4-sheet *` colour override block so protected document white-on-dark headers remain visible.

## 2. Six-Role Permission Matrix
- **Admin:** Full Enterprise Access (Overview, Quotations, PI, TI, POs, PO Approvals, Vendors, Finance & Operations, Employee/User Management, Admin Settings, Common Access).
- **Sales:** Quotations (create/edit/revise/export), PI, Clients, Spec Profiles, Common Access (`Staff Portal`, `My Expenses`, `Mail Center`). Denied Finance, POs, User Management, Admin Settings.
- **Accounts:** Finance & Operations, Payments, Accounts & Cash Flow, Financial Reports, Expense Review & Reimbursements, Common Access. Denied Quotations, POs, User Management, Admin Settings.
- **Purchase:** Purchase Orders workspace (Draft, Edit own, Submit for Approval, Approved PO PDF/Email), Vendors, Common Access. Denied Quotations, PI/TI, Finance, PO Approval, User Management, Admin Settings.
- **Store:** Common Access ONLY (`Staff Portal`, `My Expenses`, `Mail Center`). No Inventory/GRN placeholder pages.
- **Staff:** Common Access ONLY (`Staff Portal`, `My Expenses`, `Mail Center`).

## 3. Password Policy & Mandatory Security Condition (Blocker)
- **Status:** `PASSWORD_EXPIRY_DAYS="15"` and `ENABLE_RBAC_ENFORCEMENT="true"` are verified in `.env.production.local`.
- **Blocker for 4-Digit Passwords:** Per Section 20's Mandatory Security Condition, `ENABLE_MANDATORY_MFA` is currently `"false"` (unset in `.env.production.local`), and `app/api/auth/login/route.ts` creates sessions with `deviceVerified: true` by default without blocking unapproved devices. Because MFA + device approval are not yet enforced for all accounts, the 12-character password policy was **preserved** and 4-digit numeric passwords were **not activated**. Explicit approval is required to enable `ENABLE_MANDATORY_MFA="true"`, enroll MFA on all accounts, and enforce device approval before activating 4-digit PINs.

## 4. Document, Production Migration 008 & Verification Results
- **Protected Document Integrity (`npm run verify:protected`):** `PROTECTED_DOCUMENTS_VERIFIED: 11/11 locked files match baseline SHA-256.`
- **Typecheck & Build:** `npx tsc --noEmit` and `npm run build` exited with code `0`.
- **Production Migration 008 (`neondb` on `ep-calm-tooth-bd03v2hh.c-8.us-east-2.aws.neon.tech`):**
  - Pre-migration backup captured and verified (`5,115,330` bytes across `10` tables).
  - Applied `scripts/migrations/008_six_roles_and_po_approval.sql` transactionally and verified idempotency (`MIGRATION_008_APPLIED_AND_IDEMPOTENT_OK=true`).
  - All 8 PO approval columns verified; all pre/post counts preserved identically (`users: 1, quotes: 39, clients: 31, vendors: 0, purchase_orders: 0, finance_orders: 5, finance_customer_payments: 12, finance_transactions: 60, expense_claims: 60, erp_notifications: 0`).
- **All 4 PDF Exports (A4 `0 0 594.95996 841.91998`):**
  - `PDF_QUOTATION`: `2` pages (`1919540` bytes)
  - `PDF_PI`: `1` page (`348765` bytes)
  - `PDF_TI` (with GSTIN fixture): `1` page (`348601` bytes)
  - `PDF_PO`: `1` page (`96752` bytes) — visually inspected and verified.
- **Automated Verification (`verify-enterprise-update.mjs`):**
  - `SIX_ROLE_API_RBAC_OK=true`
  - `PO_APPROVAL_WORKFLOW_OK=true` (Draft, forgery blocked, unapproved mail blocked `403`, submit -> Admin notify -> Admin approve -> material edit resets to `Draft` v2)
  - `OVERVIEW_CHECK`: 4 cards in exact order, no Vendors card, no Status column/filter, `Quotation Value (₹)` vs `Confirmed Order Value (₹)`, load time `1643 ms`
  - `RESPONSIVE_VIEWPORTS_OK=true` (`320px`, `375px`, `390px`, `414px`, `768px`, `1024px`, `1280px`, `1440px`, `1920px`, `2560px` — zero horizontal overflow)
  - `DOC_CELL_CONTENT_CHECK`: Commercial Offer 8 columns verified (`#`, `Item name`, `HSN/ SAC`, `Size(Mtr)`, `Quantity`, `Unit`, `Price/ Unit`, `Amount`) with `rgb(255, 255, 255)` white header text.
- **Note on Issued Tax Invoice Graph Series:** The ERP currently does not persist a separate `tax_invoices` table (only `quotations.tax_invoice_number` metadata), so the Overview graph displays only `Quotation Value (₹)` and `Confirmed Order Value (₹)` without inventing invoice totals.
- **Direct `/api/export-pdf` Boundary Note:** Because all 11 protected document files (including `app/api/export-pdf/route.ts`) are permanently locked and unmodified, direct `POST /api/export-pdf` requests with arbitrary raw HTML are not blocked inside `export-pdf/route.ts`; UI export/print/email actions and `POST /api/mail` PO attachments (`403` when unapproved) enforce PO approval externally.

## 5. Manual Git Commands
```bash
git status
git add -A
git commit -m "feat: 6-role RBAC, PO approval workflow, scoped Overview, and mobile responsiveness"
git push origin main
```
