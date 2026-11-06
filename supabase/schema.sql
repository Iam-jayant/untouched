-- Untouched Dual-Mode Persistence Schema
-- Supports both Vercel Serverless (Supabase) and local dev (in-memory)

-- Users / Vaults
CREATE TABLE IF NOT EXISTS untouched_users (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  wallet_address TEXT,
  agent_signer_eoa TEXT,
  principal_usdc INTEGER DEFAULT 0, -- Start with $0
  yield_battery_usdc INTEGER DEFAULT 0,
  remaining_usdc INTEGER DEFAULT 0,
  max_per_call_usdc INTEGER DEFAULT 5000, -- $0.005
  usyc_nav_price NUMERIC DEFAULT 1.000000,
  deposit_timestamp BIGINT,
  last_activity BIGINT
);

-- API Keys
CREATE TABLE IF NOT EXISTS untouched_api_keys (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts (with execution trace)
CREATE TABLE IF NOT EXISTS untouched_receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usdc INTEGER NOT NULL,
  provider TEXT NOT NULL,
  free BOOLEAN DEFAULT FALSE,
  tx_hash TEXT,
  x402_signature TEXT,
  gateway_wallet TEXT,
  execution_trace JSONB
);

-- Pending Approvals (Deprecated - kept for migration)
CREATE TABLE IF NOT EXISTS untouched_pending_approvals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  model TEXT NOT NULL,
  estimated_cost_usdc INTEGER NOT NULL,
  required_action TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
);

-- NO SEED DATA - Users must connect wallet and deposit

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON untouched_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON untouched_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_api_key ON untouched_receipts(api_key);
CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON untouched_receipts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_api_key ON untouched_pending_approvals(api_key);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON untouched_pending_approvals(status);

