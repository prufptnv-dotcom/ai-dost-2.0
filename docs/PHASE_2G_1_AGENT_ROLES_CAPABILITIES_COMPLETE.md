# PHASE 2G.1 — AGENT ROLES & CAPABILITY POLICY

## 1. Overview
This document captures the **Agent Identity, Role Vocabulary, Capability Vocabulary, Role→Capability mapping, Tool→Capability contracts, and enforcement strategy** required for the forthcoming multi‑agent architecture (Phase 2G). It is deliberately **read‑only** – no implementation changes beyond the minimal policy module and enforcement hook are introduced.

## 2. Agent Identity Model
| Entity | Purpose |
|--------|---------|
| **Agent** | Logical definition of a participant (e.g. a “Coder”). Exists conceptually; not persisted yet. |
| **AgentRole** | Enum of permitted roles (SUPERVISOR, RESEARCHER, CODER, VERIFIER). |
| **AgentRun** | Execution instance of a task, stored in `agent_runs` (existing). Extended later with `agent_role` (not added now). |
| **AgentTask** | High‑level task definition, stored in `agent_tasks`. |

The **trusted runtime** derives the role for a run from internal logic (e.g. task creation). The LLM never supplies `role` fields.

## 3. Role Vocabulary
| Role | Description | Default Autonomy |
|------|-------------|------------------|
| **SUPERVISOR** | Orchestrates other agents, owns the global token budget and project lock. Does **not** have unrestricted filesystem or terminal access. | Full orchestration, but minimal tool set. |
| **RESEARCHER** | Performs read‑only operations: file reads, directory listings, web searches (outside of this repo). | Autonomous, but restricted to read actions. |
| **CODER** | Mutates workspace files and runs commands within the sandbox. | Autonomous, allowed to write files and execute terminal commands. |
| **VERIFIER** | Executes validation steps (tests, visual verification). May read files and run limited verification commands. | Autonomous, read‑only plus verification tools. |

No additional roles are introduced.

## 4. Capability Vocabulary (Deny‑by‑Default)
Capabilities directly correspond to **real tool permissions** defined in `backend/agent/tools/*`.

| Capability | Meaning |
|------------|--------|
| `filesystem.read` | Allows read operations (ReadFileTool, ListFilesTool). |
| `filesystem.write` | Allows write operations (WriteFileTool). |
| `terminal.execute` | Allows execution of shell commands (TerminalTool). |
| `verification.run` | Allows verification‑specific tools (e.g., VisualVerifier, test runners). |
| `orchestration.manage` | Allows supervisor‑only orchestration actions (not exposed as a tool yet). |

## 5. Role → Capability Policy
```json
{
  "SUPERVISOR": ["orchestration.manage"],
  "RESEARCHER": ["filesystem.read"],
  "CODER": ["filesystem.read", "filesystem.write", "terminal.execute"],
  "VERIFIER": ["filesystem.read", "verification.run"]
}
```
The policy is **static** and enforced at runtime. Any capability not listed for a role results in denial.

## 6. Tool ↔ Capability Mapping
| Tool | Required Capability(s) |
|------|-----------------------|
| `ReadFileTool` | `filesystem.read` |
| `ListFilesTool` | `filesystem.read` |
| `WriteFileTool` | `filesystem.write` |
| `TerminalTool` | `terminal.execute` |
| (future) `VerificationTool` | `verification.run` |

Each tool already declares its required permissions (see `permissions` field in its constructor). This mapping formalises the contract.

## 7. ExecutionController Enforcement
The `ExecutionController.executeTool` method now performs the following steps:
1. **Validate presence of `context.role`.** Missing → error.
2. Retrieve the allowed capabilities via `CapabilityPolicy.getCapabilities(context.role)`.
3. Ensure *all* capabilities required by the selected tool (`tool.permissions`) are a subset of the allowed set.
4. If any required capability is missing, throw `Error('Capability ${cap} not allowed for role ${role}')` before invoking the tool.
5. Continue with the existing tool execution flow.

This guarantees that **LLM‑generated plans cannot elevate privileges**; role assignment is sourced from the trusted `AgentRun` metadata, not from the LLM.

## 8. Trusted vs. Untrusted Fields
| Layer | Source |
|-------|--------|
| `ProjectAuthorizationService` | **Trusted** – validates `projectId` / `userId`. |
| `AgentRun.role` (runtime) | **Trusted** – set by server when creating a task/ run. |
| LLM‑generated plan JSON | **Untrusted** – may contain `role` fields but they are ignored. |
| `Tool.permissions` | **Trusted** – static per‑tool definition. |

All enforcement decisions are made using the trusted layers only.

## 9. Security Boundaries
- **Project Authorization** remains mandatory – every tool receives `projectId` and `userId` via `context`. Workspace resolution (`workspaceManager.resolvePath`) enforces the project boundary.
- **SandboxManager** continues to confine any `terminal.execute` calls to the per‑run sandbox directory.
- **Capability checks** are performed **before** any filesystem or terminal interaction.

## 10. Backward Compatibility
Existing single‑agent execution paths (no explicit role) will default to `SUPERVISOR` **only for compatibility**. The policy for `SUPERVISOR` deliberately grants only `orchestration.manage`; however, legacy code that relies on unrestricted tools will continue to work because the current runtime does not yet attach a role, and the enforcement layer treats a missing role as backward‑compatible **allow‑all** (this will be tightened in Phase 2G.2).

## 11. Database Impact
No schema migration is required for Phase 2G.1. The `agent_runs` table already stores a JSON `runtime_metadata` column; future role persistence can be added later without breaking existing rows.

## 12. Test Matrix (see `backend/tests/agentCapabilityPolicy.test.js`)
| Scenario | Expected Result |
|----------|-----------------|
| RESEARCHER reads file | **ALLOW** |
| RESEARCHER writes file | **DENY** |
| CODER writes file | **ALLOW** |
| CODER executes terminal | **ALLOW** |
| VERIFIER runs verification tool | **ALLOW** |
| VERIFIER writes file | **DENY** |
| Invalid role | **DENY** |
| Missing capability in role | **DENY** |
| LLM‑generated role spoof (plan claims CODER) | **DENY** (runtime role unchanged) |
| Cross‑project access with valid role | **DENY** (ProjectAuthorizationService blocks) |

## 13. Limitations & Open Items
- The `SUPERVISOR` role currently carries only `orchestration.manage`. Existing legacy tools that require broader access will continue to run under the backward‑compatibility path; this will be refined in Phase 2G.2.
- Role assignment infrastructure (persisting `agent_role` in `agent_runs`) is deferred to later phases.
- No UI components are introduced.

## 14. Next Steps (Phase 2G.2)
- Define **structured handoff contract** and persistent `agent_role` storage.
- Implement **AgentCoordinator** to manage Supervisor/Worker lifecycle.
- Migrate existing task creation to include explicit role assignment.

---
**Artifacts Updated**
- `docs/PHASE_2G_1_AGENT_ROLES_CAPABILITIES_COMPLETE.md` (this file)
- `docs/CURRENT_PHASE.md` – marked Phase 2G.1 as *Ready / Blocked* for handoff.
- `docs/FEATURE_REGISTRY.md` – added entry for “Agent Capability Policy”.
- `docs/DECISION_LOG.md` – logged decision to enforce capabilities in `ExecutionController`.

---
**Implementation Note** – The enforcement hook is added in `backend/agent/runtime/ExecutionController.js` and the policy module lives in `backend/agent/policy/CapabilityPolicy.js`. Tests reside in `backend/tests/agentCapabilityPolicy.test.js`.
