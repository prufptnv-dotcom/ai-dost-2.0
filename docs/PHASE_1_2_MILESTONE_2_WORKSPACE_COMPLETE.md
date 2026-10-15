# Phase 1.2 — Milestone 2: Workspace Lifecycle Consolidation Specification

> **Document Type:** Technical Completion Specification  
> **Status:** MILESTONE 2 VERIFIED — PENDING ARCHITECTURAL REVIEW  
> **Scope:** Workspace Lifecycle Consolidation  
> **Baseline Commit:** `9c5d44c` (`feat(agent): implement playwright visual verification loop`)

---

## 1. Problem Statement & Background

Prior to this milestone, workspace resolution, existence verification, path security, and physical directory creation were independently duplicated and hardcoded across:
* `backend/services/projectService.js` (inline directory creation and `workspaces` table record creation)
* `backend/sandbox/devServerManager.js` (`_workspaceDir(projectId)` hardcoding `%TEMP%/agent-ws-<id>`)
* `backend/routes/preview.js` (`workspaceOf(projectId)` and manual `safeJoin` logic)
* `backend/sockets/terminal.js` (inline path construction)
* `backend/services/artifactService.js` (hardcoded workspace path boundary checks)

This caused fragmented path definitions, inconsistent traversal guards, and a lack of unified ownership enforcement.

---

## 2. WorkspaceManager Architecture & Design

[`backend/services/workspaceManager.js`](file:///c:/Users/vikash%20kumar/Desktop/ai-dost%20version%202.o/backend/services/workspaceManager.js) has been implemented as the single canonical workspace lifecycle boundary for AI-Dost:

```text
                               ProjectService
                                     │
                                     ▼
                              WorkspaceManager
                         ┌───────────┼───────────┐
                         ▼           ▼           ▼
                   Physical FS   Dev Server   Preview / Terminal
                         │           │           │
                         └───────────┼───────────┘
                                     ▼
                        %TEMP%/agent-ws-<projectId>
```

### Core Responsibilities:
1. **Workspace Resolution & Binding:** Resolves project workspace identities against `workspaces` table in Universal DB (`backend/data/app.db`).
2. **Deterministic Physical Path Calculation:** `getWorkspacePath(projectId)` returns `%TEMP%/agent-ws-<projectId>` on disk.
3. **Idempotent Directory Lifecycle:** `ensureWorkspace(projectId, userId)` creates both DB record and physical directory atomically.
4. **Path Security Guard:** `resolvePath(projectId, relPath)` strictly confines all file access within the workspace boundary and rejects traversal sequences (`../`, `..\`), external absolute paths (`C:\...`), and UNC network paths (`\\server\share`).
5. **Ownership Enforcement:** Verifies that the requesting `userId` owns the `projectId`. Rejects unauthorized cross-user workspace queries.
6. **Concurrency Safety:** Employs per-project promise locking (`_locks`) to ensure thread-safe initialization without serializing unrelated projects.
7. **Workspace Metadata:** Reports rich metadata including existence on disk, file count, total size bytes, Git status, and last synced timestamp.

---

## 3. Subsystem Integrations

### A. ProjectService (`backend/services/projectService.js`)
* Delegated `resolveProject(projectId, userId)` directly to `workspaceManager.ensureWorkspaceSync(targetId, userId)`.
* Guaranteed database singleton inheritance so custom/in-memory test databases work transparently without cross-database pollution.

### B. Dev Server Manager (`backend/sandbox/devServerManager.js`)
* Updated `_workspaceDir(projectId)` to delegate directly to `workspaceManager.getWorkspacePath(projectId)`.
* Preserved all dynamic port allocation, multi-process lifecycle, and health verification behavior.

### C. Preview Engine (`backend/routes/preview.js`)
* Replaced arbitrary path concatenation in `workspaceOf(projectId)` with `workspaceManager.getWorkspacePath(projectId)`.
* Maintained static preview fallback and proxy routing contracts with zero breaking changes.

### D. Terminal Sessions (`backend/sockets/terminal.js`)
* Updated session root discovery to use `workspaceManager.getWorkspacePath(projectId)`.

### E. Artifact Service (`backend/services/artifactService.js`)
* Updated boundary security checks to validate file locations against `workspaceManager.getWorkspacePath(projectId)`.

---

## 4. Path Security & Cross-Project Isolation Model

* **Traversal Sequence Rejection:** Rejects any path containing `../`, `..\`, `/..`, or `\..`.
* **UNC Network Path Rejection:** Rejects paths starting with `\\` or `//`.
* **Null Byte Injection Guard:** Rejects paths containing `\0`.
* **Absolute Path Escapes:** Validates that `path.resolve(wsRoot, relPath)` is strictly prefixed by `wsRoot`.
* **Windows Case Normalization:** Normalized comparison handles Windows case-insensitivity without case-mismatch false positives.
* **Cross-Project Isolation:** Project A cannot resolve files or paths inside Project B's workspace.

---

## 5. Verification & Test Matrix

| Test Suite | Coverage Area | Tests | Status |
| :--- | :--- | :---: | :---: |
| **`workspaceManager.test.js`** | Resolution, Idempotency, Concurrency, Restarts, Path Security, UNC guards, Ownership, Metadata | 11 | ✅ **PASS** |
| **`universalProjectStore.test.js`** | Migration runner, DAO CRUD, FK cascades, Project resolver, Context hydrator | 16 | ✅ **PASS** |
| **`artifactService.test.js`** | Artifact registration, SHA-256 integrity, Idempotency, Pipeline integration | 9 | ✅ **PASS** |
| **`visualVerification.test.js`** | Playwright Chromium verification, console classifiers, screenshot capture | 16 | ✅ **PASS** |
| **Full Backend Suite** | All 17 backend test suites (`node --test tests/**/*.test.js`) | 232 | ✅ **PASS** |
| **Phase 0.1 Acceptance** | Real-world dev server lifecycle, live proxy, AST diagnostics | 14 | ✅ **PASS** |
| **Phase 0.2 Acceptance** | Dynamic port authorization, redirect blocks, post-repair verification | 7 | ✅ **PASS** |
| **Frontend Jest Suite** | Sidebar, IDE, Kanban, Projects component tests | 24 | ✅ **PASS** |
| **Linters & Diff Checks** | ESLint & `git diff --check` | 0 Errors | ✅ **PASS** |

---

## 6. Database Migrations Status

* **ZERO Migrations Required:** The Phase 1.1 `001_universal_schema.js` DDL already included the canonical `workspaces` table (`id`, `project_id`, `disk_path`, `is_git_initialized`, `current_branch`, `last_synced_at`).

---

## 7. Deferred Issues & Remaining Phase 1.2 Debt

1. **Legacy Route Delegation & SEC-001 (Milestone 3):** `server.js` legacy `/api/projects` and `/api/chat/*` routes still perform direct SQLite table operations and lack project ownership authorization checks. Will be fully remediated in Milestone 3.
2. **Project-Scoped Learning & Memory (Milestone 4):** `routes/learning.js` still writes to flat file `personal_brain_memory.json`. Will be migrated to `ContextNodeDAO` in Milestone 4.
3. **Full Regression & Release Gate (Milestone 5):** Multi-project end-to-end integration and release signoff.

---

### 🛑 STOP CONDITION ENFORCED
* **Milestone 2 is COMPLETE and VERIFIED.**
* **Zero commits, zero pushes made.**
* Standing by for architectural review of Milestone 2.
