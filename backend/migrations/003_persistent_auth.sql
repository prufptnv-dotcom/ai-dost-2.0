-- AI-Dost 2.0 — Phase 5B: Persistent Authentication Schema (SQLite)
-- Strict idempotency, unique constraints, and composite indexes

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  username TEXT COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  token_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  family_id TEXT NOT NULL,
  replaced_by_token_id TEXT,
  revoked_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_agent_hash TEXT,
  ip_subnet TEXT,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_rt_token_hash ON auth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_rt_family_revoked ON auth_refresh_tokens(family_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_auth_rt_user_exp ON auth_refresh_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_rt_expires_at ON auth_refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_keyring (
  kid TEXT PRIMARY KEY,
  algorithm TEXT NOT NULL DEFAULT 'HS256',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_keyring_status ON auth_keyring(status, expires_at);
