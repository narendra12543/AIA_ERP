# FINANCE & OPERATIONS DATABASE ARCHITECTURE

## 1. Migration File
- **Path:** `D:\Project\AIA_ERP\scripts\migrations\007_finance_and_operations.sql`
- **Properties:** Transactional (`BEGIN ... COMMIT`), idempotent (`CREATE SEQUENCE IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- **Status:** Verified twice consecutively on isolated PostgreSQL (PGlite 127.0.0.1:55432); **not** yet applied to live Neon PostgreSQL pending explicit authorization.

## 2. Sequences
1. `employee_id_seq` — Lifetime continuous sequence for `YYYY-YY-AIA_NNNN` Employee IDs.
2. `finance_order_seq` — Finance order numbering sequence.
3. `finance_tx_seq` — Finance ledger transaction sequence (`TX-YYYY-YY-NNNNNN`).
4. `expense_claim_seq` — Expense claim sequence (`EXP-YYYY-YY-NNNNN`).

## 3. Tables Created (14 Tables)
1. `employee_profiles` — Employee directory linked 1:1 to `users(id)` with permanent `employee_id`.
2. `finance_orders` — Independent financial orders (optional link to quotation).
3. `finance_order_items` — Unlimited product line items with selling price, manufacturing/installation/other costs, and gross profit.
4. `finance_accounts` — Bank/Cash/UPI accounts (`acc_bank_main`, `acc_cash_main` seeded).
5. `finance_customer_payments` — Customer payments against `finance_orders` with `Posted` / reversal tracking.
6. `finance_maintenance_records` — Post-order maintenance revenue, cost, and profit.
7. `expense_categories` — 18 seeded business expense categories.
8. `expense_claims` — Employee and direct company expense claims (`Draft`, `Submitted`, `Under Review`, `Changes Requested`, `Approved`, `Rejected`, `Reimbursed`, `Cancelled`).
9. `expense_approval_history` — Immutable audit trail of every claim state transition.
10. `expense_reimbursements` — Settlement records linking approved self-paid claims to `finance_accounts`.
11. `finance_transactions` — Central cash-flow ledger (`Customer Receipt`, `Expense`, `Reimbursement`, `Income`, `Opening Balance`, `Supplier Payment`, `Refund`).
12. `erp_notifications` — Role- and user-targeted workflow notifications.
13. `finance_period_locks` — Financial year / period closing controls.
14. `finance_import_batches` — Idempotent SHA-256 workbook import tracking.
