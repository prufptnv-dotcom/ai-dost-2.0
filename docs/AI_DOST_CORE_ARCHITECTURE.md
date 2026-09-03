# AI-Dost — Core Architecture Freeze

**Document Type:** Architecture Freeze Specification  
**Status:** FROZEN — No source-code changes authorized under this document  
**Date:** 2026-09-01  
**Principle:** *Small Package, Big Impact*

---

## 1. First Principle

```
SIMPLE UI OUTSIDE
AUTONOMOUS SYSTEM INSIDE
```

The user interacts primarily through **conversation**. The system internally executes:

```
USER INTENT
  → AUTHORIZED CONTEXT
  → PLAN
  → CAPABILITY-CHECKED EXECUTION
  → OBSERVATION
  → VERIFICATION
  → REPAIR
  → DELIVERY
```

Internal complexity is never exposed unless contextually useful to the user.

---

## 2. High-Level Architecture (Actual)

```
                         AI-DOST
                            │
                    ┌───────┴───────┐
                    │   EXPERIENCE  │
                    └───────┬───────┘
                            │
        ┌────────┬────────┬─┼──┬────────┬──────────┐
        │        │        │ │  │        │          │
      Chat    Copilot  Images Voice  Docs   Resume  Agent
        │        │        │ │  │        │          │
        └────────┴────────┴─┼──┴────────┴──────────┘
                            │
                    UNIFIED AGENT CORE
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
      Planner          Executor           Verifier
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                    CONTEXT / MEMORY
                            │
              ┌─────────────┼─────────────────┐
              │             │                 │
           Project      Knowledge          User
            Graph         Index           Memory
              │             │                 │
              └─────────────┼─────────────────┘
                            │
                  TOOL / CONNECTOR LAYER
                            │
       ┌─────────┬─────────┬─────────┬─────────┬──────────┐
       │ Files   │ Browser │ Git     │Terminal │ Sandbox  │
       └─────────┴─────────┴─────────┴─────────┴──────────┘
                            │
                    SECURITY / POLICY
                            │
                  Sandbox • Permissions
                  Audit • Secrets • Limits
                            │
                    INFRASTRUCTURE
                            │
              Models • Queue • DB • Storage
              Observability • Deployment
```

---

## 3. Existing Implementation Inventory

### 3.1 Agent Runtime (`backend/agent/runtime/`)

| Module | File | Role | Status |
|--------|------|------|--------|
| AgentCoordinator | `AgentCoordinator.js` | Supervisor/Worker lifecycle, delegation depth, concurrency | IMPLEMENTED |
| ExecutionController | `ExecutionController.js` | Run/Step/ToolCall state machine, checkpoint/resume | IMPLEMENTED |
| PlannerExecutionLoop | `PlannerExecutionLoop.js` | Intent → Plan → Execute → Verify → Repair loop | IMPLEMENTED |
| TaskPlanner | `TaskPlanner.js` | LLM-backed plan generation with tool validation | IMPLEMENTED |
| ContextAssembler | `ContextAssembler.js` | Auth → Project → Workspace → RAG → Budget assembly | IMPLEMENTED |
| ContextBudgetManager | `ContextBudgetManager.js` | Token budget allocation with priority scoring | IMPLEMENTED |
| Supervisor | `Supervisor.js` | SUPERVISOR role with `orchestration.manage` only | IMPLEMENTED |
| ToolRegistry | `ToolRegistry.js` | Tool name → Tool instance registry | IMPLEMENTED |
| Tool | `Tool.js` | Base tool class with input validation | IMPLEMENTED |
| ResultValidator | `resultValidator.js` | Bounded, validated worker result envelopes | IMPLEMENTED |

### 3.2 Agent Policy (`backend/agent/policy/`)

| Module | Role | Status |
|--------|------|--------|
| CapabilityPolicy | Role → Capability matrix (SUPERVISOR, RESEARCHER, CODER, VERIFIER) | IMPLEMENTED |

### 3.3 Agent Verification (`backend/agent/verification/`)

| Module | Role | Status |
|--------|------|--------|
| VerificationContract | Canonical PASS/FAIL/BLOCKED check definitions | IMPLEMENTED |
| MultiAgentVerifier | Independent, read-only worker result verification | IMPLEMENTED |
| VisualVerifier | Screenshot-based visual verification | IMPLEMENTED |

### 3.4 Agent Arbitration (`backend/agent/arbitration/`)

| Module | Role | Status |
|--------|------|--------|
| SupervisorArbitrator | Deterministic COMPLETE/REPAIR/WAITING_FOR_USER/FAILED decisions | IMPLEMENTED |

### 3.5 Concurrency (`backend/agent/concurrency/`)

| Module | Role | Status |
|--------|------|--------|
| LockManager | File-level mutex for workspace mutation serialization | IMPLEMENTED |
| TaskScheduler | Concurrent task scheduling | IMPLEMENTED |

