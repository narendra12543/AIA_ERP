# GLOBAL FINANCIAL YEAR ARCHITECTURE (INDIAN FY)

## 1. Core Rules (`lib/financial-year.ts`)
- **Timezone:** `Asia/Kolkata` (`getCurrentBusinessDate()`).
- **Indian Financial Year Boundary:** `1 April` to `31 March` (`getFYFromDate`, `getFYDateRange`).
  - Example: `2026-11-27` -> `2026-27` (`2026-04-01` through `2027-03-31`).
  - January–March 2027 -> still `2026-27`.
  - April 2027 -> automatically rolls over to `2027-28`.
- **Supported Selector Values:** Any `YYYY-YY` code (or short `YY-YY` normalized via `normalizeFYCode`), plus `"ALL"` (`All Financial Years`).

## 2. Shared Context (`contexts/FinancialYearContext.tsx`)
- `<FinancialYearProvider>` wraps the authenticated ERP shell in `app/page.tsx`.
- Exposes `selectedFY`, `currentFY`, `setSelectedFY(fy)`, and `resetToCurrentFY()`.
- Integrated into:
  - `Overview.tsx` (Global FY dropdown + KPI cards + `/api/finance/dashboard?fy=...` + FY-filtered quotation table)
  - `FinanceOperationsView.tsx` (Global FY selector synced across Dashboard, Orders, Payments, Expenses, Reimbursements, Accounts, and Reports)
  - `StaffPortalView.tsx` (FY-filtered claims and reimbursements)
  - `MailCenter.tsx` (FY-filtered Linked Quotation selector while keeping manual attachment of older-year PDFs unrestricted)
