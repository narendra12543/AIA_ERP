-- ==============================================================================
-- AVEN MASTER ERP — MULTI-ACCOUNT ZOHO MAIL & SIGNATURE SYSTEM MIGRATION (009)
-- Transactional, additive, backward-compatible, idempotent.
-- Preserves all existing quotations, invoices, POs, users, finance, and mail history.
-- ==============================================================================

BEGIN;

-- 1. Dynamic Zoho Mailbox Registry & Encrypted OAuth Storage
CREATE TABLE IF NOT EXISTS mail_accounts (
  id VARCHAR(100) PRIMARY KEY,
  provider VARCHAR(40) NOT NULL DEFAULT 'zoho',
  provider_account_id VARCHAR(120),
  email_address VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL DEFAULT 'Aven Industrial Automation',
  mailbox_type VARCHAR(40) NOT NULL DEFAULT 'independent',
  parent_mailbox_id VARCHAR(100),
  allowed_send_as JSONB DEFAULT '[]'::jsonb,
  encrypted_refresh_token TEXT,
  encrypted_access_token TEXT,
  access_token_expires_at TIMESTAMP WITH TIME ZONE,
  granted_scopes TEXT,
  data_center VARCHAR(40) NOT NULL DEFAULT 'in',
  accounts_base_url VARCHAR(255) NOT NULL DEFAULT 'https://accounts.zoho.in',
  mail_base_url VARCHAR(255) NOT NULL DEFAULT 'https://mail.zoho.in',
  connection_status VARCHAR(40) NOT NULL DEFAULT 'Not Connected',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_by VARCHAR(150),
  connected_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mail_accounts (id, email_address, display_name, mailbox_type, connection_status, is_enabled, is_default, created_by)
VALUES
  ('mbx_info', 'info@avenautomation.in', 'Aven Industrial Automation', 'independent', 'Not Connected', true, false, 'system'),
  ('mbx_sales', 'sales@avenautomation.in', 'Aven Industrial Automation', 'independent', 'Not Connected', true, true, 'system'),
  ('mbx_purchase', 'purchase@avenautomation.in', 'Aven Industrial Automation', 'independent', 'Not Connected', true, false, 'system')
ON CONFLICT (email_address) DO NOTHING;

-- 2. Granular Role & User Mailbox Assignments
CREATE TABLE IF NOT EXISTS mail_account_permissions (
  id VARCHAR(100) PRIMARY KEY,
  mailbox_id VARCHAR(100) NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
  subject_type VARCHAR(20) NOT NULL, -- 'role' | 'user'
  subject_value VARCHAR(150) NOT NULL,
  can_read BOOLEAN NOT NULL DEFAULT true,
  can_compose BOOLEAN NOT NULL DEFAULT true,
  can_send BOOLEAN NOT NULL DEFAULT true,
  can_reply_forward BOOLEAN NOT NULL DEFAULT true,
  can_download_attachments BOOLEAN NOT NULL DEFAULT true,
  can_manage_folders BOOLEAN NOT NULL DEFAULT false,
  can_archive BOOLEAN NOT NULL DEFAULT true,
  can_trash BOOLEAN NOT NULL DEFAULT false,
  can_manage_labels BOOLEAN NOT NULL DEFAULT false,
  assigned_by VARCHAR(150),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mailbox_id, subject_type, subject_value)
);

-- Seed default mailbox assignments: Sales -> sales@, Purchase -> purchase@ (Admin has full access; Accounts/Store/Staff require explicit Admin assignment)
INSERT INTO mail_account_permissions (id, mailbox_id, subject_type, subject_value, can_read, can_compose, can_send, can_reply_forward, can_download_attachments, can_manage_folders, can_archive, can_trash, can_manage_labels, assigned_by)
VALUES
  ('mbxp_sales_default', 'mbx_sales', 'role', 'Sales', true, true, true, true, true, false, true, false, false, 'system'),
  ('mbxp_purchase_default', 'mbx_purchase', 'role', 'Purchase', true, true, true, true, true, false, true, false, false, 'system')
ON CONFLICT (mailbox_id, subject_type, subject_value) DO NOTHING;

-- 3. OAuth State & PKCE Verification Store (Single-Use, Expiring)
CREATE TABLE IF NOT EXISTS mail_oauth_states (
  state VARCHAR(128) PRIMARY KEY,
  mailbox_id VARCHAR(100) NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
  user_id VARCHAR(100) NOT NULL,
  code_verifier VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Lightweight Mailbox-Scoped Folder & Message Metadata Cache
CREATE TABLE IF NOT EXISTS mail_folders_cache (
  id VARCHAR(180) PRIMARY KEY,
  mailbox_id VARCHAR(100) NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
  folder_id VARCHAR(120) NOT NULL,
  folder_name VARCHAR(255) NOT NULL,
  folder_type VARCHAR(60),
  unread_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mailbox_id, folder_id)
);

CREATE TABLE IF NOT EXISTS mail_messages_cache (
  id VARCHAR(220) PRIMARY KEY,
  mailbox_id VARCHAR(100) NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
  folder_id VARCHAR(120) NOT NULL,
  message_id VARCHAR(120) NOT NULL,
  thread_id VARCHAR(120),
  subject TEXT,
  from_address VARCHAR(255),
  from_name VARCHAR(255),
  to_addresses TEXT,
  summary TEXT,
  received_time BIGINT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  has_attachment BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  labels JSONB DEFAULT '[]'::jsonb,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(mailbox_id, folder_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_mail_messages_cache_mbx_folder ON mail_messages_cache(mailbox_id, folder_id, received_time DESC);
CREATE INDEX IF NOT EXISTS idx_mail_messages_cache_from ON mail_messages_cache(LOWER(from_address));

-- 5. Extend Existing email_drafts & email_history Non-Destructively
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS mailbox_id VARCHAR(100);
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS provider_draft_id VARCHAR(120);
ALTER TABLE email_drafts ADD COLUMN IF NOT EXISTS client_id VARCHAR(100);

ALTER TABLE email_history ADD COLUMN IF NOT EXISTS mailbox_id VARCHAR(100);
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS folder_id VARCHAR(120);
ALTER TABLE email_history ADD COLUMN IF NOT EXISTS client_id VARCHAR(100);

-- 6. Extend email_signatures & Add Per-User/Mailbox Signature Preferences
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS mailbox_id VARCHAR(100);
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS assigned_mailbox_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS assigned_roles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS assigned_user_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS template_key VARCHAR(60) DEFAULT 'classic_corporate';
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS locked_branding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE email_signatures ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS mail_signature_preferences (
  id VARCHAR(180) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  mailbox_id VARCHAR(100) NOT NULL DEFAULT 'all',
  auto_new BOOLEAN NOT NULL DEFAULT true,
  auto_reply BOOLEAN NOT NULL DEFAULT true,
  auto_reply_all BOOLEAN NOT NULL DEFAULT true,
  auto_forward BOOLEAN NOT NULL DEFAULT true,
  default_signature_id VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, mailbox_id)
);

COMMIT;
