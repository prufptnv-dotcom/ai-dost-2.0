# PHASE 2E: DURABLE CHECKPOINTS & RESUME COMPLETE

## Architecture Overview
Phase 2E introduces robust crash resilience to the autonomous agent execution cycle. By serializing the in-memory execution queue (`stepQueue`), `repairAttempts`, and the overall `goal` into the `AgentRun` entity, the system can transparently recover from hard crashes (e.g. SIGKILL, out-of-memory, server restarts) without losing context or restarting tasks from scratch.

### 1. The Metadata Schema
The `AgentRunDAO` was extended with an `updateMetadata(id, metadata)` capability, serializing arbitrary JSON payloads into the `runtime_metadata` TEXT column of the `agent_runs` table.

### 2. ExecutionController Checkpoint API
- `saveCheckpoint(runId, state)`: Persists the active `stepQueue` to the DB.
- `loadCheckpoint(runId)`: Deserializes the step-queue and associated repair counters.
- `recoverStaleSteps(runId)`: Sweeps the `agent_steps` table. Any steps left in the `RUNNING` state due to a hard process crash are gracefully failed over to `FAILED` with a predefined error message: `"Process crashed during execution"`. 

### 3. Loop Resumption Semantics
The `PlannerExecutionLoop` was extended with a `resume(runId, projectId, userId)` method.
1. The original Project Context is re-authorized and re-assembled.
2. `recoverStaleSteps()` cleans up mid-flight tool executions that hung.
3. The checkpoint (`stepQueue`, `repairAttempts`, `goal`) is loaded.
4. If the run was partially completed but stalled in `PENDING` or `WAITING`, it transitions back to `RUNNING`.
5. The `while (true)` loop re-drains the queue from exactly where it left off.
6. If the stale step was marked as `FAILED`, the loop's natural Phase 2D repair mechanisms immediately activate, passing the crash context to the LLM to generate a recovery plan.

## Maintained Invariants
- Execution remains purely deterministic.
- Zero manual database connections exist in the planner; DAOs remain the strict source of truth.
- State machine invariants are intact. `startRun()` strictly guarantees that an agent isn't resumed from `SUCCEEDED` or `CANCELLED`.
- Cross-project memory leakage remains blocked via the explicit `projectId`/`userId` requirements in `resume()`.

## Next Steps
- **Phase 2F (Context Retrieval)**: Implementing vector embeddings/RAG for the `ContextAssembler` so the planner has semantic awareness of large projects.
- **Phase 2G (Multi-Agent Sub-Delegation)**: Allowing tools to spawn child instances of `AgentTask` to achieve deeply nested multi-step sub-goals.
