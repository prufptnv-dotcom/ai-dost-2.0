# Phase 0.1 — Persistent Sandbox + Live Dev Server + Live Preview Verification Report

**Status:** ✅ COMPLETE  
**Backend Tests:** 180 / 180 PASSING  
**Frontend Tests:** 24 / 24 PASSING  
**Lint Errors:** 0 ERRORS  
**Architecture Alignment:** Aligned with `docs/AI_DOST_MASTER_GOAL.md` (Phase 0 Foundation)

---

## 1. Executive Summary

Phase 0.1 transitions AI-Dost from relying on an in-browser Babel mock compiler to executing **real development servers** inside persistent project workspaces and containerized sandboxes, reverse-proxied with full **HTTP + WebSocket/HMR** support directly into Copilot IDE.

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

---

## 2. Implemented Architecture & Runtime Flow

### A. Lifecycle State Machine
Every dev server process is tracked with explicit states:
- `CREATING`: Container or persistent workspace allocated.
- `STARTING`: Dependencies installing (`npm install`) and dev command executing (`npm run dev`).
- `READY`: Health check passed, port actively listening, HTTP & HMR ready.
- `RESTARTING`: Restarting after file modifications or configuration updates.
- `STOPPING`: Termination signal sent to process/container.
- `STOPPED`: Process cleanly terminated.
- `FAILED`: Unrecoverable crash or startup error, capturing stderr diagnostics.

### B. Dual-Runtime Resilience (Docker + Host Process Fallback)
1. **Docker Mode**: When Docker is available, spins up isolated containers with port bindings across default dev ports (`3000`, `5173`, `8080`, `8000`, `4321`, `8081`, `1420`).
2. **Local Host Mode Fallback**: When Docker is absent, runs directly in the persistent project workspace (`%TEMP%/agent-ws-<projectId>`) using dynamically allocated ports via `net.createServer`.

### C. Secure HTTP Reverse Proxy (`/api/preview/:projectId/*`)
- Proxies requests to `http://127.0.0.1:<hostPort>/<path>?<query>` with full stream piping.
- Rewrites `Host` header to `127.0.0.1:<hostPort>` to satisfy Vite/Next allowed host security policies.
- Automatically serves sleek dark-themed loading pages with auto-refresh during `STARTING` and diagnostic error pages with repair actions during `FAILED`.
- Falls back to secure static file serving (`safeJoin` with path traversal guards) if no dev server is active.

### D. WebSocket & HMR Forwarding
- HTTP `upgrade` requests targeting `/api/preview/:projectId` or referencing a preview session are intercepted in `backend/server.js`.
- Establishes a raw TCP bidirectional bridge (`net.connect`) to the live dev server host port.
- Vite Hot Module Replacement (HMR) and Next.js Fast Refresh update instantly inside the Copilot preview viewport without page reloads.

### E. Copilot IDE Integration
- Added live dev server status badge (`READY`, `STARTING`, `FAILED`, `STOPPED`).
- Added dev server controls: **Start Server**, **Restart**, **Stop**, **Inspect UI**, and **Visual QA**.
- Enabled switching between `⚡ Live Proxy` (Real Dev Server) and `🎨 In-Browser` (Offline Babel).

---

## 3. Automated Test Evidence

### Backend Test Suite (`node --test tests/**/*.test.js`)
```
✔ Phase 0.1 — Dev Server & Live Preview Proxy Test Suite
  ✔ 1. should find free ports dynamically
  ✔ 2. should detect framework from project workspace files
  ✔ 3. should track server states (CREATING, STARTING, READY, STOPPED, FAILED)
  ✔ 4. should log stdout and stderr into rolling log buffer
  ✔ 5. should securely reverse-proxy live dev server HTTP requests when READY
  ✔ 6. should render sleek loading HTML when server is STARTING
  ✔ 7. should render diagnostic error HTML when server is FAILED
  ✔ 8. should fallback to static workspace files when no dev server is running
  ✔ 9. should reject path traversal attempts on static preview endpoints
  ✔ 10. should report status via GET /api/preview/:projectId/status

ℹ tests 180
ℹ suites 13
ℹ pass 180
ℹ fail 0
```

### Frontend Test Suite (`npm test`)
```
Test Suites: 5 passed, 5 total
Tests:       24 passed, 24 total
Snapshots:   0 total
```

### Frontend Lint (`npm run lint`)
```
0 errors, 1 warning (react-hooks exhaustive-deps)
```

---

## 4. Manual Verification Steps

1. Start the backend: `cd backend && node server.js`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to `http://localhost:3000` -> Open Copilot IDE.
4. Click **Preview** in the workspace view mode selector.
5. Dev Server badge will display `Server Idle` or `Live Dev Server (:5173)`.
6. Click **Start Server** -> Dev Server transitions from `STARTING` (with live logs) to `READY`.
7. Edit any file in the Monaco Editor -> Changes instantly reflect via HMR in the Live Preview iframe!
