# Technical Debt & Cleanup Backlog

**Document Type:** Technical Debt Inventory  
**Status:** Active  
**Last Updated:** 2026-08-30

---

## 1. High Priority (P0 / P1)
- [x] **Log File Cleanup:** No stray `*.log` files remain at root/backend/engine (verified clean; `backend/logs/` created on demand by the server).
- [x] **Scratch & Temp File Pruning:** Done 2026-09-30 — one-off scripts removed (`copilottest*.js`, `debug_p1*.js`, `fix_*.js`, `patch*.js`, `test_*.js`, `verify_*.js`, `cascade_check.js`, `rag_run_check.js`, `aiServices.js`, `sandbox_test_app/`, plus root-level `fix_*`/`patch_*`/`test_*`/`audit_codebase.js`).
- [ ] **Unified Context Storage:** Unify chat conversation memory with project workspace context graph.
- [ ] **Live Sandbox Dev Server Proxy:** Complete WebSocket/HTTP reverse proxying from Docker dev server to Next.js preview window.

## 2. Medium Priority (P2)
- [ ] **Resume Builder Agent Migration:** Refactor resume builder from standalone UI logic to use the shared Document/Agent Engine.
- [ ] **Multi-Language LSP Adapters:** Expand diagnostics from JS/TS to Python (Pyright/Ruff) and Go.
