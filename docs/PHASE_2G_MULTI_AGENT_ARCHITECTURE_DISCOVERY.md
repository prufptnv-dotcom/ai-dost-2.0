# PHASE 2G — MULTI-AGENT / ADVANCED AUTONOMY ARCHITECTURE DISCOVERY

## 1. Executive Summary
AI-Dost has matured into a highly reliable single-agent autonomous system complete with deterministic planning, crash-safe checkpointing, RAG context integration, and verification loops. Phase 2G introduces Multi-Agent capabilities, transitioning the runtime from a monolithic ReAct loop to a specialized, role-based ecosystem.

This document outlines the architectural blueprints for Multi-Agent Autonomy, ensuring that specialization, concurrency, and inter-agent communication strictly adhere to the frozen Phase 2A-2F foundation (Canonical Source Authority, Security, and Bounded Budgets).

## 2. Frozen Phase 2A–2F Foundation
The following components are **immutable architectural authorities**:
- **Universal DB & Workspace**: The sole canonical sources of truth.
- **ContextAssembler & ContextBudgetManager**: The exclusive gateway for LLM context, bounded by strict token budgets.
- **ProjectAuthorizationService**: The unbypassable security gateway.
- **ArtifactDAO / MemoryService**: Canonical storage for generated outputs and decisions.
- **PlannerExecutionLoop / ExecutionController**: The resilient, crash-safe step runner.

## 3. Current Single-Agent Architecture
```text
User Request
 ↓
ContextAssembler (Hydrates RAG, Budget, Project, Workspace)
 ↓
TaskPlanner (Generates sequential ReAct steps)
 ↓
PlannerExecutionLoop (Orchestrates Run)
 ↓
ExecutionController (Manages state, checkpoints, db tracking)
 ↓
ToolRegistry (Executes capability)
 ↓
Observation -> Verification -> Repair -> Checkpoint
```
**Audit Characteristics**:
- **Owner**: `PlannerExecutionLoop` drives the sole active `run_id`.
- **Concurrency**: Fully sequential per task.
- **Security**: Bound to user/project via `ContextAssembler`.
- **State**: Checkpointed at the step-level via `ExecutionController`.

## 4. Multi-Agent Use Cases (Why specialize?)
Multi-agent overhead is only justified where context pollution or tool access risks degrade performance.
- **Research + Coding (Sequential)**: A researcher explores docs/web, packages a precise specification, and hands off to a coder. Prevents the coder's context from overflowing with irrelevant search results.
- **Browser UI + Frontend Repair (Parallel/Supervisor)**: A UI inspector continuously feeds visual verification data while a Coder applies DOM changes.
- **Security Review (Independent Verification)**: A separate Verifier agent, strictly denied write-access, audits the Coder's pull request.

**Conclusion**: Single-agent remains superior for simple sequential tasks. Multi-agent is justified for **Separation of Concerns (Security/Context)** and **Independent Verification**.

## 5. Recommended Topology: Hierarchical (Supervisor + Workers)
```text
      [ User ]
         ↓
  [ SUPERVISOR ] (Maintains Goal, Context Budget, Orchestration)
    ↙        ↘
[CODER]    [VERIFIER]
```
- **Why**: Peer-to-peer topologies risk infinite debate and deadlocks. A Supervisor enforces deterministic task completion, budget caps, and workspace locking.

## 6. Agent Identity Model
Agents are logical role configurations, not distinct microservices.
- **Agent**: System definition (e.g., "Frontend Developer").
- **AgentRole**: Classification enum (`CODER`, `RESEARCHER`).
- **AgentRun**: The active execution of an Agent fulfilling a specific `AgentTask`.
- **AgentTask**: A bounded objective handed off from Supervisor to Worker.

## 7. Agent Role Model
Controlled Vocabulary:
- `SUPERVISOR`: Orchestrates, handles user interaction, merges artifacts.
- `RESEARCHER`: Information gathering, RAG, web search.
- `CODER`: Filesystem mutation, command execution.
- `VERIFIER`: Testing, visual inspection, read-only validation.

