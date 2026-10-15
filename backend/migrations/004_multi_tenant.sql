-- AI-Dost 2.0 — Phase 5C: Multi-Tenant Schema & Isolation (SQLite)
-- Strict idempotency, composite uniqueness constraints, composite indexes, and foreign keys

-- 1. Tenants / Workspaces / Organizations
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'active',
  owner_id TEXT NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 10,
  max_projects INTEGER NOT NULL DEFAULT 50,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 5,
  max_storage_bytes INTEGER NOT NULL DEFAULT 524288000,
  max_concurrent_sandboxes INTEGER NOT NULL DEFAULT 2,
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2. Tenant Memberships
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'invited' | 'suspended'
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON tenant_memberships(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_role ON tenant_memberships(tenant_id, role, status);

-- 3. Tenant Audit Logs
CREATE TABLE IF NOT EXISTS tenant_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS', -- 'SUCCESS' | 'DENIED' | 'FAILED'
  ip_address TEXT,
  details TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tenant_audit_tenant_time ON tenant_audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tenant_audit_action ON tenant_audit_logs(action, status);

-- 4. Multi-Tenant Resource Tables (Nullable tenant_id to support legacy un-scoped data migration)
CREATE TABLE IF NOT EXISTS tenant_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tenant_projects_lookup ON tenant_projects(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_tenant_projects_user ON tenant_projects(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS tenant_files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  project_id TEXT,
  user_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tenant_files_lookup ON tenant_files(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_tenant_files_project ON tenant_files(tenant_id, project_id);

CREATE TABLE IF NOT EXISTS tenant_chat_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tenant_chats_lookup ON tenant_chat_sessions(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_tenant_chats_user ON tenant_chat_sessions(tenant_id, user_id);
