# Phase 1.2 — Milestone 1: Universal Artifact Service & Pipeline Integration Specification

> **Document Type:** Technical Completion Specification  
> **Status:** MILESTONE 1 VERIFIED — PENDING ARCHITECTURAL REVIEW  
> **Scope:** Universal Artifact Service & Pipeline Integration  
> **Baseline Commit:** `9c5d44c` (`feat(agent): implement playwright visual verification loop`)

---

## 1. Problem Statement & Background

Prior to this milestone, generated Word (.docx), PowerPoint (.pptx), Excel (.xlsx), CSV, PDF documents, AI studio images, and Playwright verification screenshots were written to disparate filesystem paths (`frontend/public/downloads/`, `backend/uploads/`, `<workspace>/.artifacts/verification/`) without being cataloged in the canonical `ArtifactDAO` database layer.

As a result:
* Documents and images had zero relational association to `projectId`, `conversationId`, or `userId`.
* Screenshots captured during visual verification could not be discovered by Chat, Documents, or agent prompt hydrators.
* There was no cryptographic SHA-256 integrity verification or deduplication.

---

## 2. ArtifactService Design & Responsibilities

[`backend/services/artifactService.js`](file:///c:/Users/vikash%20kumar/Desktop/ai-dost%20version%202.o/backend/services/artifactService.js) has been created as the canonical service entry point for all artifact registrations:

```text
                                PHYSICAL FILE
                       (downloads/, uploads/, workspace)
                                      │
                                      ▼
                               ArtifactService
                        ├── validatePath() [Security]
                        ├── calculateSha256() [Integrity]
                        ├── fs.statSync() [Size & Ext]
                        └── checkIdempotency() [De-dupe]
                                      │
                                      ▼
                                 ArtifactDAO
                                      │
                                      ▼
                            Universal SQLite DB
                            (artifacts table)
```

### Core API Methods:
* `registerFile({ filePath, projectId, conversationId, taskId, name, type, mimeType, metadata, userId })`: Validates path safety, computes SHA-256, verifies project existence, checks idempotency, and records the artifact in SQLite.
* `getArtifact(id, projectId)`: Authoritative lookup with project-scoping isolation.
* `listProjectArtifacts(projectId, type)`: Lists all artifacts belonging to a project, optionally filtered by type (`document_pdf`, `generated_image`, `verification_screenshot`, etc.).
* `deleteArtifact(id, projectId)`: Removes the artifact record from the database.
* `calculateSha256(filePath | buffer)`: Cryptographic hash utility.
* `validatePath(filePath, projectId)`: Path security boundary validator blocking `../` traversal and secret file access.

---

## 3. Pipeline Integrations

### A. Document Engine (`backend/routes/documents.js`)
* Every generated `.pdf`, `.docx`, `.pptx`, `.xlsx`, and `.csv` is written to `frontend/public/downloads/` and immediately registered via `artifactService.registerFile(...)`.
* Response contract remains **100% backward compatible**:
  ```json
  {
    "success": true,
    "type": "docx",
    "downloadUrl": "/downloads/report_123.docx",
    "filename": "report_123.docx",
    "artifactId": "art_40b416eca8c1",
    "message": "DOCX file ready!"
  }
  ```

### B. Image Studio (`backend/routes/image.js`)
* Every downloaded Pollinations image or Gemini fallback image is saved to `backend/uploads/` and registered via `artifactService.registerFile(...)` with `type: 'generated_image'`.
* Response includes `artifactId: "art_..."` while preserving existing `imageUrl` and `provider` properties.

### C. Visual Verifier (`backend/agent/verification/VisualVerifier.js`)
* Every Playwright full-page screenshot captured during autonomous verification is registered via `artifactService.registerFile(...)` with `type: 'verification_screenshot'`.
* The returned verification result envelope attaches `artifactId: "art_..."`.
* If artifact registration fails (e.g. temporary database lock), verification still returns `status: 'PASS'` while logging a structured registration warning (never silently swallowed).

---

## 4. Path Security & Project Isolation

* **Traversal Rejection:** `ArtifactService.validatePath` rejects paths containing `../` or `..\`.
* **Secret Protection:** Blocks access to sensitive configuration files (`.env`, `.pem`, `.key`, `id_rsa`, `secrets.json`).
* **Approved Roots:** Restricts artifact registration to:
  1. `frontend/public/downloads/`
  2. `backend/uploads/`
  3. `%TEMP%/agent-ws-<projectId>/`
* **Cross-Project Isolation:** `ArtifactDAO.getById(id, projectId)` enforces that Project A cannot access or query Project B artifacts.

---

## 5. Idempotency & De-duplication Strategy

* When `ArtifactService.registerFile` is called for a file that already exists at the same `storagePath` under the same `projectId`:
  * If the cryptographic **SHA-256 matches**, the service returns the existing artifact record immediately without creating a duplicate row.
  * If the file was modified on disk (different SHA-256), the previous entry is cleanly replaced with the updated file size and checksum.

---

## 6. Database Schema Status

* **Zero Schema Migrations Required:** The Phase 1.1 `001_universal_schema.js` DDL already defined the canonical `artifacts` table with `id`, `project_id`, `conversation_id`, `task_id`, `name`, `type`, `mime_type`, `storage_path`, `size_bytes`, `sha256`, and `metadata`.
* Milestone 1 utilizes this existing schema with zero modifications to SQLite tables.

---

## 7. Verification & Test Matrix

| Test Suite | Coverage Area | Tests | Status |
| :--- | :--- | :---: | :---: |
| **`artifactService.test.js`** | Service CRUD, SHA-256, Idempotency, Path Security, Project Isolation, Pipeline integrations | 9 | ✅ **PASS** |
| **`universalProjectStore.test.js`** | Migration runner, DAO CRUD, FK cascades, Project resolver | 16 | ✅ **PASS** |
| **`visualVerification.test.js`** | Real Playwright Chromium verification, console error classification, screenshot capture | 16 | ✅ **PASS** |
| **Full Backend Suite** | All 16 backend test suites (`node --test tests/**/*.test.js`) | 221 | ✅ **PASS** |
| **Phase 0.1 Acceptance** | Real-world dev server lifecycle, live proxy, AST diagnostics | 14 | ✅ **PASS** |
| **Phase 0.2 Acceptance** | Dynamic port authorization, redirect blocks, post-repair verification | 7 | ✅ **PASS** |
| **Frontend Jest Suite** | Sidebar, IDE, Kanban, Projects component tests | 24 | ✅ **PASS** |
| **Linters & Diff Checks** | ESLint & `git diff --check` | 0 Errors | ✅ **PASS** |

---

## 8. Known Limitations & Remaining Phase 1.2 Debt

1. **WorkspaceManager (Milestone 2):** Dev server paths and workspace directories are still coordinated through individual managers (`devServerManager` and `projectService`). Milestone 2 will unify them under a single `WorkspaceManager`.
2. **Legacy Route Delegation (Milestone 3):** `server.js` legacy project endpoints (`/api/projects`) still query SQLite directly rather than delegating to `ProjectService`.
3. **Project-Scoped Learning (Milestone 4):** `routes/learning.js` still writes to flat file `personal_brain_memory.json`.

---

### 🛑 STOP CONDITION ENFORCED
* **Milestone 1 is COMPLETE and VERIFIED.**
* **Zero commits, zero pushes made.**
* Standing by for architectural review of Milestone 1.
