# Phase 5: Production Rollback Runbook

## 1. Rollback Strategy Overview

In the event of an unrecoverable production failure or critical regression during deployment, this runbook defines the exact sequence to restore operations to the previous known good state.

---

## 2. Database Migration Rollback Classifications

| Migration | Version | Rollback Strategy | Reversibility | Action Required |
|---|---|---|---|---|
| `001_universal_schema` | 1 | **Backup Restore** | Irreversible without data drop | Restore database from pre-release snapshot |
| `002_agent_runtime` | 2 | **Forward Fix / Backup Restore** | Forward fix preferred | Restore database snapshot if schema corrupts |
| `003_agent_handoffs` | 3 | **Backup Restore** | Relational foreign keys present | Restore database snapshot |
| `004_agent_handoff_results` | 4 | **Backup Restore** | Result JSON column addition | Restore database snapshot |

> [!IMPORTANT]
> Because SQLite migrations in production use cascading foreign keys and active WAL checkpoints, forward-fixing code defects or restoring the pre-release backup snapshot (`app.db`) is the canonical rollback path.

---

## 3. Step-by-Step Production Rollback Procedure

### Step 1: Stop Running Processes
```bash
# Terminate Node.js and Next.js processes
killall node || taskkill /F /IM node.exe
```

### Step 2: Restore Canonical Database
```bash
# Replace active app.db with pre-deployment backup
cp backend/data/backups/pre_release_app.db backend/data/app.db
# Remove stale WAL and SHM files
rm -f backend/data/app.db-wal backend/data/app.db-shm
```

### Step 3: Revert Application Code
```bash
# Check out previous release tag
git checkout v1.9.0 # (or previous release commit)
```

### Step 4: Rebuild Frontend
```bash
cd frontend
npm run build
```

### Step 5: Restart Services & Verify Health
```bash
cd ../backend
node server.js &
cd ../frontend
npm run start -p 3000 &

# Verify Health
curl http://localhost:5000/api/health
```