## 8. Capability Model & Security
**Deny-by-default Security Boundary**:
An `AgentRole` maps to a `CapabilityPolicy`, which filters the `ToolRegistry`.
- `CODER`: `['read_file', 'write_file', 'run_command', 'apply_diff']`
- `VERIFIER`: `['read_file', 'browser_preview', 'run_test_command']` (No arbitrary `write_file`).
Privilege escalation is impossible because the `ExecutionController` evaluates the `CapabilityPolicy` at the exact moment of tool dispatch.

## 9. Shared vs Scoped Context
- **Shared**: Canonical `Project` identity, `Workspace` structure.
- **Scoped**: RAG and Memory. The `ContextAssembler` is invoked independently for each agent run using that specific agent's localized sub-intent, ensuring the Coder isn't polluted by the Researcher's dead-end web searches.

## 10. Agent Communication & Handoff Contract
Agents do NOT chat. They exchange strongly-typed JSON payloads referencing canonical IDs.
```json
{
  "task_id": "task_456",
  "source_agent": "supervisor_1",
  "target_agent": "coder_1",
  "objective": "Implement JWT middleware",
  "artifact_refs": ["art_789"],
  "context_refs": ["node_123"]
}
```

## 11. Parallel Execution & Workspace Concurrency
Parallel execution introduces workspace mutation races (merge conflicts).
- **Phase 2G Strategy**: **Serialized Mutation via Supervisor Lock**. Multiple read-only agents (Researchers) can run concurrently. Only one mutating agent (Coder) may hold the workspace lock at any time.

## 12. Failure Model & Budgeting
- **TOOL_FAILED**: Worker attempts local self-repair.
- **AGENT_FAILED**: Escalated to Supervisor for reassignment or alternative strategy.
- **BUDGET_EXCEEDED**: Tokens are tracked hierarchically. If the global budget hits 90%, the Supervisor forcibly terminates workers and initiates human-in-the-loop handoff.

## 13. Observability & Checkpoint/Resume
- `parent_run_id` links worker runs to the supervisor run in the `AgentRun` table.
- Checkpoints remain atomic per-run. If the server crashes, the Supervisor's checkpoint recovers its state, and it automatically triggers recovery for incomplete dependent worker runs.

## 14. Artifact Sharing & Memory
- `ArtifactDAO` acts as the shared message bus. Workers produce artifacts; Supervisors consume them.
- Memory remains scoped to the project.

## 15. Disagreement / Arbitration
No multi-agent voting. The `VERIFIER` produces an objective Boolean (PASS/FAIL) with an error log artifact. The `CODER` must satisfy the verifier or the `SUPERVISOR` exhausts the repair loop and flags the user.

## 16. Service & API Boundaries
New foundational services required:
- `AgentRegistry` (Defines roles/capabilities).
- `AgentCoordinator` (Handles structured handoffs and locks).

## 17. Database Evolution
Minimal non-breaking extensions required to Phase 2A schemas:
- `agent_tasks` and `agent_runs` gain `parent_task_id`, `assigned_role`.
- New table `agent_handoffs` (audit log of inter-agent messages).

## 18. Phase 2G Implementation Sequence
1. **2G.1**: Agent Identity, Roles & Capability Policy definitions.
2. **2G.2**: Structured Handoff Contract & Artifact Bus.
3. **2G.3**: Supervisor / Worker Coordinator (Sequential).
4. **2G.4**: Multi-Agent Verification (Separation of duties).

## 19. 5–10 Year Scalability
Because agents communicate via structured canonical handoffs (not shared process memory), this architecture natively scales out. Future iterations can place workers on distinct cloud infrastructure, communicating via an Event Bus (e.g., Kafka/Redis), seamlessly integrating with the Universal DB.

## 20. Recommended Phase 2G.1 Scope
Implement the **Identity & Capability Policy** boundary within `ExecutionController`. Ensure `ContextAssembler` can tailor context for specific roles without launching actual multi-agent orchestration yet.
