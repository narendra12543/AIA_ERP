-- ==============================================================================
-- AVEN MASTER ERP — NON-DESTRUCTIVE ENTERPRISE UPGRADE MIGRATION (002)
-- Safe for PostgreSQL / Neon: uses ADD COLUMN IF NOT EXISTS & CREATE TABLE IF NOT EXISTS.
-- Never truncates, drops, or resets existing business records or user passwords.
-- ==============================================================================

BEGIN;

-- 1. Extend users table for RBAC permissions & 15-day Password Expiry Policy
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_policy_days INT NOT NULL DEFAULT 15;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS login_attempts (
  key VARCHAR(255) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  locked_until BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Extend sessions table for restricted password-change challenge & activity tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 3. Extend audit_logs table for rich security & business activity tracking
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_name VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_ref VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS outcome VARCHAR(50) DEFAULT 'SUCCESS';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- 4. Zoho Mail Center Persistent Tables
CREATE TABLE IF NOT EXISTS email_drafts (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  to_emails TEXT NOT NULL DEFAULT '',
  cc_emails TEXT DEFAULT '',
  bcc_emails TEXT DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_ref VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_history (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  to_emails TEXT NOT NULL,
  cc_emails TEXT DEFAULT '',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_ref VARCHAR(100),
  status VARCHAR(50) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'zoho_smtp',
  message_id VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_email_drafts_user ON email_drafts(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_history(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_history_quote ON email_history(quote_ref);

COMMIT;
