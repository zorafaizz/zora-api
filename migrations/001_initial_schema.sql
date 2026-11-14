-- 001_initial_schema.sql: KanjutGede API Initial Production Schema
-- Reversible Migration UP

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_frozen BOOLEAN DEFAULT FALSE,
  last_live_activity_at TIMESTAMPTZ DEFAULT NOW(),
  test_quota_remaining INT DEFAULT 50 CHECK (test_quota_remaining >= 0 AND test_quota_remaining <= 50),
  test_quota_allocated BOOLEAN DEFAULT TRUE
);

-- 2. OAuth Identities
CREATE TABLE IF NOT EXISTS oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

-- 3. API Keys Table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_id VARCHAR(32) UNIQUE NOT NULL,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  key_type VARCHAR(10) NOT NULL CHECK (key_type IN ('live', 'test')),
  label VARCHAR(100) DEFAULT 'Default Key',
  ip_allowlist JSONB DEFAULT '[]'::jsonb,
  scopes JSONB DEFAULT '["*"]'::jsonb,
  is_revoked BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk pencarian API Key yang ultra cepat
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_api_keys_account ON api_keys(account_id);

-- 4. Daily Quotas Table (Asia/Jakarta Quota Calendar Day)
CREATE TABLE IF NOT EXISTS daily_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL,
  used_count INT DEFAULT 0 CHECK (used_count >= 0),
  max_count INT DEFAULT 20 CHECK (max_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, quota_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quotas_lookup ON daily_quotas(account_id, quota_date);

-- 5. Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance_credits BIGINT DEFAULT 0 CHECK (balance_credits >= 0),
  reserved_credits BIGINT DEFAULT 0 CHECK (reserved_credits >= 0),
  currency VARCHAR(10) DEFAULT 'CREDIT',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Credit Ledger (Append-Only Double Entry Invariant)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  operation_type VARCHAR(50) NOT NULL,
  reference_id VARCHAR(255) NULL,
  actor VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_account ON credit_ledger(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_ref ON credit_ledger(reference_id);

-- 7. Credit Reservations (Reserve -> Execute -> Capture / Release)
CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  request_id VARCHAR(100) UNIQUE NOT NULL,
  endpoint_id VARCHAR(100) NOT NULL,
  reserved_amount BIGINT NOT NULL,
  status VARCHAR(20) DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'CAPTURED', 'RELEASED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credit_res_account ON credit_reservations(account_id, status);

-- 8. Invoices Table (Sandbox & Live Top-up Tracking)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  amount_idr BIGINT NOT NULL CHECK (amount_idr > 0),
  credit_amount BIGINT NOT NULL CHECK (credit_amount > 0),
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'FAILED')),
  provider VARCHAR(50) NOT NULL,
  provider_tx_id VARCHAR(255) NULL,
  paid_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_account ON invoices(account_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- 9. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NULL REFERENCES accounts(id) ON DELETE SET NULL,
  api_key_id UUID NULL REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint_id VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT NOT NULL,
  latency_ms INT NOT NULL,
  credits_charged BIGINT DEFAULT 0,
  quota_type VARCHAR(20) DEFAULT 'none',
  client_ip VARCHAR(45) NOT NULL,
  request_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_account ON audit_logs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON audit_logs(request_id);
