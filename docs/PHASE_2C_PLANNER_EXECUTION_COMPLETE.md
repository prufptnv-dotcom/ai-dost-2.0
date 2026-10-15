# PHASE 2C PLANNER + EXECUTION LOOP COMPLETE

## Architecture Overview
Phase 2C completes the wiring of the autonomous agent execution layer by replacing the monolithic `AgentOrchestrator` planner sequence with an isolated, secure, and state-managed `PlannerExecutionLoop`. 

### The Components
1. **ContextAssembler (Read-Only)**: Securely fetches workspace metadata, explicit available tools, and project contexts via `ProjectAuthorizationService` and `WorkspaceManager`.
2. **TaskPlanner (Pure Intelligence)**: Accepts user intent and read-only context, generating a structured JSON plan. Validates schema, input property types, tool existence, and semantic step requirements. It operates completely disconnected from file/DB/network capabilities.
3. **PlannerExecutionLoop**: Orchestrates Task/Run/Step creation, sequences Tool calls to the `ExecutionController`, records `Observation` events natively via DAOs, and drives the state machine forward (or aborts on failure).

## Security Boundaries & Invariants
- The LLM has zero direct shell, filesystem, or database access.
- All actions pass strictly through the `ExecutionController` which invokes `ToolRegistry` items.
- All tools rely on the `WorkspaceManager` and `ProjectAuthorizationService` natively.
- Traversal boundaries (`../`, UNC, Absolute paths, Symlink escapes) are enforced at the WorkspaceManager resolution layer, independent of the LLM.
- **Planner is fully untrusted**: Plans containing duplicate step IDs, undefined tools, or inputs that break tool property validations are discarded synchronously before execution begins.

## Execution Lifecycle
1. `AgentTask` created as `PENDING`.
2. LLM (`TaskPlanner`) generates Plan.
3. `AgentRun` created as `PENDING` -> transitions to `RUNNING`.
4. `AgentStep`s execute sequentially. `TOOL_OUTPUT` or `TOOL_ERROR` observations are tracked per step.
5. If step fails, loop halts -> Run transitions to `FAILED` -> Task transitions to `FAILED`.
6. If steps complete, Run transitions to `SUCCEEDED` -> Task transitions to `COMPLETED`.

## Persistence Model
All DAOs generated in Phase 2A are natively utilized:
- `AgentTaskDAO`
- `AgentRunDAO`
- `AgentStepDAO`
- `ToolCallDAO`
- `ObservationDAO`

## Deferred Tasks (Future Phases)
- **Phase 2D (Verification/Repair)**: Implementing `VerificationResult` flows and allowing the ExecutionLoop to retry failed steps rather than instantly aborting the run.
- **Phase 2E (Checkpoint/Resume)**: Serializing loop states and context windows so long-running tasks can be suspended and resumed by the user.
- **Phase 2F (RAG / Embeddings)**: Extending `ContextAssembler` to perform localized semantic document search.
- **Phase 2G (Multi-Agent)**: Multiple specialized planner profiles resolving into distinct sub-tasks.

## Legacy Compatibility
- `backend/agent/orchestrator.js` still acts as the primary monolithic flow for Phase 0.x / 1.x UI requests to ensure front-end stability while the final autonomous loop is hardened.
- The next step (Phase 2D/2E) will connect the UI/Frontend strictly to `PlannerExecutionLoop`.
