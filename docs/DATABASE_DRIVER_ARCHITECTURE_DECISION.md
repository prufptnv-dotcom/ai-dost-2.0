# Database Driver Architecture Decision

**Document Type:** Architecture Decision Record (ADR)  
**Status:** ANALYSIS COMPLETE — No driver change authorized  
**Date:** 2026-09-01

---

## 1. Current Implementation

| Aspect | Detail |
|--------|--------|
| **Driver** | `better-sqlite3` v13.0.3 |
| **Import locations** | `backend/db/index.js` (L1), `backend/server.js` (L15, L29) |
| **Database file** | `backend/data/app.db` |
| **Journal mode** | WAL (set in both `db/index.js` L25 and `server.js` L32) |
| **Foreign keys** | ON (`db/index.js` L26) |
| **Busy timeout** | 5000ms (`db/index.js` L27) |
| **Migration system** | Versioned runner with 4 migrations |
| **DAO layer** | 15 DAO classes in `backend/db/dao/` |
| **Schema tables** | users, projects, workspaces, conversations, messages, artifacts, context_nodes, context_edges, agent_tasks, agent_runs, agent_steps, tool_calls, observations, verification_results, agent_handoffs + legacy tables (workspace_files, chat_history, resumes) |

### Dual Initialization Issue

> [!WARNING]
> SQLite is initialized **twice**: once in `server.js` L28-29 via `new Database(dbPath)` (legacy path) and once in `db/index.js` via `initDatabase()` (Phase 1.2+ universal path). Both set WAL mode. The legacy initialization in `server.js` creates tables (`projects`, `workspace_files`, `chat_history`, `resumes`) that overlap with migration 001. This is not a data-corruption risk (both are idempotent `CREATE TABLE IF NOT EXISTS`), but it is a **tech debt smell** that should be consolidated.

---

## 2. Alternatives Evaluated

### 2.1 better-sqlite3 (Current)

| Criterion | Assessment |
|-----------|-----------|
| Startup cost | **Fast** — synchronous native binding, no connection pool overhead |
| Runtime performance | **Excellent** — synchronous C++ binding, no event-loop blocking for small queries |
| Memory usage | **Low** — single process, single file |
| Sync/Async model | **Synchronous** — all DAO calls are synchronous (`.get()`, `.all()`, `.run()`) |
| Transaction support | **Full** — `db.transaction()` |
| WAL support | **Full** |
| Foreign key support | **Full** (via pragma) |
| Busy timeout | **Full** (via pragma) |
| Migration compatibility | **Full** — current 4 migrations work |
| Backup support | **Full** — `db.backup()` API |
| Windows compatibility | **Requires native C++ build** — needs Visual Studio Build Tools with MSVC, MSBuild, Windows SDK |
| Linux compatibility | **Excellent** — prebuilt binaries usually available |
| Deployment complexity | **Medium** — native build requirement on Windows is the current Phase 5.5 blocker |
| Mobile impact | **None** — SQLite runs on backend only |
| Long-term maintainability | **Good** — actively maintained, widely used |
| PostgreSQL migration path | **Requires driver abstraction** — synchronous API incompatible with async pg drivers |

### 2.2 sqlite3 (node-sqlite3)

| Criterion | Assessment |
|-----------|-----------|
| Startup cost | **Moderate** — asynchronous, callback-based |
| Runtime performance | **Good** — async I/O, but callback overhead |
| Memory usage | **Low** |
| Sync/Async model | **Asynchronous (callback-based)** — ALL 15 DAOs would need rewriting |
| Transaction support | **Full** (via `db.run('BEGIN')`) |
| WAL support | **Full** |
| Foreign key support | **Full** (via pragma) |
| Busy timeout | **Partial** — via `db.configure('busyTimeout', ms)` |
| Migration compatibility | **Requires rewrite** — all migrations use synchronous `db.exec()` |
| Backup support | **No built-in** |
| Windows compatibility | **Same native build requirement** — also needs node-gyp + MSVC |
| Linux compatibility | **Good** — prebuilt binaries available |
| Deployment complexity | **Same as better-sqlite3** — still needs native compilation |
| Mobile impact | None |
| Long-term maintainability | **Declining** — fewer recent updates than better-sqlite3 |
| PostgreSQL migration path | **Slightly easier** — already async, but different API surface |

> [!IMPORTANT]
> Replacing `better-sqlite3` with `sqlite3` **does NOT solve the Windows native build blocker**. Both require the same C++ toolchain. It would also require rewriting all 15 DAOs, all 4 migrations, and the `db/index.js` initialization from synchronous to asynchronous.

### 2.3 Node.js Built-in SQLite (node:sqlite)

