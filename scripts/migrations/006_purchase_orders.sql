-- ==============================================================================
-- AVEN MASTER ERP — INDEPENDENT PURCHASE ORDERS MIGRATION (006)
-- Transactional, backward-compatible, idempotent.
-- Preserves all existing quotations, clients, vendors, users, and mail records.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id VARCHAR(100) PRIMARY KEY,
  po_number VARCHAR(100) UNIQUE NOT NULL,
  po_date VARCHAR(50),
  vendor_id VARCHAR(100),
  vendor_name VARCHAR(255),
  linked_quotation_no VARCHAR(100),
  total NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Draft',
  data JSONB NOT NULL,
  created_by VARCHAR(150),
  updated_by VARCHAR(150),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);

COMMIT;
