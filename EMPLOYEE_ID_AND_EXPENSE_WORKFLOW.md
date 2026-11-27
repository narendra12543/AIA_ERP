# EMPLOYEE ID & EXPENSE WORKFLOW

## 1. Permanent Employee ID Format (`lib/employee-id.ts`)
- **Format:** `YYYY-YY-AIA_NNNN` (e.g., `2026-27-AIA_0001`).
- **Generation:** Atomic PostgreSQL sequence `employee_id_seq` (`nextval('employee_id_seq')`) paired with the employee's joining date FY (`getFYFromDate(joiningDate)`).
- **Lifecycle:** Auto-assigned in `POST /api/users` when creating non-Admin employees (or when `createEmployeeProfile: true` is passed) and persisted in `employee_profiles`. Never resets or reuses numbers across financial years.

## 2. Staff Portal & <60s Expense Entry (`components/StaffPortalView.tsx`)
- **Dedicated Staff Navigation:** `My Dashboard`, `Add Expense`, `My Expenses`, `Reimbursements`, `Notifications`, `My Profile`.
- **Quick Form:** Amount (`₹`), Category, Purpose/Title, Expense Date (IST default), Payment Method (`Personal UPI`, `Personal Cash`, `Personal Card`, `Company Card`, `Company Bank`), Receipt Upload/Camera (`image/*,application/pdf`), and collapsible optional fields (Vendor/Payee, Bill No, Notes).
- **Actions:** `Save Draft` or `Submit for Approval`.

## 3. Expense & Reimbursement State Machine
1. `Draft` -> Employee can edit, submit, or cancel.
2. `Submitted` -> Employee cannot self-approve (`403`). Accounts/Admin can review or reject (mandatory reason) / request changes; Admin performs final `Approved` transition.
3. `Rejected` / `Changes Requested` -> Staff notified in `erp_notifications`; Staff can edit & `resubmit`.
4. `Approved` -> Posts `Expense` entry to `finance_transactions` idempotently; if `paid_by = 'Self'`, `reimbursement_status = 'Pending'`.
5. `Reimbursement` (`POST /api/expenses/reimbursements`) -> Accounts/Admin selects `finance_accounts`, mode, UTR/reference, and date; creates `expense_reimbursements` record, marks claim `reimbursement_status = 'Reimbursed'`, posts `Reimbursement` debit to `finance_transactions`, and notifies employee.
