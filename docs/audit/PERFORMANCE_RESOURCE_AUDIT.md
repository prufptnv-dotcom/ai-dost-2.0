# Performance & Resource Safety Audit — AI-Dost 3.0

**Audit Date:** 2026-09-16  
**Scope:** Memory limits, output truncation, step budget enforcement, and streaming backpressure.

---

## 1. Resource Limit Guardrails

| Constraint | Limit | Implementation Location | Purpose |
|:---|:---|:---|:---|
| **Max Agent Steps** | 50 steps | `backend/agent/security/ResourceGuard.js` | Prevents runaway agent loops. |
| **Max Repairs** | 5 repairs | `backend/agent/security/ResourceGuard.js` | Halts cyclic repair recursion. |
| **Max Input Bytes** | Configurable (Default 1MB) | `ProductionExecutionGuard.js` | Defends against memory exhaustion attacks. |
| **Max Output Bytes** | Configurable (Default 2MB) | `ProductionExecutionGuard.js` | Prevents buffer flooding. |
| **File Read Truncation** | 8000 characters | `backend/agent/orchestrator.js` | Protects LLM context window from huge binary/text dumps. |
| **Terminal Output Truncation** | 3000 characters | `backend/agent/orchestrator.js` | Keeps logs and SSE payloads bounded. |
| **Audit Log Retention** | 5000 events / 24h retention | `backend/agent/security/ProductionExecutionGuard.js` | Bounded in-memory event array with automatic pruning. |

---

## 2. Realtime Backpressure & Streaming

- **SSE Streaming (`/api/chat/stream`):** Uses chunked transfer encoding, streaming tokens as generated to maintain low TTFT (Time To First Token).
- **Socket.io WebSocket Server:** Idle connection timeout and automatic ping/pong keepalive.
