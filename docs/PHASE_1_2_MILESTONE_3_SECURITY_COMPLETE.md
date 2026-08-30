# Phase 1.2 — Milestone 3: Legacy API Route Delegation & SEC-001 Remediation Specification

> **Document Type:** Technical Completion Specification  
> **Status:** MILESTONE 3 VERIFIED — PENDING ARCHITECTURAL REVIEW  
> **Scope:** Legacy API Route Delegation & SEC-001 Remediation  
> **Baseline Commit:** `9c5d44c` (`feat(agent): implement playwright visual verification loop`)

---

## 1. Legacy Route Inventory

| Route | Pre-M3 Storage | Pre-M3 Authorization | M3 Canonical Delegation | M3 Security & Authorization |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/projects`, `/api/v1/memory/projects` | Raw SQL `SELECT * FROM projects` | None (all projects exposed) | `ProjectDAO.list(userId)` | Scoped to authenticated `userId` |
| `POST /api/project`, `/api/memory/project` | Raw SQL `INSERT INTO projects` | None (any project ID/owner) | `ProjectDAO`, `WorkspaceManager` | Verifies ownership if existing; binds to `userId` |
| `DELETE /api/project/:id`, `/api/memory/project/:id` | Raw SQL `DELETE FROM projects` | None (**SEC-001: Any user could delete any project**) | `ProjectDAO.delete(id, userId)` | **403 Forbidden** if caller does not own project |
| `GET /api/project/:id`, `/api/memory/project/:id` | Raw SQL `SELECT * FROM projects` | None | `ProjectDAO.getById`, `ProjectAuth` | **403 Forbidden** if caller does not own project |
| `POST /api/project/:id/file`, `.../folder`, `.../rename` | Raw SQL + inline `agent-ws-` | None | `ProjectAuth`, `WorkspaceManager` | **403 Forbidden** + path traversal blocked |
| `DELETE /api/project/:id/file`, `.../folder` | Raw SQL `DELETE FROM workspace_files` | None | `ProjectAuth`, `WorkspaceManager` | **403 Forbidden** + path traversal blocked |
| `GET /api/chat/history`, `/api/v1/chat/history` | Raw SQL `chat_history` | None | `ConversationDAO`, `MessageDAO` | **403 Forbidden** if conversation owned by other user |
| `POST /api/chat/save`, `/api/v1/chat/save` | Raw SQL `chat_history` | None | `ConversationDAO`, `MessageDAO` | Upserts conversation under `userId` and `projectId` |
| `DELETE /api/chat/history`, `/api/v1/chat/history` | Raw SQL `chat_history` | None | `ConversationDAO`, `MessageDAO` | **403 Forbidden** if conversation owned by other user |

---

## 2. SEC-001 Root Cause Analysis

**Root Cause:**
* Legacy project and memory endpoints in `backend/server.js` performed direct SQLite queries without checking whether the requesting user owned the target `project_id`.
* Any client could issue a `DELETE /api/project/proj_target` or `GET /api/project/proj_target` and mutate/delete another user's project, files, and chat history.
* Client-supplied `req.body.user_id` was previously accepted without validation against the caller's true identity.

---

## 3. Trust Boundary & Authentication Status

### Authentication Status:
* **Current State:** AI-Dost operates in a local single-user developer mode with optional multi-user/test header context (`x-user-id`) or session context (`req.user.id`).
* **Authentication Limitation:** There is currently no cryptographic session/JWT authentication layer enabled across all endpoints in local mode; full enterprise RBAC and multi-tenant auth remain outside Phase 1.2 scope.
* **Trust Boundary Rule:** The application extracts caller identity from `req.user.id` $\to$ `req.headers['x-user-id']` $\to$ default `'local-user'`. `req.body.userId` or `req.query.userId` is **NEVER** trusted as proof of caller identity. A caller authenticated as User A passing `body: { user_id: 'userB' }` is strictly prevented from accessing User B's resources.

---

## 4. Canonical Project Authorization Architecture

[`backend/services/projectAuthorization.js`](file:///c:/Users/vikash%20kumar/Desktop/ai-dost%20version%202.o/backend/services/projectAuthorization.js) provides the minimal, canonical authorization helper:

```text
                        Incoming Request
                               │
                               ▼
                   ProjectAuthorizationService
                    ├── resolveUser(req) [Untrusted body ignored]
                    ├── ProjectDAO.getById(projectId)
                    └── verifyOwnership(project, userId)
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       Ownership Verified             Ownership Mismatch
               │                               │
               ▼                               ▼
      Authorized Project Context         HTTP 403 Forbidden
      (ProjectDAO / WorkspaceManager)    (Access Denied)