| Criterion | Assessment |
|-----------|-----------|
| Availability | **Experimental** — available in Node.js 22.5.0+ behind `--experimental-sqlite` flag |
| Current Node target | v24.19.0 — flag may still be required |
| API surface | **Synchronous** — similar to better-sqlite3 |
| Stability | **Not production-ready** — API may change between Node versions |
| WAL support | Likely via pragma (undocumented) |
| Windows compatibility | **No native build required** — bundled with Node.js |
| Migration compatibility | **Potentially compatible** — similar sync API |
| Risk | **High** — experimental, undocumented edge cases, breaking changes possible |

> [!CAUTION]
> Node.js built-in SQLite eliminates the native build requirement but introduces stability risk. It is experimental and the API surface is not yet frozen. Not recommended for production use.

### 2.4 sql.js (SQLite compiled to WebAssembly)

| Criterion | Assessment |
|-----------|-----------|
| Startup cost | **Slow** — loads WASM binary |
| Runtime performance | **Moderate** — WASM overhead vs native |
| Memory usage | **Higher** — entire DB in memory |
| Sync/Async model | **Synchronous** |
| Windows compatibility | **No native build required** — pure JavaScript/WASM |
| Migration compatibility | **Potentially compatible** — similar sync API |
| Backup support | **Manual** — serialize/deserialize |
| Risk | **Medium** — performance degradation for large DBs |

---

## 3. Risk Analysis

| Risk | better-sqlite3 | sqlite3 | node:sqlite | sql.js |
|------|---------------|---------|-------------|--------|
| Windows build blocker | **YES (current)** | YES | No | No |
| DAO rewrite required | No | YES (15 DAOs) | Minimal | Minimal |
| Migration rewrite | No | YES | Minimal | Minimal |
| Production stability | Proven | Proven | Experimental | Proven (limited scale) |
| Performance risk | None | Minor (async overhead) | Unknown | Moderate (WASM) |
| Node version coupling | None | None | **HIGH** | None |

---

## 4. Migration Complexity

| Path | Effort | Risk |
|------|--------|------|
| Keep better-sqlite3 | **Zero** | Windows build toolchain required |
| better-sqlite3 → sqlite3 | **High** (rewrite 15 DAOs + 4 migrations + db/index.js) | Same native build issue |
| better-sqlite3 → node:sqlite | **Low-Medium** (similar sync API) | Experimental stability |
| better-sqlite3 → sql.js | **Medium** (API differences, memory model) | Performance regression |
| SQLite → PostgreSQL (future) | **High** (driver abstraction, async rewrite, schema migration) | Scope of Profile C |

---

## 5. Measured / Verified Facts

| Fact | Source |
|------|--------|
| better-sqlite3 v13.0.3 locked in package-lock.json | `backend/package.json` L21 |
| 15 DAOs use synchronous `.get()`, `.all()`, `.run()` | `backend/db/dao/*.js` |
| 4 versioned migrations use synchronous `db.exec()` | `backend/db/migrations/` |
| WAL, FK, busy_timeout configured | `backend/db/index.js` L25-27 |
| 10,000 files workspace scan: 16ms, 52 MB RSS | Phase 4.1 evidence |
| 394 tests pass with current driver | Phase 5.1 release sign-off |
| Windows native build requires VS Build Tools + MSVC | Phase 5.5 diagnosis |
| `sqlite3` (node-sqlite3) requires the **same** native toolchain | npm documentation |

---

## 6. Final Recommendation

### Short-term (Now): **KEEP better-sqlite3**

**Rationale:**
1. The Windows build blocker is an **environment provisioning issue**, not an architectural defect
2. Replacing with `sqlite3` does NOT solve the native build problem and requires massive DAO rewriting
3. `node:sqlite` is experimental and not production-ready
4. `sql.js` has performance regression risk
5. 394 tests pass with the current driver
6. All 15 DAOs and 4 migrations are built for the synchronous API

**Required action:** Install Visual Studio 2022 Build Tools with C++ workload on the development machine (environment fix, not code fix).

### Medium-term: **Introduce a database abstraction layer**

Before migrating to Profile C (PostgreSQL), create a thin abstraction:

```
DatabaseAdapter (interface)
  ├── SqliteAdapter (better-sqlite3, synchronous)
  └── PostgresAdapter (pg, asynchronous — future)
```

This abstraction should be introduced when Profile C work begins, not now.

### Long-term: **PostgreSQL for Profile C**

When team/server deployment is needed, migrate to PostgreSQL using the database adapter layer. This is an architectural target, not a current task.

---

## 7. Decision

```
DATABASE STRATEGY: KEEP better-sqlite3

Reason: Environment issue, not architectural defect.
Action: Install VS Build Tools (environment fix).
Future: Database abstraction layer when Profile C work begins.
```

**Do NOT change the database driver during this phase.**
