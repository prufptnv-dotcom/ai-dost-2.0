# API & Backend Audit — AI-Dost 3.0

**Audit Date:** 2026-09-16  
**Scope:** Express API routes, Next.js rewrites, SSE streaming contracts, and error handling envelopes.

---

## 1. Route Map & Contract Compatibility

| Route | Method | Purpose | Input Validation | Error Envelope | Frontend Match |
|:---|:---|:---|:---|:---|:---|
| `/health` | `GET` | Server health & AI keys probe | None (public) | `{ status: "OK", timestamp, ...keys }` | Match (`next.config.mjs` rewrite) |
| `/api/chat` | `POST` | Primary chat inference endpoint | Rejects empty message / invalid JSON | `{ error, code: "MISSING_MESSAGE" }` | Match |
| `/api/chat/stream` | `POST` | SSE streaming chat endpoint | Stream token parser with abort signal | Standard SSE events (`token`, `meta`, `error`) | Match |
| `/api/agent/run` | `POST` | Autonomous agent execution (SSE) | Validates `userPrompt` or `chatTaskPlan` | JSON SSE events (`task_phase`, `step`, `error`) | Match (`AutonomousCopilotDirector.jsx`) |
| `/api/agent/plan` | `POST` | Planner mode decomposition | 400 on empty user prompt | `{ plan: { tasks, steps } }` | Match |
| `/api/sandbox/create` | `POST` | Container / sandbox initialization | Validates workspace directory and ports | `{ id, hostPort, status }` | Match |
| `/api/document/generate` | `POST` | MS Office & PDF doc generation | Validates format keyword (`pdf`, `docx`, `pptx`, etc.) | `{ success: true, url, fileName }` | Match |
| `/api/verify/code` | `POST` | Pre-persistence syntax & secret probe | Verifies AST and regex against API keys | `{ valid: boolean, diagnostics }` | Match |

---

## 2. API Contract Findings & Enhancements

1. **Port Parity & Rewrites:**
   - Backend configured to port `5000` via `.env`.
   - Frontend configured with proxy rewrite in `next.config.mjs` routing `/api/*` to `http://127.0.0.1:5000`.
   - `frontend/.env.local` synchronized to `NEXT_PUBLIC_EXPRESS_BACKEND_URL=http://127.0.0.1:5000`.

2. **Error Envelopes & Sensitive Stack Traces:**
   - Error middleware in `backend/server.js` sanitizes production error messages.
   - Internal stack traces are suppressed in production mode (`NODE_ENV=production`), returning `{ error: "Internal Server Error", code: "INTERNAL_ERROR" }`.
