# Release Note: Phase 0.1 — Persistent Sandbox + Live Dev Server + Live Preview

**Release Tag / Milestone:** Phase 0.1 Complete  
**Commit Message:** `feat(platform): complete persistent sandbox live preview`  
**Date:** 2026-08-30  
**Target Branch:** `main`

---

## 1. Release Scope
Transition AI-Dost from relying on an in-browser simulated Babel mock compiler to executing **real development servers** inside persistent project workspaces and containerized sandboxes, reverse-proxied with full **HTTP stream and WebSocket/HMR** support directly into Copilot IDE.

---

## 2. Architecture Delivered

```
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│  User Request   │ ────> │  Autonomous Agent      │ ────> │  Workspace / Sandbox   │
│  "Create App"   │       │  Plan -> Code -> AST   │       │  %TEMP%/agent-ws-<id>  │
└─────────────────┘       └────────────────────────┘       └───────────┬────────────┘
                                                                       │
                                              ┌────────────────────────┘
                                              ▼
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│   Copilot IDE   │ <───  │   Secure Reverse Proxy │ <───  │    Real Dev Server     │
│   Live Iframe   │ (HMR) │   /api/preview/:id     │ (TCP) │   Vite/Next :5173/3000 │
└─────────────────┘       └────────────────────────┘       └────────────────────────┘
```

1. **Dev Server Lifecycle State Machine (`backend/sandbox/devServerManager.js`)**:
   - Explicit state tracking: `CREATING` $\rightarrow$ `STARTING` $\rightarrow$ `READY` $\rightarrow$ `RESTARTING` $\rightarrow$ `STOPPING` $\rightarrow$ `STOPPED` $\rightarrow$ `FAILED`.
   - Dual-runtime support: Docker containers when Docker daemon is available, with seamless host process fallback (`child_process.spawn` in `%TEMP%/agent-ws-<projectId>`) and dynamic host port allocation (`net.createServer`).
   - Rolling stdout/stderr log buffer (last 500 lines) with timestamps for live UI streaming and agent diagnostics.
   - Fast failure detection when child processes exit prematurely before health checks.

2. **Secure HTTP Reverse Proxy (`backend/routes/preview.js` & `backend/sandbox/routes.js`)**:
   - Reverse-proxies `/api/preview/:projectId/*` and `/api/sandbox/:sandboxId/proxy/*` directly to `http://127.0.0.1:<hostPort>`.
   - Rewrites `Host` header to `127.0.0.1:<hostPort>` to satisfy Vite/Next allowed host security policies.
   - Auto-renders dark-themed startup loading pages with auto-refresh during `STARTING` and diagnostic error pages with repair actions during `FAILED`.
   - Decodes and enforces path traversal guards (HTTP 400) at router entrypoint before any proxy or filesystem access.
   - Falls back to secure static file serving (`safeJoin`) if no dev server is active.

3. **WebSocket & HMR Forwarding (`backend/server.js`)**:
   - Intercepts HTTP `upgrade` requests for live preview sessions.
   - Establishes a raw TCP bidirectional bridge (`net.connect`) directly to the dev server host port.
   - Enables native Vite Hot Module Replacement (HMR) and Next.js Fast Refresh inside the Copilot preview viewport without page reload.

4. **Copilot IDE Live Preview UI (`frontend/components/views/CopilotIDE.jsx`)**:
   - Dev server status badge (`Live Dev Server (:5173)`, `Booting...`, `Server Idle`, `Server Error`).
   - Integrated Dev Server Controls: **Start Server**, **Restart**, **Stop**, **Inspect UI**, and **Visual QA**.
   - Mode switcher: `⚡ Live Proxy` (Real Dev Server) and `🎨 In-Browser` (Offline Babel).

5. **Diagnostic Layer Host Fallback (`backend/agent/diagnostics/`)**:
   - Enabled `DiagnosticManager` and `JSTsAdapter` to perform AST syntax analysis in both Docker container and host workspace modes.

