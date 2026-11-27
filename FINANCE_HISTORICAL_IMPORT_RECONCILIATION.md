# FINANCE HISTORICAL IMPORT RECONCILIATION

## 1. Script & Safety Controls
- **Script:** `D:\Project\AIA_ERP\scripts\migrate-finance-excel.mjs`
- **Modes:** Dry-run by default (`node scripts/migrate-finance-excel.mjs`); requires explicit `--apply` flag to write to PostgreSQL.
- **Idempotency:** Tracks workbook SHA-256 (`9a20ea8437926ff668dc2a028015dffd9cef0f7cf78deb3b258fe00b550e8548`) in `finance_import_batches`; verified twice against isolated PostgreSQL (`WORKBOOK_ALREADY_IMPORTED=true (idempotent skip)`).

## 2. Exact Reconciliation Totals (Verified Against `/api/finance/dashboard?fy=2026-27`)

| Metric | Excel Workbook | PostgreSQL / API Result | Status |
|---|---:|---:|---|
| Converted Historical Orders | 5 (`2627-AIA-001`..`005`) | 5 | Exact Match |
| Basic Turnover (Excl. GST) | `₹960,820.00` | `₹960,820.00` | Exact Match |
| GST-Inclusive Order Value | `₹1,111,267.60` | `₹1,111,267.60` | Exact Match |
| Customer Received | `₹1,052,667.60` | `₹1,052,667.60` | Exact Match |
| Outstanding Receivables | `₹58,600.00` | `₹58,600.00` | Exact Match |
| Direct Product Cost | `₹622,990.00` | `₹622,990.00` | Exact Match |
| Gross Profit | `₹337,830.00` | `₹337,830.00` | Exact Match |
| Historical Expense Rows | 60 (4 zero-amount) | 60 | Exact Match |
| Total Historical Expenses | `₹48,828.00` | `₹48,828.00` | Exact Match |
| Historical Net Profit | `₹289,002.00` | `₹289,002.00` | Exact Match |
| Partner Accounts (`04_Partner_Accounts`) | Excluded | 0 rows / 0 tables | Excluded |
