# AI-Dost Security Model & Defense-in-Depth Architecture

## 1. Executive Security Architecture Overview

AI-Dost v2.0 is an autonomous AI developer platform that executes code, automates terminal operations, manages workspaces, and integrates LLM reasoning cascades. Because autonomous agents can execute arbitrary commands and file modifications, AI-Dost implements a multi-layered **Defense-in-Depth Security Model** to prevent unauthorized execution, path traversal, privilege escalation, resource exhaustion, and remote code execution (RCE).

```
+-----------------------------------------------------------------------+
|                            EXTERNAL INGRESS                           |
|      (Next.js Client, Telegram Webhook, MCP Clients, REST APIs)       |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
| LAYER 1: Perimeter & Edge Security                                   |
| - Helmet HTTP Headers (CSP, HSTS, X-Frame-Options)                    |
| - CORS Origin Enforcement (Localhost, Configured Allowlist)           |
| - Rate Limiter (Token Bucket / Sliding Window per IP/Session)        |
| - Circuit Breaker (Cascading Failure Prevention)                      |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
| LAYER 2: Request & Authentication Boundary                            |
| - JWT / Session Token Validation                                      |
| - Input Payload Schema Validation & Content Length Guards             |
| - Strict JSON Envelope Error Handling                                 |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
| LAYER 3: Agent Orchestrator Security Boundary (Hardened 2026-09)      |
| - ProductionHardeningRuntime / ProductionRuntimeIntegration           |
| - Strict Tool Dispatch via executeProductionOperation                 |
| - ZERO Direct Tool Execution Bypasses                                 |
+-----------------------------------------------------------------------+
        |                                       |
        v                                       v
+-----------------------------+   +------------------------------------+
| LAYER 4: Policy & Guards    |   | LAYER 5: Isolation & Execution     |
| - Capability Policy Matrix  |   | - Workspace Boundary (Sandboxed)   |
| - Cryptographic Approvals   |   | - Docker Container Isolation       |
| - ResourceGuard (CPU/Mem)   |   | - Read-only Root Filesystems       |
| - AuditSink Forensics       |   | - Network Egress Controls          |
+-----------------------------+   +------------------------------------+
```

---

## 2. Layered Defense Architecture

