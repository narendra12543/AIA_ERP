-- ==============================================================================
-- AVEN MASTER ERP — FINANCE & OPERATIONS, EMPLOYEE & EXPENSE MIGRATION (007)
-- Transactional, backward-compatible, idempotent.
-- Excludes 04_Partner_Accounts and payroll/attendance/leave completely.
-- ==============================================================================

BEGIN;

-- 1. Concurrency-safe Lifetime Sequences (Never reset across Financial Years)
CREATE SEQUENCE IF NOT EXISTS employee_id_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS finance_order_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS finance_tx_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;
CREATE SEQUENCE IF NOT EXISTS expense_claim_seq START WITH 1 INCREMENT BY 1 NO MAXVALUE CACHE 1;

-- 2. Employee Profiles (1:1 linked to users; lifetime Employee ID YYYY-YY-AIA_NNNN)
CREATE TABLE IF NOT EXISTS employee_profiles (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) UNIQUE NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  employee_id VARCHAR(40) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  mobile VARCHAR(50),
  designation VARCHAR(120),
  department VARCHAR(120),
  role VARCHAR(40) NOT NULL DEFAULT 'STAFF',
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  employment_status VARCHAR(40) NOT NULL DEFAULT 'Active',
  work_location VARCHAR(150),
  reporting_manager VARCHAR(150),
  reimbursement_details_enc TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Finance Orders (One Client -> Multiple Independent Financial Orders)
