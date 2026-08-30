# PHASE 2 — AUTONOMOUS AGENT RUNTIME ARCHITECTURE DISCOVERY

## 1. Executive Summary
This document defines the target architectural vision for AI-Dost Phase 2 (Autonomous Agent Runtime). Based on the frozen and verified Phase 1.2 foundation, this design transitions the platform from a human-driven AI assistant into an autonomous runtime capable of multi-step planning, iterative execution, verification, and repair, without compromising the canonical strictures established in Phase 1.

## 2. Phase 1.2 Frozen Foundation
The foundation requires that the following invariants remain unbroken:
- **WorkspaceManager**: The singular authority mapping logical projects to isolated physical workspaces.
- **Universal DB (DAOs)**: The sole source of truth for metadata (Projects, Artifacts, Conversations, Memory).
- **ProjectAuthorizationService**: The boundary ensuring tenant isolation (Users/Projects).
- **Physical Disk**: The canonical execution boundary for source code and git.

## 3. Current Agent Architecture
Currently, the agent logic is heavily consolidated:
- **`AgentOrchestrator` (`orchestrator.js`)**: A monolithic component handling LLM cascades, planning, prompt building, manual JSON tool parsing, file-system execution, and direct interaction with sandboxes.
- **Tools**: Hardcoded directly as switch-cases / methods within `orchestrator.js` (`read_file`, `write_file`, `execute_command`, `sandbox_create`).
- **Verification**: `VisualVerifier.js` exists independently but is statically invoked rather than functioning as part of a modular observation loop.
- **Memory**: Driven by `learning.js` and `memoryService.js` acting as semantic caches, but not inherently guiding autonomous execution loops.

## 4. Target Autonomous Runtime
The target architecture refactors the monolith into a modular, acyclic control loop:
```text
                         USER INTENT
                              │
                              ▼
                    Intent Understanding
                              │
                              ▼
                    Project Context Assembly
                              │
                              ▼
                         Task Planner
                              │
                              ▼
                      Execution Controller
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
             Filesystem    Terminal     Browser
                 │            │            │
                 └────────────┼────────────┘
                              ▼
                         Observation
                              │
                              ▼
                         Verification
                              │
                    ┌─────────┴─────────┐
                    │                   │
                  PASS                FAIL
                    │                   │
                    │                 Repair
                    │                   │
                    └─────────◄─────────┘
                              │
                              ▼
                       State Persistence
                              │
                              ▼
                     Continue / Complete
```

## 5. Agent State Model
To support long-running tasks and durability, state will be modeled as:
- **`AgentTask`**: Represents the overarching goal (DB).
- **`AgentRun`**: A specific attempt to execute the task (DB).
- **`AgentStep`**: A node within a Plan (DB/Memory).
- **`Plan`**: The DAG/Sequence of steps (Process memory + serialized to DB).
- **`ToolCall` & `ToolResult`**: Immutable input/output records (DB).
- **`Observation` & `VerificationResult`**: Output artifacts of the verification boundary (DB/ArtifactRegistry).
- **`Checkpoint`**: Serialized process state capable of resuming on crash (DB/Filesystem).

## 6. Agent Lifecycle
The state machine for `AgentTask` / `AgentRun`:
1. `CREATED`
2. `PLANNING`
3. `READY`
4. `EXECUTING`
5. `OBSERVING`
6. `VERIFYING` -> `SUCCESS` (COMPLETED) or `FAILURE`
7. `REPAIRING` -> returns to `EXECUTING`
- Additional States: `PAUSED`, `CANCELLED`, `FAILED`, `BLOCKED`, `WAITING_FOR_USER`.
- Illegal Transitions: `COMPLETED` -> `EXECUTING`, `EXECUTING` -> `PLANNING`.

## 7. Tool Architecture
Existing monolithic tool capabilities will be refactored into a canonical `Tool` abstraction:
```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  permissions: PermissionMask;
  execute(input: any, context: ExecutionContext): Promise<ToolResult>;
  resultSchema: JSONSchema;
}
```
**Categories**:
- Filesystem (`read`, `write`, `diff`)
- Terminal (`exec`, `bash`)
- Browser (`navigate`, `extract`)
- Verification (`lint`, `test`)

## 8. Security Model
Agents run under a strict capability model:
```text
User 
 ↓ 
ProjectAuthorizationService 
 ↓ 
AgentTask (inherits User/Project context) 
 ↓ 
Tool Permission Boundary 
 ↓ 
WorkspaceManager (physical mapping) 
 ↓ 
Execution
```
- Agents CANNOT access OS `/tmp`, absolute external paths, or network hosts outside the defined tool boundary.
- Cross-project memory leakage is blocked by DAO `project_id` filters.

