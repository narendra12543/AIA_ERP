-- ==============================================================================
-- AVEN MASTER ERP — ENTERPRISE SECURITY HARDENING MIGRATION (004)
-- Transactional, backward-compatible, idempotent.
-- Preserves all existing quotations, clients, vendors, signatures, and users.
-- ==============================================================================

BEGIN;

-- 1. Account Approval, Lifecycle & MFA Columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40) NOT NULL DEFAULT 'Pending Approval';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_modified_by VARCHAR(150);

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_hashes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_used_step BIGINT;

-- Safe backward-compatible migration for existing legitimate active accounts
-- (Never locks out the existing active Admin; unknown/inactive accounts remain unapproved)
UPDATE users
SET approval_status = 'Approved',
    approved_by = COALESCE(approved_by, 'system_legacy_migration'),
    approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP)
WHERE status = 'active'
  AND approval_status = 'Pending Approval'
  AND created_by IS NULL;

-- 2. Extend sessions for DB-backed token hashing, device binding & MFA tracking
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash VARCHAR(128);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_approx VARCHAR(80);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS mfa_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_verified BOOLEAN NOT NULL DEFAULT false;

-- 3. Short-Lived Atomic Auth Challenges (MFA & Enrollment)
CREATE TABLE IF NOT EXISTS auth_challenges (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(40) NOT NULL, -- 'mfa_login' | 'mfa_enroll' | 'reauth'
  challenge_token_hash VARCHAR(128) UNIQUE NOT NULL,
  temp_secret_enc TEXT,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  consumed BOOLEAN NOT NULL DEFAULT false,
  ip_approx VARCHAR(80),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Trusted Devices & Admin Device Approval Table
CREATE TABLE IF NOT EXISTS trusted_devices (
  id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_hash VARCHAR(128) UNIQUE NOT NULL,
  device_name VARCHAR(150),
  browser VARCHAR(100),
  os VARCHAR(100),
  ip_approx VARCHAR(80),
  approval_status VARCHAR(40) NOT NULL DEFAULT 'Pending Approval', -- Pending Approval | Approved | Rejected | Revoked | Blocked
  approved_by VARCHAR(150),
  approved_at TIMESTAMP WITH TIME ZONE,
  first_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- 5. Security Alerts Table (Real Admin Security Center Notifications)
CREATE TABLE IF NOT EXISTS security_alerts (
  id VARCHAR(100) PRIMARY KEY,
  severity VARCHAR(20) NOT NULL DEFAULT 'warning', -- info | warning | critical
  category VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  actor_email VARCHAR(255),
  target_ref VARCHAR(150),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by VARCHAR(150),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Distributed Rate Limits Table (Serverless-safe PostgreSQL rate limiter)
CREATE TABLE IF NOT EXISTS rate_limits (
  key VARCHAR(255) PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_alerts_ack ON security_alerts(acknowledged, created_at DESC);

COMMIT;
