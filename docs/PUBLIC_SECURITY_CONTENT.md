# AI-Dost Public Security Content & Implementation Mapping

**Date:** 2026-09-03  
**Status:** CANONICAL SECURITY REFERENCE  
**Audit Principle:** Every public security statement must map to real, implemented code or verified documentation.  

---

## 1. Security Philosophy

AI-Dost adheres to the principle of **Defensive Local Autonomy**:
- Autonomous execution must operate inside strictly bounded perimeters.
- The agent does not have unrestricted root or host authority.
- The user maintains ultimate oversight over destructive and high-risk operations.

---

## 2. Public Security Claims & Exact Code Mapping

| Public Security Statement | Implementation Reality | Source Code / Test Verification |
|---|---|---|
| **Local-First Data Storage** | All conversation history, project metadata, memory, and telemetry reside locally in SQLite (`backend/data/aidost.db`). No telemetry is piped to third-party ad networks or tracking servers. | `backend/server.js`, `backend/models/Chat.js`, `backend/models/Project.js` |
| **Path Traversal & Workspace Isolation** | All file operations (`read_file`, `write_file`, `edit_file`) validate paths against normalized workspace perimeters. Null byte injections (`\0`), UNC paths, and `../` directory traversals are actively rejected. | `backend/sandbox/sandboxManager.js`, `backend/tests/productionReadiness.test.js` (Scenarios 1 & 2) |
| **Role-Based Capability Matrix** | Agent execution enforces strict role separation: `SUPERVISOR` (orchestration only, no write/shell), `RESEARCHER` (read-only), `CODER` (read/write/terminal), `VERIFIER` (read/test only). Agents cannot self-escalate roles. | `docs/AUTONOMOUS_EXECUTION_CONTRACT.md`, `backend/services/capabilityPolicy.js` |
| **High-Risk Action Confirmation Gate** | Destructive actions (deleting repositories, clearing databases, wiping settings) are blocked from autonomous execution and require human confirmation via accessible modal dialogs. | `frontend/components/views/ProjectsView.jsx`, `frontend/components/views/HistoryView.jsx`, `frontend/components/views/SettingsView.jsx` |
| **API Key Protection** | Third-party inference keys (Gemini, Groq, Tavily) are stored either in local environment files (`.env`) or client `localStorage`. They are never logged to public telemetry or sent to external servers other than the designated LLM endpoints. | `backend/services/geminiService.js`, `backend/services/groqService.js`, `frontend/components/views/SettingsView.jsx` |
| **Isolated Docker Sandbox Execution (When Available)** | Multi-file project scaffolding and untrusted code execution run in isolated Docker containers with restricted ports and volume limits, preventing host environment contamination. | `backend/sandbox/sandboxManager.js`, `backend/routes/sandbox.js` |
| **Circuit Breakers & Rate Limiting** | Outbound API requests pass through an active CircuitBreaker and RateLimiter to prevent infinite request loops, rate-limit bans, and denial-of-service against provider endpoints. | `backend/services/apiClient.js`, `backend/tests/unit.test.js` |
| **Content Sanitization** | All rendered markdown outputs from AI responses are processed through `marked` and sanitized with `DOMPurify` to eliminate cross-site scripting (XSS) attacks. | `frontend/components/views/ChatView.jsx`, `frontend/components/views/CopilotIDE.jsx` |

---

## 3. Disclosures of Current Architecture Limits (Transparency)

To guarantee complete credibility, the security page openly discloses:
1. **Single-Tenant Local Deployment:** AI-Dost is currently designed for single-user local workstation use. Multi-tenant cloud security (row-level database security, IAM roles) is reserved for future SCALE profiles as documented in `docs/SYSTEM_SCALING_BOUNDARIES.md`.
2. **Third-Party Model Boundaries:** Prompts sent to cloud models (Google Gemini, Groq, OpenRouter) are governed by those respective providers' terms and data handling policies. For 100% offline air-gapped security, users should select the local Ollama provider.
3. **No Fabricated Certifications:** AI-Dost does NOT claim formal SOC 2, HIPAA, or ISO certifications. Security is achieved through verifiable architecture, open-source auditability, and local containment.