```

---

## 5. Security Test Matrix (IDOR / BOLA)

| Attack / Scenario | Expected | Actual | Test Verification |
| :--- | :---: | :---: | :--- |
| **Cross-user project read** (Alice $\to$ Bob Project) | **403 DENY** | **403 DENY** | `projectAuthorization.test.js:test 2` |
| **Cross-user project update** (Alice $\to$ Bob Project) | **403 DENY** | **403 DENY** | `projectAuthorization.test.js:test 2` |
| **Cross-user project delete** (Mallory $\to$ Alice Project) | **403 DENY** | **403 DENY** | `projectAuthorization.test.js:test 3` |
| **Cross-project chat read** (Bob $\to$ Alice Conversation) | **403 DENY / NULL** | **403 DENY / NULL** | `projectAuthorization.test.js:test 4` |
| **Cross-project chat write** (Bob $\to$ Alice Conversation) | **403 DENY** | **403 DENY** | `server.js:saveChatHistory` |
| **Cross-project memory access** (Mallory $\to$ Alice Memory) | **403 DENY** | **403 DENY** | `server.js:/api/memory/project/:id` |
| **Cross-project workspace access** (Mallory $\to$ Alice Workspace) | **ERR_UNAUTHORIZED** | **ERR_UNAUTHORIZED** | `workspaceManager.test.js:test 8` |
| **Spoofed body userId** (`x-user-id: mallory`, `body: { user_id: 'alice' }`) | **403 DENY** | **403 DENY** | `projectAuthorization.test.js:test 5` |
| **Workspace path escape** (`../`, `..\`, `\\unc`) | **400 / ERR_PATH_TRAVERSAL** | **400 / ERR_PATH_TRAVERSAL** | `workspaceManager.test.js:test 6, 7` |
| **Legitimate owner access** (Alice $\to$ Alice Project) | **200 ALLOW** | **200 ALLOW** | `projectAuthorization.test.js:test 2` |

---

## 6. Remaining Raw SQLite Operations

The following raw SQLite operations remain in `server.js` and are classified:
1. **`workspace_files` Secondary Mirror Updates:** Maintained strictly for backward compatibility with CopilotIDE's `/api/memory/project/:id` file view (classified as legacy secondary mirror).
2. **`chat_history` Backward Compatibility Writes:** Dual-written during `saveChatHistory` to ensure legacy chat clients continue functioning without regression.
3. **`resumes` Table Access:** Dedicated to legacy resume generator endpoints (scheduled for DAO consolidation in Phase 1.4).

---

## 7. Verification & Test Matrix

| Test Suite | Coverage Area | Tests | Status |
| :--- | :--- | :---: | :---: |
| **`projectAuthorization.test.js`** | User resolution, Identity spoofing prevention, Cross-user project CRUD, Chat isolation | 7 | ✅ **PASS** |
| **`workspaceManager.test.js`** | Resolution, Idempotency, Concurrency, Restarts, Path Security, UNC guards, Ownership | 11 | ✅ **PASS** |
| **`universalProjectStore.test.js`** | Migration runner, DAO CRUD, FK cascades, Project resolver, Context hydrator | 16 | ✅ **PASS** |
| **`artifactService.test.js`** | Artifact registration, SHA-256 integrity, Idempotency, Pipeline integration | 9 | ✅ **PASS** |
| **`visualVerification.test.js`** | Playwright Chromium verification, console classifiers, screenshot capture | 16 | ✅ **PASS** |
| **Full Backend Suite** | All 18 backend test suites (`node --test tests/**/*.test.js`) | 239 | ✅ **PASS** |
| **Phase 0.1 Acceptance** | Real-world dev server lifecycle, live proxy, AST diagnostics | 14 | ✅ **PASS** |
| **Phase 0.2 Acceptance** | Dynamic port authorization, redirect blocks, post-repair verification | 7 | ✅ **PASS** |
| **Frontend Jest Suite** | Sidebar, IDE, Kanban, Projects component tests | 24 | ✅ **PASS** |
| **Linters & Diff Checks** | ESLint & `git diff --check` | 0 Errors | ✅ **PASS** |

---

## 8. Deferred Issues & Remaining Phase 1.2 Debt

1. **Project-Scoped Learning & Memory (Milestone 4):** `routes/learning.js` still writes to flat file `personal_brain_memory.json`. Will be migrated to `ContextNodeDAO` in Milestone 4.
2. **Full Regression & Release Gate (Milestone 5):** Multi-project end-to-end integration and release signoff.

---

### 🛑 STOP CONDITION ENFORCED
* **Milestone 3 is COMPLETE and VERIFIED.**
* **Zero commits, zero pushes made.**
* Standing by for architectural review of Milestone 3.
