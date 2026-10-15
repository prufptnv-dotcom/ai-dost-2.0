# Phase 5: Production Release Manifest

## 1. Release Identification

- **Application Name**: AI-Dost
- **Release Version**: `v2.0.0` (Candidate: `2.0.0-rc.1`)
- **Architecture**: Modular Monolith (Next.js 16 + Node.js Express + SQLite WAL + Python AI Engine)
- **Node.js**: `20.x` / `22.x` LTS
- **Python**: `3.10+` (Optional for RAG Engine)
- **Next.js**: `16.2.12` / React `19.2.4`
- **Database Schema**: Version 4 (`_schema_migrations`)

---

## 2. Release Package Component Inventory

| Component | Source Path | Runtime Target | Required | Purpose |
|---|---|---|---|---|
| **Web UI** | `frontend/` | `frontend/.next/` (Build output) | **YES** | Editorial Workbench UI, Command Rail, Context Inspector, IDE Chrome |
| **API Server** | `backend/server.js` | `node server.js` | **YES** | Express REST, SSE, Socket.IO terminal, and MCP integration layer |
| **Universal Database** | `backend/db/` | `backend/data/app.db` | **YES** | Authoritative relational state: Users, Projects, Workspaces, Conversations, Tasks, Runs, Handoffs, Artifacts |
| **Migrations** | `backend/db/migrations/` | `001` - `004` SQL/JS | **YES** | Versioned database schema creation and evolution |
| **Workspace Subsystem** | `backend/services/workspaceManager.js` | `%TEMP%/agent-ws-*` | **YES** | Deterministic physical project workspace directories and sandboxing |
| **Autonomous Runtime** | `backend/agent/` | In-process execution | **YES** | Multi-agent runtime (Supervisor -> Researcher/Coder/Verifier) and execution loop |
| **AI Cascade** | `backend/services/aiServices.js` | In-process API client | **YES** | 9-tier cascading inference (Groq -> Gemini -> Cerebras -> NVIDIA -> Together -> DeepSeek -> Mistral -> HuggingFace -> OpenRouter -> Ollama) |
| **Python RAG Engine** | `ai-engine/` | `uvicorn main:app :8001` | **OPTIONAL** | LlamaIndex RAG & vector embeddings (Node backend auto-falls back if down) |

---

## 3. Excluded Non-Production Artifacts

The following development artifacts are excluded from production distributions:
- `backend/tests/` and `frontend/tests/` (Test suites)
- `backend/audit_screenshots/` (Audit image artifacts)
- `backend/copilottest*.js` and `backend/test_*.js` (Scratch scripts)
- `frontend/pages/dashboard.jsx.bak` (Backup files)
- `.git/` and local development `.env` credentials
