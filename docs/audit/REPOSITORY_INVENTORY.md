# Repository Inventory — AI-Dost 3.0

**Audit Date:** 2026-09-16  
**Repository:** https://github.com/prufptnv-dotcom/ai-dost-2.0  
**Working Branch:** `audit/production-hardening-ui-state-2026-09`  
**Base Branch:** `main`

---

## 1. Directory Tree & Architecture Scope

| Directory | Role | Languages / Stacks | Subcomponents |
|:---|:---|:---|:---|
| `backend/` | Central API & AI Orchestration Server | Node.js (v20+ / v22 / v24), Express 4, SQLite (`node:sqlite` & Better-SQLite3 polyfill) | API routes, Agent Orchestrator, Runtime Scheduler, Security Boundary, SQLite WAL Database |
| `frontend/` | Web Application, IDE & Copilot Interface | React 19, Next.js 16 (App Router + Turbopack), Tailwind CSS 4, Monaco Editor, Lucide Icons | Views (ChatView, CopilotIDE, KanbanBoard, ArtifactsView, SettingsView, VoiceView), Contexts, Services |
| `ai-engine/` | LlamaIndex RAG, Edge-TTS & Python Services (Optional) | Python 3.10+, FastAPI, Uvicorn, openpyxl, edge-tts | RAG query/indexing, Excel generation, Edge-TTS speech synthesis |
| `docs/` | System Documentation, Architecture & Runbooks | Markdown | Architecture docs, Security Model, Operations Runbook, Audit reports |
| `.github/` | Continuous Integration Workflows | GitHub Actions | `ci.yml` (Frontend lint/test, Backend test suites, E2E smoke tests, Docker tests) |
| `memory-brain/` | Vector Memory Storage & Cache | Python / Node.js bridges | Persistent memory and context cache |
| `scripts/` | Project maintenance and cleanup scripts | Node.js / Bash | Maintenance utilities, cleanup scripts |

---

## 2. Runtimes, Packages & Build Systems

- **Backend Runtime:** Node.js v24.19.0 (tested and verified)
- **Frontend Framework:** Next.js 16.2.12 (Turbopack, React 19.2.4)
- **Package Managers:** npm 10+ with `package-lock.json`
- **Database:** SQLite 3 with WAL journal mode (`node:sqlite DatabaseSync` with robust transaction wrapper)
- **AI Providers:**
  - Groq (`qwen/qwen3.8-27b`, `llama-3.3-70b-versatile`)
  - Google Gemini (`gemini-1.5-flash`, `gemini-2.5-flash`)
  - DeepSeek (`deepseek-coder`, `deepseek-chat`)
  - OpenRouter (`openai/gpt-oss-20b:free` cascade)
  - Cerebras Inference (`gpt-oss-120b`)
  - Nvidia NIM
  - Ollama local fallback (`qwen2.5-coder:7b`)
- **Realtime Protocols:**
  - Socket.io 4.8.3 (`/socket.io/`)
  - WebSocket (`ws://` on `/api/terminal/ws`, `/lsp`, `/api/sandbox/ws`)
  - Server-Sent Events (SSE) on `/api/agent/run` and `/api/chat/stream`
- **Sandbox & Execution:**
  - Dockerode container isolation (Docker daemon)
  - Local hardened fallback with path traversal guards (`services/pathSecurity.js`, `services/DeterministicCodeGuard.js`)

---

## 3. Deployment Targets & Port Topology

- **Frontend Development / Production URL:** `http://127.0.0.1:3000`
- **Backend API Server:** `http://127.0.0.1:5000`
- **Internal Python AI Engine:** `http://127.0.0.1:8001`
- **Reverse Proxy / Rewrites:** Configured in `frontend/next.config.mjs` routing `/api/*` and `/health` directly to backend on `:5000`.
