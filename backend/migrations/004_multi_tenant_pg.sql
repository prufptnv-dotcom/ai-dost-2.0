-- AI-Dost 2.0 — Phase 5C: Multi-Tenant Schema & Row-Level Security (PostgreSQL)
-- Fully compatible with PostgreSQL 14+, Row-Level Security (RLS), and UTC TIMESTAMPTZ

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  owner_id VARCHAR(64) NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 10,
  max_projects INTEGER NOT NULL DEFAULT 50,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 5,
  max_storage_bytes BIGINT NOT NULL DEFAULT 524288000,
  max_concurrent_sandboxes INTEGER NOT NULL DEFAULT 2,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pg_tenants_slug ON tenants(LOWER(slug));
CREATE INDEX IF NOT EXISTS idx_pg_tenants_owner ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_pg_tenants_status ON tenants(status);

-- 2. Tenant Memberships
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'invited' | 'suspended'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pg_memberships_user ON tenant_memberships(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_pg_memberships_tenant_role ON tenant_memberships(tenant_id, role, status);

-- 3. Tenant Audit Logs
CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  ip_address VARCHAR(45),
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_tenant_audit_time ON tenant_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_tenant_audit_action ON tenant_audit_logs(action, status);

-- 4. Multi-Tenant Resource Tables
CREATE TABLE IF NOT EXISTS tenant_projects (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_tenant_projects_lookup ON tenant_projects(tenant_id, id);

CREATE TABLE IF NOT EXISTS tenant_files (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id VARCHAR(64),
  user_id VARCHAR(64) NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_tenant_files_lookup ON tenant_files(tenant_id, id);

CREATE TABLE IF NOT EXISTS tenant_chat_sessions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_tenant_chats_lookup ON tenant_chat_sessions(tenant_id, id);

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_audit_logs ENABLE ROW LEVEL SECURITY;
