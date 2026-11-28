-- ==============================================================================
-- AVEN MASTER ERP — SIX-ROLE RBAC & PURCHASE ORDER APPROVAL MIGRATION (008)
-- Transactional, additive, backward-compatible, idempotent.
-- Preserves all existing quotations, clients, vendors, users, and historical POs.
-- ==============================================================================

BEGIN;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(150);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_version INTEGER DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

-- Preserve historical POs explicitly without fabricating authorization evidence
UPDATE purchase_orders
SET approval_status = 'Legacy'
WHERE approval_status IS NULL;

ALTER TABLE purchase_orders ALTER COLUMN approval_status SET DEFAULT 'Draft';

CREATE INDEX IF NOT EXISTS idx_purchase_orders_approval_status ON purchase_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);

COMMIT;