## 9. Context Assembly
`ContextAssembler` conceptually aggregates necessary data for the Planner/Executor:
- Pulls from: Conversation history, `ContextNodeDAO` (Memory), current physical workspace state.
- **Future Extension**: Embeddings, Vector Search, and semantic retrieval will plug into `ContextAssembler` and return vectors mapped strictly to `ContextNodeDAO`.

## 10. Planning Boundary
The Planner is strictly decoupled from Execution.
```text
Planner (LLM) -> generates Plan/Steps -> Execution Controller -> requests Tools -> WorkspaceManager
```
The Planner never touches the disk. It issues instructions.

## 11. Execution Controller
The `ExecutionController` manages the step-by-step lifecycle:
- Operates **asynchronously** via queue/event-loop.
- Handles timeouts, cancellation, and concurrency.
- Records idempotency keys to prevent duplicate execution on retry.

## 12. Observation & Verification
- **Observation**: The raw output of a tool (stdout, filesystem diff, browser DOM).
- **Verification**: The semantic check (e.g., `VisualVerifier` layout matching, Jest suite passing, ESLint returning 0 errors).
- Verifiers act as standalone tools/strategies.

## 13. Failure & Repair
Failures are strongly typed: `TOOL_FAILURE`, `VALIDATION_FAILURE`, `BUILD_FAILURE`, `SECURITY_FAILURE`, etc.
```text
Failure -> Classify -> Retry/Repair Decision -> Execute Repair -> Verify
```
*Crucial*: `SECURITY_FAILURE` (e.g., path traversal attempt) immediately halts the run and drops to `FAILED` or `WAITING_FOR_USER`. It is NEVER auto-repaired.

## 14. Checkpoint / Resume
To survive server restarts:
- Long-running `ExecutionController` state is serialized to a `Checkpoint` entity in SQLite (or physical JSON proxy mapping) at the end of each `AgentStep`.
- On boot, the server re-hydrates `EXECUTING` tasks from Checkpoints.

## 15. Human-in-the-Loop
Tasks attempting operations lacking automatic clearance (e.g., `npm publish`, destructive `rm -rf`, production DB queries) transition to `WAITING_FOR_USER`. UI sockets deliver an approval challenge.

## 16. Observability
Telemetry captures: `run_id`, `step_id`, `tool_name`, `latency`, `tokens`, `cost`, `status`.
This leverages `MessageDAO` where appropriate, augmenting with a lightweight metric aggregator if required.

## 17. Future Multi-Agent Extension
Phase 2 must leave room for a Supervisor model:
```text
Supervisor -> [Planner Agent, Coding Agent, Browser Agent, Verification Agent]
```
The `ExecutionController` will be designed to address a generic `Agent`, not hardcoding a single persona.

## 18. Phase 2A–2G Dependency Graph
- **Phase 2A**: Agent runtime foundation (State Model, Lifecycles, decoupled Executor/Planner).
- **Phase 2B**: Canonical Tool interfaces.
- **Phase 2C**: Iterative planning + execution loop.
- **Phase 2D**: Verification + repair loops.
- **Phase 2E**: Durable checkpoints / resume.
- **Phase 2F**: Advanced context retrieval (Embeddings/RAG).
- **Phase 2G**: Multi-agent orchestration.

## 19. Database Evolution Requirements
New Universal Schema expansions required (to be executed in 2A):
- `agent_tasks`, `agent_runs`, `agent_steps`, `tool_calls`.

## 20. API / Service Boundaries
- API routes act as triggers for the `ExecutionController`, they do not block waiting for a 10-minute task.
- Subscriptions stream updates via WebSocket (SSE/Socket.io).

## 21. Concurrency Model
- Project-level file-system mutation locks will be introduced. Only one `AgentRun` may actively mutate a single `workspace_id` at a time.

## 22. Threat Model
- **Threat**: Agent writes malicious payload. **Mitigation**: Sandbox isolation, `WorkspaceManager` constraints.
- **Threat**: Agent hallucinates dangerous commands. **Mitigation**: Human-in-the-Loop for destructive execution constraints.

## 23. Performance Considerations
- Agent checkpoints must be lightweight.
- Token context window constraints will require the `ContextAssembler` to aggressively summarize or window history.

## 24. Risks
- Infinite repair loops consuming LLM quotas.
- Context window overflow.

## 25. Open Architectural Questions
- Should `AgentStep` logs be exposed directly as Chat Messages (`MessageDAO`), or kept separate and summarized? (Recommendation: Keep separate, summarize into Chat).

## 26. Recommended Phase 2A Implementation Scope
Phase 2A should implement ONLY:
- The decoupled `Agent`, `ExecutionController`, and `Planner` class scaffolds.
- The `Tool` abstraction interface.
- SQLite schema migrations for `agent_tasks` and `agent_runs`.
- Porting 2-3 existing monolithic capabilities (read/write/exec) to the new `Tool` interface.