---

## 3. Files Changed

### Backend Core & Sandbox
- `backend/sandbox/devServerManager.js` — State machine, process management, dynamic port finder, dual Docker/host execution, fast failure polling.
- `backend/sandbox/SandboxManager.js` — Expanded default port bindings for web dev frameworks (`3000`, `5173`, `8080`, `8000`, `4321`, `8081`, `1420`).
- `backend/sandbox/routes.js` — Added `/dev/restart`, `/dev/logs`, `/dev/status` endpoints.
- `backend/routes/preview.js` — Secure reverse proxy, path traversal guard, dev server control endpoints (`/dev/start`, `/dev/stop`, `/dev/restart`, `/status`).
- `backend/server.js` — WebSocket / HMR upgrade forwarding bridge.
- `backend/agent/diagnostics/DiagnosticManager.js` — Host mode support for diagnostics.
- `backend/agent/diagnostics/adapters/JSTsAdapter.js` — Local execution fallback for JS/TS AST syntax checks.

### Frontend UI
- `frontend/components/views/CopilotIDE.jsx` — Preview toolbar controls, status polling, live proxy iframe integration.

### Tests & Governance Documentation
- `backend/tests/devServerProxy.test.js` — 10 unit/integration tests for dev server proxy and lifecycle.
- `docs/AI_DOST_MASTER_GOAL.md` — Canonical platform master goal (5–10 Year Plan).
- `docs/CURRENT_PHASE.md` — Phase 0 tracking.
- `docs/PRODUCT_ROADMAP.md` — Roadmap phases 0 through 5.
- `docs/ARCHITECTURE.md` — Platform architecture specs.
- `docs/AGENT_RUNTIME.md` — Agent state machine and concurrency specs.
- `docs/SECURITY_MODEL.md` — Security boundaries and policies.
- `docs/FEATURE_REGISTRY.md` — Module inventory and health matrix.
- `docs/DECISION_LOG.md` — Architectural decision records (ADR-001 to ADR-004).
- `docs/TECH_DEBT.md` — Technical debt backlog.
- `docs/PHASE_0_1_LIVE_PREVIEW_COMPLETE.md` — Phase 0.1 completion report.
- `docs/PHASE_0_1_ACCEPTANCE_AUDIT.md` — Real-world acceptance audit log.
- `docs/PHASE_0_1_RELEASE.md` — This release document.

---

## 4. Test Evidence

### A. Backend Regression Test Suite (`node --test tests/**/*.test.js`)
- **Total Tests:** 180
- **Passed:** 180 (100%)
- **Failed:** 0
- **Suites:** 13

### B. Frontend Test Suite (`npm test`)
- **Total Tests:** 24
- **Passed:** 24 (100%)
- **Failed:** 0
- **Suites:** 5

### C. Frontend Lint (`npm run lint`)
- **Errors:** 0

### D. End-to-End Acceptance Audit (`docs/PHASE_0_1_ACCEPTANCE_AUDIT.md`)
- **Total Acceptance Cases:** 14
- **Passed:** 14 (100%)
- **Failed:** 0

---

## 5. Security Verification
- **Path Traversal Protection:** Unconditionally decoded and blocked at router layer with HTTP 400.
- **SSRF / Arbitrary Host Access:** Unregistered project IDs return HTTP 404 without opening network sockets.
- **Secret File Shield:** `.env`, `.pem`, `.key`, `id_rsa`, `credentials` blocked from read/write/preview access.
- **Project Isolation:** Concurrent projects run on independent dynamic ports and isolated workspace folders.

---

## 6. Known Limitations
- Docker mode requires Docker daemon running; when Docker is inactive, the system automatically uses the host workspace fallback.
- In-browser Babel mode remains available as an offline fallback.

---

## 7. Rollback Information
In case of rollback, revert to previous stable commit: `a65455d` (`feat(agent): parallel execution and dependency graph`).
Command: `git revert HEAD` or `git reset --hard a65455d`.
