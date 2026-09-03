# AI-Dost — Runtime Profiles

**Document Type:** Runtime Architecture Contract  
**Status:** FROZEN (Contracts only — no implementation changes)  
**Date:** 2026-09-01

---

## 1. Purpose

AI-Dost must deliver the same product experience across:

- Low-end PC / mobile browser
- Normal desktop / laptop
- High-end workstation / server deployment

This document defines three runtime profiles that share the **same logical application contracts** but differ in resource utilization.

---

## 2. Profile A — LIGHT

**Target:** Mobile client, low-resource devices, tablet browsers

| Dimension | Specification |
|-----------|--------------|
| **Client** | Lightweight web client (PWA) |
| **Local state** | Minimal — session token + chat history cache only |
| **Communication** | Streaming API (SSE or WebSocket) to remote backend |
| **AI execution** | Remote only — no local model inference |
| **RAG** | Remote only — no local vector index |
| **Indexing** | None locally; server-side only |
| **Database** | None locally; all persistence on backend |
| **Concurrency** | Single conversation stream |
| **Offline** | Service worker shell caching (existing `sw.js`) |

### Mental Model

```
Mobile Browser (PWA)
  → authenticated streaming API
  → autonomous runtime (on server)
  → result / artifact stream
  → mobile-friendly UI rendering
```

The mobile client is a **view layer only**. It sends intents and receives delivery streams.

---

## 3. Profile B — STANDARD

**Target:** Normal desktop / laptop (8-16 GB RAM)

| Dimension | Specification |
|-----------|--------------|
| **Client** | Next.js frontend (existing) |
| **Local state** | Full localStorage, session state |
| **Communication** | Socket.IO + REST (existing) |
| **AI execution** | Remote cascade (Gemini → Groq → …) + optional local Ollama |
| **RAG** | Optional local ChromaDB via ai-engine |
| **Indexing** | Optional workspace indexing via IndexSyncService |
| **Database** | SQLite (better-sqlite3) — single file `app.db` |
| **Concurrency** | Standard agent execution (MAX_ACTIVE_WORKERS = 10) |
| **Offline** | Partial — Ollama fallback for AI; full workspace access |

### Mental Model

```
Next.js Frontend (localhost:3000)
  → Express Backend (localhost:5000)
  → SQLite Universal DB
  → Optional ai-engine (localhost:8001)
  → Remote LLM cascade
  → Workspace on disk
```

This is the **current default** deployment model.

---

## 4. Profile C — SCALE

**Target:** High-end workstation, server, team deployment

| Dimension | Specification |
|-----------|--------------|
| **Client** | Same frontend, potentially served from CDN |
| **Communication** | WebSocket + REST behind reverse proxy |
| **AI execution** | Dedicated model endpoints, multiple concurrent |
| **RAG** | Scalable vector store (e.g., Qdrant, Weaviate, managed ChromaDB) |
| **Indexing** | Background worker-based indexing pipeline |
| **Database** | PostgreSQL (migration from SQLite) |
| **Concurrency** | Distributed workers, queue-based agent execution |
| **Storage** | Object storage (S3/GCS) for artifacts |
| **Observability** | Structured logging, metrics, tracing |

### Mental Model

```
CDN / Frontend
  → Load Balancer
  → Express Backend (stateless, horizontal)
  → PostgreSQL (persistent state)
  → Redis (queue / cache)
  → Worker Pool (agent execution)
  → Object Storage (artifacts)
  → Managed Vector DB (RAG)
```

> **NOTE:** Profile C is an architectural **target**, not a current implementation. Current abstractions must not make the transition unnecessarily difficult.

---

## 5. Contract Compatibility Matrix

All three profiles share these contracts:

