# Feature Registry & Module Health Matrix

**Document Type:** Master Feature Inventory  
**Status:** Active  
**Last Updated:** 2026-08-30

---

| Feature / Module | Subsystem | Status | Health | Test Coverage | Master Goal Alignment |
|---|---|---|---|---|---|
| **Agent Orchestrator** | `backend/agent/orchestrator.js` | Production | 🟢 Healthy | High (190 tests) | P0.1 Runtime |
| **Smart Diff Engine** | `backend/agent/diffEngine.js` | Production | 🟢 Healthy | High (Unit) | P0.1 Runtime |
| **Lock Manager** | `backend/agent/concurrency/LockManager.js` | Production | 🟢 Healthy | High (Unit) | P0.1 Concurrency |
| **Dependency Graph** | `backend/agent/dependency/DependencyGraph.js` | Production | 🟢 Healthy | High (Unit) | P0.1 Graph |
| **Task Scheduler** | `backend/agent/concurrency/TaskScheduler.js` | Production | 🟢 Healthy | High (Unit) | P0.1 Scheduling |
| **AST Diagnostics** | `backend/agent/diagnostics/` | Production | 🟢 Healthy | High (Unit) | P0.3 Verifier |
| **Live Dev Server & Proxy** | `backend/sandbox/devServerManager.js` & `routes/preview.js` | Production | 🟢 Healthy | High (10 tests) | P0.1 Live Preview |
| **Visual Verifier** | `backend/agent/verification/VisualVerifier.js` | Production | 🟢 Healthy | High (10 tests) | P0.2 Visual QA |
| **Docker Sandbox** | `backend/sandbox/SandboxManager.js` | Beta | 🟢 Functional (Dual mode) | Medium | P0.2 Security |
| **Unified Chat** | `backend/routes/chat.js` | Production | 🟢 Healthy | High | P3 Front Door |
| **Document Generator** | `backend/routes/documents.js` | Production | 🟢 Healthy (PDF/DOCX/PPTX/CSV/XLSX) | High | P4 Documents |
| **Image Generator** | `backend/routes/image.js` | Production | 🟢 Healthy (Pollinations fallback) | Medium | P5 Media |
| **Research / Tavily** | `backend/routes/chat.js` & `services/` | Production | 🟢 Healthy | Medium | P6 Research |
| **Resume Builder** | `frontend/components/ResumeBuilder.jsx` | Beta | 🟡 Needs core agent unification | Low (UI only) | P7 Workflows |
| **Telegram Bot** | `backend/services/telegramBot.js` | Production | 🟢 Healthy (Long polling) | Manual/E2E | P3 Entry Points |
| **Figma MCP** | `backend/routes/figma.js` | Beta | 🟡 Key dependent | Medium | Connectors |
