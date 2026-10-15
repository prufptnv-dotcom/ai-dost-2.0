# Phase 4.2: Production Deployment & Operations Runbook

## 1. Environment Requirements & Prerequisites

- **Node.js**: `v20.x` or `v22.x` LTS
- **Python**: `3.10+` (optional for local RAG engine)
- **OS**: Linux (Ubuntu 22.04+), macOS 14+, or Windows Server 2022 / Windows 11
- **Memory**: 4GB Minimum (8GB+ recommended for local Ollama / RAG embeddings)

---

## 2. Production Startup Sequence

### Step 1: Initialize Database & Run Migrations
```bash
cd backend
npm install --production
# Migrations run automatically on application bootstrap via backend/db/index.js
```

### Step 2: Start Backend Server
```bash
NODE_ENV=production PORT=5000 node server.js
```

### Step 3: Start Next.js Frontend
```bash
cd ../frontend
npm install --production
npm run build
npm run start -p 3000
```

### Step 4 (Optional): Start Python AI Engine
```bash
cd ../ai-engine
./start_ai_engine.bat # or uvicorn main:app --host 127.0.0.1 --port 8001
```

---

## 3. Production Health Checks & Monitoring

- **Core API Health**: `GET http://localhost:5000/api/health` -> `{ status: "ok", uptime: ..., database: "healthy" }`
- **Circuit Breaker Status**: `GET http://localhost:5000/api/circuit-breaker`
- **Quota & Model Status**: `GET http://localhost:5000/api/quota-status`

---

## 4. Disaster Recovery & Backup

### Canonical Database Backup
```bash
# SQLite Online Backup (safe during active writes under WAL)
sqlite3 backend/data/app.db ".backup 'backend/data/backups/app_backup_$(date +%Y%m%d_%H%M%S).db'"
```

### Full System Restore
1. Stop backend service.
2. Restore database file to `backend/data/app.db`.
3. Restore workspace directories from backup storage to `%TEMP%/agent-ws-*`.
4. Start backend service. The `IndexSyncService` will automatically reconstruct vector indices if missing.
