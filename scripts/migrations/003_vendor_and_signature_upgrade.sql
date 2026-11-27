-- ==============================================================================
-- AVEN MASTER ERP — VENDOR MASTER, SIGNATURES & ATOMIC NUMBERING MIGRATION (003)
-- Transactional, non-destructive, idempotent. Preserves all existing records.
-- ==============================================================================

BEGIN;

-- 1. Atomic Sequences for Vendor Codes (AIA-VND-000001) & Quotation Serials
CREATE SEQUENCE IF NOT EXISTS vendor_code_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS quotation_seq START WITH 150 INCREMENT BY 1;

-- 2. Extend vendors table for Independent Enterprise Vendor Master Management
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50) UNIQUE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_type VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS category VARCHAR(120);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS constitution VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_person VARCHAR(150);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS designation VARCHAR(120);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS alt_phone VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS alt_email VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state_code VARCHAR(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gst_type VARCHAR(80);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS pan VARCHAR(30);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS udyam_no VARCHAR(80);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cin VARCHAR(80);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS credit_period VARCHAR(80);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS currency VARCHAR(20) DEFAULT 'INR';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS lead_time VARCHAR(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS freight_terms VARCHAR(120);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS preferred BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(255);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_account_no_enc TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(30);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'Approved';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) NOT NULL DEFAULT 'Active';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill vendor_code for any existing genuine vendors that do not have one yet
UPDATE vendors
SET vendor_code = 'AIA-VND-' || LPAD(nextval('vendor_code_seq')::text, 6, '0')
WHERE vendor_code IS NULL;

-- 3. Persistent Email Signatures Table
CREATE TABLE IF NOT EXISTS email_signatures (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  user_email VARCHAR(255),
  html_content TEXT NOT NULL,
  logo_url TEXT,
  font_family VARCHAR(80) DEFAULT 'Verdana',
  font_size VARCHAR(20) DEFAULT '10pt',
  is_default BOOLEAN NOT NULL DEFAULT false,
  auto_insert BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