| Contract | LIGHT | STANDARD | SCALE |
|----------|-------|----------|-------|
| Chat intent → delivery | ✅ Streaming API | ✅ Socket.IO/REST | ✅ Queue + SSE |
| Auth / project isolation | ✅ Token-based | ✅ `projectAuthorization` | ✅ JWT + RBAC |
| Workspace access | ❌ N/A (remote) | ✅ Local disk | ✅ Object storage |
| Agent execution pipeline | ✅ Remote | ✅ Local single-process | ✅ Distributed workers |
| Checkpoint / resume | ✅ Server-side | ✅ SQLite | ✅ PostgreSQL |
| RAG retrieval | ✅ Server-side | ✅ Optional local | ✅ Managed vector DB |
| Artifact persistence | ✅ Server-side | ✅ Local disk + DB | ✅ Object storage + DB |
| Tool capability policy | ✅ Same | ✅ Same | ✅ Same |

---

## 6. Resource-Aware Execution Profiles

The runtime selects appropriate execution strategies without changing the user's mental model:

| Profile | Context Budget | Concurrency | Indexing | AI Provider |
|---------|---------------|-------------|----------|-------------|
| **LIGHT** | 50K tokens | 1 worker | None | Remote only |
| **STANDARD** | 100K tokens | 10 workers | Optional local | Remote cascade + optional Ollama |
| **HEAVY** | 200K+ tokens | Unbounded (queue) | Background workers | Dedicated endpoints |

---

## 7. Current Architecture Readiness for Each Profile

| Aspect | LIGHT Ready? | STANDARD Ready? | SCALE Ready? |
|--------|-------------|-----------------|-------------|
| Frontend as thin client | ✅ PWA manifest + sw.js exist | ✅ Current model | ⚠️ Needs CDN/static build |
| Streaming API | ✅ SSE exists in `/api/agent/run` | ✅ Socket.IO | ⚠️ Needs queue-based |
| Database abstraction | ❌ `better-sqlite3` hardcoded in `db/index.js` | ✅ Works | ❌ No PostgreSQL adapter |
| Workspace abstraction | ❌ N/A | ✅ `WorkspaceManager` | ⚠️ Needs object storage adapter |
| Agent execution | ✅ Remote via API | ✅ Single-process | ⚠️ Needs worker pool |
| RAG abstraction | ✅ Server-side | ✅ RetrievalService boundary | ⚠️ Needs configurable backend |

### Key Gaps for Future Scale

1. **Database driver**: `better-sqlite3` is imported directly in `db/index.js` and `server.js`. A driver abstraction layer is needed for PostgreSQL migration path.
2. **Workspace storage**: `WorkspaceManager` assumes local disk. Object storage adapter needed.
3. **Worker execution**: `AgentCoordinator` runs in-process. Queue-based execution needed.
4. **Configuration**: Runtime profile selection not yet implemented — hardcoded to STANDARD.

> **IMPORTANT:** These gaps are documented as architectural targets. No implementation changes are authorized under this document.

---

## 8. Mobile Architecture (LIGHT Profile)

Mobile is treated **primarily as a client experience**:

```
Mobile PWA client
  → authenticated streaming API (existing SSE + REST)
  → autonomous runtime (on backend server)
  → result / artifact stream
  → mobile-responsive UI rendering
```

**Rules:**

1. Do NOT attempt to run the heavy autonomous backend inside the mobile browser
2. Do NOT require local SQLite, Ollama, or ChromaDB on mobile
3. The same chat interaction must work regardless of backend runtime profile
4. Telegram bot provides an alternative mobile-first interface (already implemented)

---

## 9. Performance Baselines

| Metric | Measured Value | Source |
|--------|---------------|--------|
| Backend startup time | NOT MEASURED | — |
| Chat first-token latency | NOT MEASURED | — |
| Average tool latency | NOT MEASURED | — |
| DB query latency | NOT MEASURED | — |
| Workspace scan (10K files) | 16ms | Phase 4.1 audit |
| RAG retrieval latency | NOT MEASURED | — |
| Memory usage (idle) | 52.32 MB RSS | Phase 4.1 audit (10K files benchmark) |
| Agent execution overhead | NOT MEASURED | — |

> **NOTE:** Performance optimization must be based on actual measurements, not assumptions. Values marked NOT MEASURED require instrumentation before optimization decisions.