CREATE TABLE IF NOT EXISTS finance_orders (
  id VARCHAR(100) PRIMARY KEY,
  order_no VARCHAR(60) UNIQUE NOT NULL,
  legacy_ref VARCHAR(100),
  client_id VARCHAR(100),
  client_name VARCHAR(255) NOT NULL,
  quotation_no VARCHAR(100),
  quotation_snapshot JSONB,
  customer_po_no VARCHAR(120),
  customer_po_date DATE,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fy_code VARCHAR(16) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  project_description TEXT,
  basic_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  gst_rate NUMERIC(6,2) NOT NULL DEFAULT 18,
  gst_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_order_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  pi_number VARCHAR(120),
  pi_date DATE,
  pi_amount NUMERIC(15,2) DEFAULT 0,
  tax_invoice_number VARCHAR(120),
  tax_invoice_date DATE,
  tax_invoice_amount NUMERIC(15,2) DEFAULT 0,
  invoice_status VARCHAR(60) DEFAULT 'Not Generated',
  payment_terms VARCHAR(120),
  payment_due_date DATE,
  completion_date DATE,
  order_status VARCHAR(60) NOT NULL DEFAULT 'Confirmed',
  remarks TEXT,
  source_type VARCHAR(40) NOT NULL DEFAULT 'erp',
  is_historical BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(150),
  updated_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Finance Order Line Items (Unlimited products per order; actual costs & profit)
CREATE TABLE IF NOT EXISTS finance_order_items (
  id VARCHAR(100) PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL REFERENCES finance_orders(id) ON DELETE CASCADE,
  product_id VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(120),
  qty NUMERIC(12,2) NOT NULL DEFAULT 1,
  selling_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  sales_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  manufacturing_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  installation_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  other_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_pct NUMERIC(8,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

-- 5. Finance Accounts (Cash & Bank Accounts)
CREATE TABLE IF NOT EXISTS finance_accounts (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  account_type VARCHAR(40) NOT NULL DEFAULT 'Bank',
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Customer Payments (Unlimited transactions + audited reversals)
CREATE TABLE IF NOT EXISTS finance_customer_payments (
  id VARCHAR(100) PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL REFERENCES finance_orders(id) ON DELETE RESTRICT,
  client_id VARCHAR(100),
  payment_date DATE,
  fy_code VARCHAR(16),
  amount NUMERIC(15,2) NOT NULL,
  payment_type VARCHAR(40) NOT NULL DEFAULT 'Progress Payment',
  payment_mode VARCHAR(40) NOT NULL DEFAULT 'Bank Transfer',
  account_id VARCHAR(100) REFERENCES finance_accounts(id),
  transaction_ref VARCHAR(150),
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'Posted',
  reversal_of_id VARCHAR(100),
  date_missing_flag BOOLEAN NOT NULL DEFAULT false,
  recorded_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Maintenance Records
CREATE TABLE IF NOT EXISTS finance_maintenance_records (
  id VARCHAR(100) PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL REFERENCES finance_orders(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT false,
  maintenance_type VARCHAR(80),
  start_date DATE,
  end_date DATE,
  status VARCHAR(60) DEFAULT 'Not Applicable',
  revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(120) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Expense Claims (Employee Expenses & Historical Register)
CREATE TABLE IF NOT EXISTS expense_claims (
  id VARCHAR(100) PRIMARY KEY,
  claim_no VARCHAR(60) UNIQUE NOT NULL,
  employee_profile_id VARCHAR(100) REFERENCES employee_profiles(id) ON DELETE RESTRICT,
  user_id VARCHAR(100) REFERENCES users(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fy_code VARCHAR(16) NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  approved_amount NUMERIC(15,2),
  category_id VARCHAR(100) REFERENCES expense_categories(id),
  category_name VARCHAR(120) NOT NULL,
  paid_to VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  payment_mode VARCHAR(40) NOT NULL DEFAULT 'UPI',
  paid_by VARCHAR(20) NOT NULL DEFAULT 'Self',
  project_ref VARCHAR(150),
  client_id VARCHAR(100),
  order_id VARCHAR(100) REFERENCES finance_orders(id),
  merchant_address TEXT,
  transaction_ref VARCHAR(150),
  invoice_no VARCHAR(100),
  gstin VARCHAR(30),
  gst_amount NUMERIC(15,2) DEFAULT 0,
  notes TEXT,
  receipt_url TEXT,
  receipt_mime VARCHAR(100),
  receipt_name VARCHAR(255),
  missing_receipt_reason TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'Submitted',
  reimbursement_status VARCHAR(40) NOT NULL DEFAULT 'Not Required',
  reimbursed_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  change_request_reason TEXT,
  adjustment_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(150),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_by VARCHAR(150),
  approved_at TIMESTAMP WITH TIME ZONE,
  is_owner_entry BOOLEAN NOT NULL DEFAULT false,
  is_historical BOOLEAN NOT NULL DEFAULT false,
  zero_amount_flag BOOLEAN NOT NULL DEFAULT false,
  source_row INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Expense Approval History & Reimbursements
CREATE TABLE IF NOT EXISTS expense_approval_history (
  id VARCHAR(100) PRIMARY KEY,
  claim_id VARCHAR(100) NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  action VARCHAR(60) NOT NULL,
  actor_user_id VARCHAR(100),
  actor_email VARCHAR(150),
  actor_name VARCHAR(150),
  note TEXT,
  previous_status VARCHAR(40),
  new_status VARCHAR(40),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_reimbursements (
  id VARCHAR(100) PRIMARY KEY,
  claim_id VARCHAR(100) NOT NULL REFERENCES expense_claims(id) ON DELETE RESTRICT,
  employee_profile_id VARCHAR(100) REFERENCES employee_profiles(id),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fy_code VARCHAR(16) NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_mode VARCHAR(40) NOT NULL DEFAULT 'UPI',
  account_id VARCHAR(100) REFERENCES finance_accounts(id),
  reference_no VARCHAR(150),
  notes TEXT,
  recorded_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Accounts & Cash Flow Register
CREATE TABLE IF NOT EXISTS finance_transactions (
  id VARCHAR(100) PRIMARY KEY,
  tx_no VARCHAR(60) UNIQUE NOT NULL,
  tx_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fy_code VARCHAR(16) NOT NULL,
  tx_type VARCHAR(40) NOT NULL,
  category VARCHAR(120) NOT NULL,
  party VARCHAR(255),
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  account_id VARCHAR(100) REFERENCES finance_accounts(id),
  payment_mode VARCHAR(40),
  reference_no VARCHAR(150),
  source_type VARCHAR(40) NOT NULL DEFAULT 'manual',
  source_record_id VARCHAR(100),
  related_order_id VARCHAR(100),
  related_employee_id VARCHAR(100),
  posting_status VARCHAR(30) NOT NULL DEFAULT 'Posted',
  reversal_of_id VARCHAR(100),
  notes TEXT,
  created_by VARCHAR(150),
  posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Persistent In-App Notifications & Period Locks & Import Tracking
CREATE TABLE IF NOT EXISTS erp_notifications (
  id VARCHAR(100) PRIMARY KEY,
  target_user_id VARCHAR(100),
  target_role VARCHAR(40),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  module VARCHAR(60),
  record_ref VARCHAR(120),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_period_locks (
  fy_code VARCHAR(16) PRIMARY KEY,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by VARCHAR(150),
  locked_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS finance_import_batches (
  id VARCHAR(100) PRIMARY KEY,
  workbook_name VARCHAR(255) NOT NULL,
  workbook_sha256 VARCHAR(128) UNIQUE NOT NULL,
  imported_by VARCHAR(150),
  summary JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Indexes for fast <1s FY filtering and permission-scoped queries
CREATE INDEX IF NOT EXISTS idx_finance_orders_fy ON finance_orders(fy_code);
CREATE INDEX IF NOT EXISTS idx_finance_orders_client ON finance_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_finance_orders_status ON finance_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_finance_payments_order ON finance_customer_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_fy ON finance_customer_payments(fy_code);
CREATE INDEX IF NOT EXISTS idx_expense_claims_fy ON expense_claims(fy_code);
CREATE INDEX IF NOT EXISTS idx_expense_claims_user ON expense_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status);
CREATE INDEX IF NOT EXISTS idx_finance_tx_fy ON finance_transactions(fy_code);
CREATE INDEX IF NOT EXISTS idx_finance_tx_source ON finance_transactions(source_type, source_record_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON erp_notifications(target_user_id, is_read);

-- 14. Seed Default Accounts & Non-Partner Expense Categories
INSERT INTO finance_accounts (id, name, account_type, opening_balance) VALUES
  ('acc_bank_main', 'AVEN Business Bank Account', 'Bank', 0),
  ('acc_cash_petty', 'Office Cash', 'Cash', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO expense_categories (id, name, is_active, sort_order, created_by) VALUES
  ('cat_material', 'Material', true, 1, 'system'),
  ('cat_labour', 'Labour', true, 2, 'system'),
  ('cat_salary', 'Salary', true, 3, 'system'),
  ('cat_transport', 'Transport', true, 4, 'system'),
  ('cat_petrol', 'Petrol / Diesel', true, 5, 'system'),
  ('cat_electricity', 'Electricity', true, 6, 'system'),
  ('cat_rent', 'Rent', true, 7, 'system'),
  ('cat_office', 'Office', true, 8, 'system'),
  ('cat_food', 'Food', true, 9, 'system'),
  ('cat_travelling', 'Travelling', true, 10, 'system'),
  ('cat_marketing', 'Marketing', true, 11, 'system'),
  ('cat_gst_tax', 'GST / Tax', true, 12, 'system'),
  ('cat_repair', 'Repair / Maintenance', true, 13, 'system'),
  ('cat_customer_work', 'Customer Work', true, 14, 'system'),
  ('cat_bank_charges', 'Bank Charges', true, 15, 'system'),
  ('cat_purchase', 'Purchase', true, 16, 'system'),
  ('cat_misc', 'Miscellaneous', true, 17, 'system'),
  ('cat_other', 'Other', true, 18, 'system')
ON CONFLICT (name) DO NOTHING;

COMMIT;