### Layer 1: Perimeter & Edge Defense
- **HTTP Security Headers**: Express server is hardened using `helmet` to set strict `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and strict referrer policies.
- **CORS Policy**: Configured to reject cross-origin requests from untrusted origins, restricting access to `localhost:3000`, `127.0.0.1:3000`, or explicit production domains.
- **Rate Limiting & DoS Protection**: `backend/services/rateLimiter.js` restricts request frequency per client key, throttling abusive traffic before reaching LLM cascade or file systems.
- **Circuit Breakers**: `backend/services/circuitBreaker.js` wraps external AI providers (Gemini, Groq, Cerebras, OpenRouter, Tavily) to fail-fast and isolate failing upstream dependencies.

### Layer 2: Ingress Validation & Session Management
- **Input Validation**: Request bodies undergo strict type and size validation (`express.json({ limit: '10mb' })`).
- **Normalized Responses**: All failures are wrapped in standard error envelopes (`{ success: false, error: { code, message } }`), preventing internal stack traces and server internals from leaking to untrusted clients.
- **Path Traversal Guards**: Absolute and relative paths are normalized and resolved strictly against the project or workspace root using `assertWorkspacePath`.

### Layer 3: Agent Orchestrator Security Boundary
The core breakthrough in the 2026-09 hardening is the direct interception of all LLM actions within `AgentOrchestrator.prototype.executeTool()`:
- **No Direct Execution**: The orchestrator does not invoke raw Node.js `fs` or `child_process` modules directly.
- **Unified Security Dispatcher**: All calls to `read_file`, `write_file`, `apply_diff`, `run_terminal`, `execute_command`, `terminal`, `delete_file`, `list_directory`, and `read_file_tree` route exclusively through `executeProductionOperation(action, parameters, context)`.
- **Context Preservation**: Every execution carries a security context comprising `userId`, `projectId`, `planId`, `approvalToken`, and session identifiers.

### Layer 4: Capability Policies & Execution Guards
- **Capability-Based Access Control**:
  | Action | Required Capability | Risk Profile | Approval Policy |
  |--------|---------------------|--------------|-----------------|
  | `read_file` | `file:read` | Low | Allowed by default |
  | `list_directory` | `fs:list` | Low | Allowed by default |
  | `read_file_tree` | `fs:tree` | Low | Allowed by default |
  | `write_file` | `file:write` | Medium | Allowed within workspace |
  | `apply_diff` | `file:write` | Medium | Allowed within workspace |
  | `delete_file` | `file:delete` | High | Explicit approval required |
  | `run_terminal` | `terminal:exec` | Critical | Approval / Restricted shell |
  | `execute_command` | `terminal:exec` | Critical | Approval / Restricted shell |

- **Cryptographic Approval System**:
  - High-risk operations (`file:delete`, destructive commands like `rm -rf`, system alterations) generate a cryptographically signed HMAC approval challenge.
  - The operation will throw `ERR_APPROVAL_REQUIRED` until a valid `approvalToken` signed with the server secret is submitted.
- **ResourceGuard**:
  - Monitors event loop lag, RSS memory footprint, and call duration per tool execution.
  - Throttles or terminates tool runs exceeding configured execution quotas.
- **AuditSink & Forensics**:
  - Every evaluated operation, whether permitted, rejected, or errored, emits a tamper-evident audit record (`audit.emit()` / `audit.record()`).
  - Records include timestamp, operation, caller context, target path/command, decision, latency, and outcome.
  - Sinks maintain bounded event buffers (`maxEvents`) with automatic pruning to prevent memory exhaustion.

### Layer 5: Sandbox & Container Isolation
- **Docker Sandbox Engine** (`backend/routes/sandbox.js`):
  - Untrusted code generation and execution run inside ephemeral Docker containers (`ai-dost-sandbox-*`).
  - Containers mount exclusively the dedicated `/workspace` directory.
  - Ephemeral containers have CPU quotas, memory caps (e.g., 512MB), and idle timeouts (30 minutes) to eliminate runaway processes.

---

## 3. Threat Model & Mitigation Matrix

| Threat ID | Threat Vector | Impact | Mitigation in AI-Dost | Status |
|-----------|---------------|--------|------------------------|--------|
| **TH-01** | Path Traversal (`../../etc/passwd`, Windows drive escapes) | Arbitrary file read/write | `assertWorkspacePath` checks absolute paths, resolves symlinks, and validates against project workspace boundaries. | **MITIGATED** |
| **TH-02** | Arbitrary Command Injection via Agent LLM | Host RCE | Agent terminal tools gated by `ProductionHardeningRuntime` requiring explicit capabilities, command allowlisting, and Docker sandbox execution. | **MITIGATED** |
| **TH-03** | LLM Prompt Injection (Jailbreaking Agent) | Unauthorized file alteration / exfiltration | Strict schema validation, capability checks independent of LLM prompt, and mandatory user approval tokens for destructive actions. | **MITIGATED** |
| **TH-04** | Resource Exhaustion (DoS / Memory Leak) | Server crash / outage | `ResourceGuard` limits memory/execution time; `AuditSink` caps retention; container quotas enforce limits. | **MITIGATED** |
| **TH-05** | Credential / API Key Leakage in Logs | Key compromise | Scrubbing patterns in error handlers and logs; keys loaded strictly from `.env`; secrets omitted from audit payloads. | **MITIGATED** |
| **TH-06** | SQLite Foreign Key & Database Inconsistencies | Data corruption | Schema migration enforcing `slug`, `user_id`, and `updated_at` on project records. | **MITIGATED** |

---

## 4. Operational Security Checklist

- [x] Run backend as non-root user in containerized environments.
- [x] Verify `.env` permissions (`chmod 600` on POSIX systems).
- [x] Ensure `DEFAULT_CAPABILITY_BY_OPERATION` covers all registered agent tools.
- [x] Maintain automated test coverage for security runtime (`tests/orchestratorSecurityBoundary.test.js`).
- [x] Enforce zero direct bypasses to `executeProductionOperation`.