### 3.6 Tools (`backend/agent/tools/`)

| Tool | Capability | Status |
|------|-----------|--------|
| ReadFileTool | `filesystem.read` | IMPLEMENTED |
| WriteFileTool | `filesystem.write` | IMPLEMENTED |
| ListFilesTool | `filesystem.read` | IMPLEMENTED |
| TerminalTool | `terminal.execute` | IMPLEMENTED |

### 3.7 Database Layer (`backend/db/`)

| Component | Role | Status |
|-----------|------|--------|
| `index.js` | SQLite init, WAL, FK, migrations | IMPLEMENTED |
| `migrationRunner.js` | Versioned migration runner | IMPLEMENTED |
| 15 DAOs | CRUD for all entity types | IMPLEMENTED |
| 4 migrations | Universal schema → Agent runtime → Handoffs → Results | IMPLEMENTED |

### 3.8 Services Layer (`backend/services/`)

| Service | Role | Status |
|---------|------|--------|
| geminiService | Primary LLM (Gemini Flash) | IMPLEMENTED |
| groqService | Fallback LLM | IMPLEMENTED |
| cerebrasService | Fallback LLM | IMPLEMENTED |
| nvidiaService | Fallback LLM | IMPLEMENTED |
| togetherService | Fallback LLM | IMPLEMENTED |
| deepseekService | Fallback LLM | IMPLEMENTED |
| mistralService | Fallback LLM | IMPLEMENTED |
| huggingfaceService | Fallback LLM | IMPLEMENTED |
| openrouterService | Fallback LLM | IMPLEMENTED |
| openaiService | Fallback LLM | IMPLEMENTED |
| apiClient (RobustApiClient) | Circuit breaker, rate limiter, retry | IMPLEMENTED |
| plannerService | Project scaffolding (react-vite/nextjs/astro/sveltekit) | IMPLEMENTED |
| workspaceManager | Canonical workspace path resolution, ownership | IMPLEMENTED |
| projectAuthorization | Per-project BOLA/IDOR defense | IMPLEMENTED |
| artifactService | SHA-256 validated artifact registry | IMPLEMENTED |
| retrievalService | Node→Python RAG boundary | IMPLEMENTED |
| indexSyncService | Push entity hashes to Python index | IMPLEMENTED |
| memoryService | Project-scoped persistent memory | IMPLEMENTED |
| agentHandoffService | Handoff state machine + idempotency | IMPLEMENTED |
| telegramBot | Free Telegram integration | IMPLEMENTED |

### 3.9 Frontend (`frontend/`)

| Area | Key Components | Status |
|------|---------------|--------|
| Shell | AppShell, CommandRail, Sidebar, TopBar | IMPLEMENTED |
| Chat | ChatView, MessageStream, ChatComposer, ToolExecutionCard, VerificationCard, ArtifactCard | IMPLEMENTED |
| IDE | CopilotIDE, FileExplorer, WorkspaceTabs, EditorToolbar, MonacoTheme, TerminalDock | IMPLEMENTED |
| Agent | AgentView (Supervisor/Worker tree, timeline, approval surface) | IMPLEMENTED |
| Views | ProjectsView, ArtifactsView, HistoryView, SettingsView, VoiceView, ImageView, ResumeView | IMPLEMENTED |
| Design | tokens.css, Editorial Workbench (Ink/Paper), terracotta accent | FROZEN |

---

## 4. Canonical Data Authority (FROZEN)

```
Universal DB (SQLite)        = canonical structured truth
Workspace (disk)             = canonical physical project content
RAG/vector index (ChromaDB)  = derived index (rebuild-safe)
Chat message cache           = disposable
LLM context window           = transient

No derived system may become authoritative over the Universal DB.
```

All state mutations flow through the Universal DB. The RAG index is strictly a derived view that can be rebuilt from canonical sources at any time.

---

## 5. Autonomy Pipeline Contract

Every agent execution must follow this pipeline:

```
1. USER INTENT              (received via chat/API/Telegram)
2. AUTHORIZED CONTEXT       (ContextAssembler: auth → project → workspace → RAG → budget)
3. PLAN                     (TaskPlanner: LLM-generated, tool-validated, step-bounded)
4. CAPABILITY-CHECKED EXEC  (ExecutionController: role → CapabilityPolicy → Tool)
5. OBSERVATION              (ToolCall output recorded to DB)
6. VERIFICATION             (MultiAgentVerifier: independent, read-only, evidence-fresh)
7. REPAIR                   (SupervisorArbitrator: max 3 cycles, then WAITING_FOR_USER)
8. DELIVERY                 (Result persisted in handoff.result_json)
```

No tool may bypass: Authorization, Capability Policy, ExecutionController, or Workspace Isolation.

---

## 6. Modular Capability Architecture (FROZEN)

Existing capabilities remain self-contained modules:

| Capability | Backend Route | Frontend View | Status |
|-----------|---------------|---------------|--------|
| Chat | `/api/chat/*`, `routes/chat.js` | ChatView | ACTIVE |
| Agent | `/api/agent/*`, `routes/agent.js` | AgentView | ACTIVE |
| IDE/Copilot | `/api/agent/*` (workspace tools) | CopilotIDE | ACTIVE |
| Documents | `/api/document/*`, `routes/documents.js` | ArtifactsView | ACTIVE |
| Images | `/api/image/*`, `routes/image.js` | ImageView | ACTIVE |
| Resume | embedded in chat/documents | ResumeView | ACTIVE |
| Voice | Edge TTS, `/api/agent/ai/tts` | VoiceView | ACTIVE |
| Workspace | workspaceManager, sandbox | CopilotIDE | ACTIVE |
| Git | `routes/git.js` | GitControlModal | ACTIVE |
| Search/RAG | retrievalService → ai-engine | via ContextAssembler | ACTIVE |
| MCP | `backend/mcp/` | McpPanel | ACTIVE |
| Telegram | telegramBot.js | N/A (external) | ACTIVE |

Capabilities are NOT coupled to UI navigation. The user invokes them through natural language.

---

## 7. Security Boundaries (FROZEN)

| Boundary | Mechanism | Status |
|----------|-----------|--------|
| Project isolation | `projectAuthorization.authorize()` on every access | PASS |
| User isolation | `user_id` FK on projects, conversations, artifacts | PASS |
| Workspace containment | `WorkspaceManager.getWorkspacePath()` with path-traversal defense | PASS |
| Tool capability policy | `CapabilityPolicy.assertAllowed(role, capability)` | PASS |
| Agent role trust | Trusted `runtime_metadata.role` set by AgentCoordinator only | PASS |
| Handoff authorization | `collectWorkerResult` verifies requesting user owns project | PASS |
| RAG tenant isolation | `project_id` filter enforced at Node.js boundary before Python query | PASS |
| Delegation depth | MAX_DELEGATION_DEPTH = 3 | PASS |
| Worker concurrency | MAX_ACTIVE_WORKERS_PER_PROJECT = 10 | PASS |
| Repair bound | MAX_REPAIR_CYCLES = 3, then WAITING_FOR_USER | PASS |

---

## 8. Failure Philosophy

| Failure Scenario | Response | Status |
|-----------------|----------|--------|
| RAG unavailable | Lexical/exact retrieval fallback | IMPLEMENTED |
| Optional LLM unavailable | Provider cascade fallback (10 providers) | IMPLEMENTED |
| Worker fails | Repair → retry → escalation (max 3) | IMPLEMENTED |
| Frontend disconnects | Task continues if persisted in DB | IMPLEMENTED |
| Backend restarts | Checkpoint recovery via `PlannerExecutionLoop.resume()` | IMPLEMENTED |
| Cache/index corrupted | Rebuild from canonical authority (Universal DB + Workspace) | IMPLEMENTED |
| Max repairs exceeded | WAITING_FOR_USER (human escalation) | IMPLEMENTED |

**Rule:** Never silently corrupt state. All state mutations go through the canonical DB.

---

## 9. UI Freeze

The **Editorial Workbench** design system is FROZEN:

- ChatView: FROZEN
- CommandRail: FROZEN
- Composer: FROZEN
- CodeBlock: FROZEN
- ThinkingIndicator: FROZEN
- Theme system (tokens.css): FROZEN
- Chat CSS / layout: FROZEN

No new UI elements, sidebar sections, dashboards, tool panels, or capability menus are to be added in this phase.

---

## 10. Audit Summary

| Area | Verdict | Evidence |
|------|---------|----------|
| Core Architecture | PASS | All 10 runtime modules implemented and tested |
| Autonomy Pipeline | PASS | Full Intent → Plan → Execute → Verify → Repair → Deliver chain |
| Data Authority | PASS | Universal DB is sole canonical authority; RAG is derived |
| Security Boundaries | PASS | 10/10 boundaries verified with tests |
| Modular Capabilities | PASS | 12 capabilities as independent modules |
| Failure Degradation | PASS | 7/7 failure scenarios handled |
| UI Freeze | PASS | Editorial Workbench frozen per Phase 3.8/3.R |
| Resource Awareness | NEEDS_REFACTOR | Runtime profiles not yet formalized (see RUNTIME_PROFILES.md) |
| Mobile Strategy | NEEDS_REFACTOR | Not yet architected (see RUNTIME_PROFILES.md) |
| Database Strategy | DECISION NEEDED | See DATABASE_DRIVER_ARCHITECTURE_DECISION.md |
| Performance Baselines | NOT_MEASURED | No instrumented benchmarks exist |

---

## 11. What This Document Does NOT Authorize

- Source code modifications
- Dependency changes
- UI redesign
- New feature additions
- Git commit / tag / push / deploy
- Phase 5.5 evidence generation (blocked on environment)
