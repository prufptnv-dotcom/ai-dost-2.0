# PHASE 2A — AGENT RUNTIME FOUNDATION & STATE MODEL

## Executive Summary
Phase 2A implements the database foundation, state machine, and Tool abstractions required for the Autonomous Agent Runtime without introducing full autonomous intelligence (RAG, multi-agent, planning loops). We successfully added resilient tracking mechanisms (`ExecutionController`) and enforced all Phase 1.2 strict canonical and security boundaries.

## Implementation Details

### Database Schema (Universal DB)
Migration `002_agent_runtime.js` expands the universal SQLite store idempotently:
1. **`agent_tasks`**: Defines a high-level intent (`project_id`, `conversation_id`, `user_id`).
2. **`agent_runs`**: Represents a specific executable instance of a task (`task_id`, `attempt`, `started_at`).
3. **`agent_steps`**: A sequential component of a run (`step_type`, `input`, `output`).
4. **`tool_calls`**: Tracks distinct capabilities fired during a step.
5. **`observations`**: Records state changes or output detected after a step/tool call.
6. **`verification_results`**: Persists semantic success/failure evaluation.

All relationships enforce cascading foreign key referential integrity tied inherently to the `Project`.

### ExecutionController (State Machine)
- Extracted runtime execution responsibilities from the monolithic `AgentOrchestrator`.
- **States Enforced**: `PENDING`, `RUNNING`, `WAITING`, `VERIFYING`, `SUCCEEDED`, `FAILED`, `CANCELLED`.
- Designed to refuse invalid transitions (e.g., `SUCCEEDED` -> `RUNNING`).
- Synchronously updates DAOs guaranteeing that an execution graph survives a process crash (Foundation for Checkpoint/Resume).

### Canonical Tool Abstraction
Implemented `backend/agent/runtime/Tool.js`:
- Standardized inputs and validation (`inputSchema`).
- Forces explicit passing of `context` to tools (preventing implicit global bypasses).
- Retained original `orchestrator.js` behavior unaltered for backward compatibility while new Tools scale.

### Security Invariants Retained
1. **Workspace Boundary**: Tools receive `context.workspaceManager.getWorkspacePath(projectId)`. They never use `os.tmpdir()` directly or bypass security resolution.
2. **Authorization Boundary**: The runtime context is exclusively fed after crossing the `ProjectAuthorizationService` middleware.

### Tests
- Created `agentRuntime.test.js` validating 16 distinct runtime constraints (Cross-Project isolation, State Transitions, DAO persistence, Checkpoint stability).
- Existing test suite (68 Backend + 24 Frontend) runs untouched. 

### Deferred
- **Phase 2B (Tools Porting)**: Migrating the actual logic (bash, python, browser) inside `orchestrator.js` into implementations of `Tool.js`.
- **Phase 2C (Planner)**: Creating the intelligence to dynamically populate `agent_steps`.
- **Phase 2F (Context/RAG)**: Embeddings, Semantic retrieval.
