# Technical Debt & Cleanup Backlog

**Document Type:** Technical Debt Inventory  
**Status:** Active  
**Last Updated:** 2026-08-30

---

## 1. High Priority (P0 / P1)
- [ ] **Log File Cleanup:** Root and backend directory contain numerous legacy log files (`backend*.log`, `engine*.log`, `dev*.log`). Consolidate structured logging to `backend/logs/` with rotation.
- [ ] **Scratch & Temp File Pruning:** Legacy debug scripts (`copilottest*.js`, `patch*.js`) in backend root need archival or cleanup.
- [ ] **Unified Context Storage:** Unify chat conversation memory with project workspace context graph.
- [ ] **Live Sandbox Dev Server Proxy:** Complete WebSocket/HTTP reverse proxying from Docker dev server to Next.js preview window.

## 2. Medium Priority (P2)
- [ ] **Resume Builder Agent Migration:** Refactor resume builder from standalone UI logic to use the shared Document/Agent Engine.
- [ ] **Multi-Language LSP Adapters:** Expand diagnostics from JS/TS to Python (Pyright/Ruff) and Go.
