-- AI-Dost 2.0 — Phase 5B: Persistent Authentication Schema (PostgreSQL)
-- Strict idempotency, unique constraints, and composite indexes

CREATE TABLE IF NOT EXISTS auth_users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(64),
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  token_version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_auth_users_email ON auth_users(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_auth_users_username ON auth_users(LOWER(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  family_id VARCHAR(64) NOT NULL,
  replaced_by_token_id VARCHAR(64),
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent_hash VARCHAR(128),
  ip_subnet VARCHAR(64)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_auth_rt_token_hash ON auth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_pg_auth_rt_family_revoked ON auth_refresh_tokens(family_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_pg_auth_rt_user_exp ON auth_refresh_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_pg_auth_rt_expires_at ON auth_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_keyring (
  kid VARCHAR(64) PRIMARY KEY,
  algorithm VARCHAR(16) NOT NULL DEFAULT 'HS256',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pg_auth_keyring_status ON auth_keyring(status, expires_at);
