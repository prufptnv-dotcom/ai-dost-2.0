# AI-Dost — System Scaling Boundaries

**Document Type:** Scaling Architecture Contract  
**Status:** Architectural targets — no implementation changes authorized  
**Date:** 2026-09-01

---

## 1. Scaling Tiers

### LOCAL (Current)

```
Single Node.js process
  + SQLite (single file, WAL mode)
  + Optional Python ai-engine (single process)
  + Local filesystem workspace
  + In-process LockManager
  + In-process TaskScheduler
```

**Characteristics:**
- Zero infrastructure requirements beyond Node.js
- All state in `backend/data/app.db`
- In-process mutation serialization via `LockManager`
- MAX_ACTIVE_WORKERS_PER_PROJECT = 10 (in-process)
- MAX_DELEGATION_DEPTH = 3
- MAX_REPAIR_CYCLES = 3

**Scaling Limits:**
- Single-user / single-machine
- No horizontal scaling
- SQLite write serialization (WAL helps, but single-writer)
- In-process locks not shared across processes

---

### STANDARD SERVER

```
Single-node services
  + SQLite or PostgreSQL
  + Reverse proxy (nginx)
  + Process manager (PM2 / systemd)
  + Optional: Redis for session/cache
```

**Characteristics:**
- PM2 cluster mode possible (requires shared DB — PostgreSQL recommended)
- Reverse proxy handles TLS, rate limiting
- Process restart with checkpoint recovery
- Same application contracts as LOCAL

**Required Changes (not yet implemented):**
- Database abstraction layer (SQLite → PostgreSQL adapter)
- External session store if clustering
- Health endpoint monitoring

---

### SCALE

```
PostgreSQL (persistent state)
  + Object storage (artifacts: S3/GCS)
  + Redis / RabbitMQ (job queue)
  + Worker pool (agent execution)
  + Managed vector DB (RAG: Qdrant/Weaviate)
  + Container orchestration (Docker/K8s)
  + CDN (frontend static assets)
  + Observability stack (Prometheus/Grafana/Jaeger)
```

**Characteristics:**
- Horizontal Express backends (stateless)
- Queue-based agent execution (decouple request from execution)
- Distributed workspace storage
- Multi-tenant isolation at DB level
- Auto-scaling worker pools

**Required Changes (not yet implemented):**
- Database adapter (PostgreSQL)
- Queue-based ExecutionController
- Object storage adapter for WorkspaceManager/ArtifactService
- Distributed LockManager (Redis-based)
- External RAG backend (managed vector DB)
- JWT/OAuth authentication (replace local-user assumption)
- Multi-tenant project isolation (beyond single-user model)

---

## 2. Current Abstraction Readiness

| Abstraction | LOCAL Ready | STANDARD Ready | SCALE Ready | Gap |
|-------------|-----------|----------------|------------|-----|
| **Database** | ✅ SQLite | ⚠️ Needs adapter | ❌ No PG adapter | `db/index.js` hardcodes better-sqlite3 |
| **Workspace** | ✅ Local disk | ✅ Same | ❌ No object storage | `WorkspaceManager` assumes `fs.*` |
| **Artifacts** | ✅ Local disk | ✅ Same | ❌ No object storage | `ArtifactService` uses `fs.writeFileSync` |
| **Agent Execution** | ✅ In-process | ✅ Same | ❌ No queue | `AgentCoordinator` runs in-process |
| **Locks** | ✅ In-process Map | ✅ Same (single-node) | ❌ No distributed | `LockManager` uses in-memory Map |
| **RAG** | ✅ Local ChromaDB | ✅ Same | ❌ No managed DB | `RetrievalService` hits local ai-engine |
| **Auth** | ✅ `local-user` | ⚠️ Needs real auth | ❌ No JWT/OAuth | Hardcoded user assumption |
| **Frontend** | ✅ Next.js dev | ✅ Same | ⚠️ Needs CDN build | Works but not optimized for CDN |

---

## 3. Non-Blocking Abstractions (Safe Today)

These current patterns will NOT obstruct future scaling:

| Pattern | Why It's Safe |
|---------|---------------|
| DAO layer (15 DAOs) | Clean separation; can swap DB driver behind DAOs |
| CapabilityPolicy | Static policy; same across all scales |
| ToolRegistry | In-process registry; tools are stateless |
| ResultValidator | Pure validation; no state dependency |
| VerificationContract | Pure contract; no infrastructure coupling |
| SupervisorArbitrator | Pure decision logic; no infrastructure coupling |
| ContextBudgetManager | Configurable budgets; profile-selectable |
| RetrievalService boundary | HTTP client to ai-engine; can point to any backend |
| IndexSyncService boundary | HTTP push; can push to any index backend |

---

## 4. Blocking Abstractions (Must Change for Scale)

| Abstraction | Current | Scale Requirement | Effort |
|-------------|---------|-------------------|--------|
| `db/index.js` | Direct `require('better-sqlite3')` | Database adapter interface | Medium |
| `server.js` L15,29 | Direct `require('better-sqlite3')` | Remove duplicate init | Low |
| `WorkspaceManager` | `fs.existsSync`, `fs.readFileSync` | Storage adapter interface | Medium |
| `ArtifactService` | `fs.writeFileSync` | Storage adapter interface | Medium |
| `LockManager` | `new Map()` in-process | Redis/Redlock adapter | Medium |
| `AgentCoordinator.startWorker` | `await` in-process | Queue dispatch | High |
| Auth model | `'local-user'` hardcoded | JWT/OAuth provider | High |

---

## 5. Scaling Boundaries (Targets, Not Claims)

| Metric | LOCAL | STANDARD | SCALE |
|--------|-------|----------|-------|
| Concurrent users | 1 | 1-5 | 100+ |
| Active agent workers | 10/project | 10/project | Configurable |
| Database | SQLite (single file) | SQLite or PostgreSQL | PostgreSQL |
| Artifact storage | Local disk | Local disk | Object storage |
| RAG index | Local ChromaDB | Local ChromaDB | Managed vector DB |
| Workspace storage | Local filesystem | Local filesystem | Distributed / object |
| Agent execution | In-process | In-process | Queue + worker pool |

> [!IMPORTANT]
> These are **architectural targets**. No implementation changes are being made now.

---

## 6. Migration Priority Order

When scaling work begins, the recommended implementation order:

1. **Database abstraction** — highest impact, enables PostgreSQL
2. **Authentication** — required for multi-user
3. **Queue-based execution** — enables horizontal workers
4. **Storage abstraction** — enables object storage for artifacts/workspaces
5. **Distributed locks** — enables multi-process mutation safety
6. **Managed RAG backend** — enables scalable vector search
7. **Frontend CDN build** — enables global distribution

Each migration should be a separate, testable phase with its own evidence gate.

---

## 7. What This Document Does NOT Authorize

- Installing PostgreSQL
- Installing Redis
- Adding queue infrastructure
- Adding object storage
- Modifying application source code
- Changing database drivers
- Adding authentication frameworks
- Deploying to cloud
