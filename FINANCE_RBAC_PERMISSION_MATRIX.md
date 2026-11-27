# FINANCE RBAC PERMISSION MATRIX

## 1. Canonical Roles (`lib/permissions.ts`)
- `Admin` — Full Enterprise Access (`ALL_PERMISSIONS`, bypasses scoped checks cleanly).
- `Sales` — Quotations, Clients, Spec Profiles, Mail Center, plus own Expense Portal (`expenses.view_own`, `expenses.create`, `expenses.submit`).
- `Accounts` — Finance & Operations (`finance.dashboard`, `finance.orders`, `finance.payments`, `finance.accounts`, `finance.reports`, `finance.export`), Expense Review & Reimbursement (`expenses.view`, `expenses.review`, `expenses.reimburse`, `expenses.export`), plus own Expenses.
- `Staff` — Dedicated Staff Portal ONLY (`expenses.view_own`, `expenses.create`, `expenses.submit`). No access to Overview, Quotations, Mail Center, Finance & Operations, User Management, or Admin Settings.

## 2. Server-Side API Enforcement Matrix

| Endpoint | Admin | Accounts | Sales | Staff | Unauth |
|---|---:|---:|---:|---:|---:|
| `/api/finance/dashboard` | 200 | 200 | 403 | 403 | 401 |
| `/api/finance/orders` | 200 | 200 | 403 | 403 | 401 |
| `/api/finance/payments` | 200 | 200 | 403 | 403 | 401 |
| `/api/finance/accounts` | 200 | 200 | 403 | 403 | 401 |
| `/api/finance/reports` | 200 | 200 | 403 | 403 | 401 |
| `/api/expenses` (own create/view) | 200/201 | 200/201 | 200/201 | 200/201 | 401 |
| `/api/expenses` (reject / review) | 200 | 200 | 403 | 403 | 401 |
| `/api/expenses` (final approve) | 200 | 403 | 403 | 403 | 401 |
| `/api/expenses/reimbursements` (POST) | 200/201 | 200/201 | 403 | 403 | 401 |
| `/api/users` | 200 | 403 | 403 | 403 | 401 |
| `/api/employees` (GET) | All | Self | Self | Self | 401 |

All permissions are enforced server-side via `authenticateRequest()` in `lib/auth.ts` and verified in `test-finance-e2e.mjs` (44/44 passed).
