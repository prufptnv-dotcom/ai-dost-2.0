# AI-Dost — Autonomous Execution Contract

**Document Type:** Execution Architecture Contract  
**Status:** FROZEN — Contracts only  
**Date:** 2026-09-01

---

## 1. Execution Pipeline

Every autonomous operation in AI-Dost follows this exact pipeline:

```
USER INTENT
    │
    ▼
┌───────────────────┐
│  CONTEXT ASSEMBLY  │  ContextAssembler.assemble()
│                   │  • projectAuthorization.authorize()
│                   │  • projectDao.getById()
│                   │  • workspaceManager.getWorkspaceMetadata()
│                   │  • retrievalService.search() [optional, graceful degradation]
│                   │  • contextBudgetManager.packageContext()
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   TASK PLANNING    │  TaskPlanner.generatePlan()
│                   │  • LLM generates structured plan
│                   │  • validateAndSanitizePlan()
│                   │  • Tool existence check against ToolRegistry
│                   │  • Input schema validation per tool
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│    EXECUTION       │  ExecutionController
│                   │  • startRun() — PENDING → RUNNING
│                   │  • recordStep() — creates step record
│                   │  • executeTool() — capability check → tool.execute()
│                   │  • recordObservation() — captures output
│                   │  • saveCheckpoint() — enables resume
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   VERIFICATION     │  MultiAgentVerifier.verify()
│                   │  • Independent VERIFIER agent (read-only)
│                   │  • Evidence freshness check (hash comparison)
│                   │  • Cross-project artifact rejection
│                   │  • VerificationContract: PASS / FAIL / BLOCKED
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   ARBITRATION      │  SupervisorArbitrator.evaluate()
│                   │  • COMPLETE — verification passed
│                   │  • REPAIR — attempt fix (max 3 cycles)
│                   │  • WAITING_FOR_USER — max repairs exceeded
│                   │  • FAILED — unrecoverable
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│    DELIVERY        │  ResultValidator.validate()
│                   │  • Canonical result envelope in handoff.result_json
│                   │  • Bounded schema: status, summary, artifacts, errors
└───────────────────┘
```

---

## 2. State Machine

### Run States

```
PENDING ──► RUNNING ──► VERIFYING ──► SUCCEEDED
   │           │            │
   │           │            ├──► RUNNING (repair cycle)
   │           │            │
   ├──► CANCELLED   ├──► FAILED   └──► FAILED
   │           │
   └──► FAILED └──► CANCELLED
```

### Terminal States

- `SUCCEEDED` — no further transitions
- `FAILED` — no further transitions
- `CANCELLED` — no further transitions

### Valid Transitions (from ExecutionController)

```javascript
VALID_TRANSITIONS = {
  'PENDING':    ['RUNNING', 'CANCELLED', 'FAILED'],
  'RUNNING':    ['WAITING', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
  'WAITING':    ['RUNNING', 'CANCELLED', 'FAILED'],
  'VERIFYING':  ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
  'SUCCEEDED':  [],
  'FAILED':     [],
  'CANCELLED':  []
};
```

---

## 3. Role-Based Capability Matrix

| Role | Capabilities | May NOT |
|------|-------------|---------|
| **SUPERVISOR** | `orchestration.manage` | Read/write files, execute terminal, run tests |
| **RESEARCHER** | `filesystem.read`, `codebase.search`, `web.search`, `context.retrieve` | Write files, execute terminal |
| **CODER** | `filesystem.read`, `filesystem.write`, `code.edit`, `terminal.execute`, `codebase.search`, `context.retrieve` | Manage orchestration |
| **VERIFIER** | `filesystem.read`, `terminal.execute`, `test.run`, `verification.inspect`, `codebase.search` | Write files, manage orchestration |

### Enforcement Points

1. `CapabilityPolicy.assertAllowed(role, capability)` — throws if denied
2. `Supervisor.delegate()` checks `CapabilityPolicy.validateWorkerRole(role)`
3. `AgentCoordinator.delegate()` validates `runtime_metadata.role === 'SUPERVISOR'`

---

## 4. Delegation Rules

| Rule | Limit | Enforcement |
|------|-------|-------------|
| Max delegation depth | 3 | `AgentCoordinator.delegate()` checks `workerDepth > MAX_DELEGATION_DEPTH` |
| Max workers per supervisor | 5 | `AgentCoordinator.delegate()` counts existing task runs |
| Max active workers per project | 10 | `AgentCoordinator.delegate()` queries `agentRunDao.countActiveByProject()` |
| Allowed worker roles | RESEARCHER, CODER, VERIFIER | `CapabilityPolicy.ALLOWED_WORKER_ROLES` |

---

## 5. Checkpoint / Resume Contract

### Checkpoint Data

```javascript
{
  stepQueue: [...],      // Remaining plan steps
  repairAttempts: N,     // Current repair attempt count
  goal: "..."            // Original plan goal
}
```

### Save Points

- Before execution queue starts
- After each step completes (success or failure)
- After repair plan is generated

### Resume Behavior

1. `PlannerExecutionLoop.resume(runId)` loads checkpoint
2. `recoverStaleSteps(runId)` marks any RUNNING steps as FAILED (crash recovery)
3. Execution continues from saved `stepQueue`

### Task Survival

A task survives:

| Event | Survival | Mechanism |
|-------|----------|-----------|
| Browser close | ✅ | Backend continues; DB persists state |
| Frontend restart | ✅ | Backend continues; frontend reconnects via Socket.IO |
| Backend restart | ✅ | `resume()` restores from checkpoint |
| Worker interruption | ✅ | `recoverStaleSteps()` + checkpoint resume |

---

## 6. Repair Cycle Contract

```
Step fails
  │
  ├── repairAttempts < MAX_REPAIR_CYCLES (3)?
  │     ├── YES → TaskPlanner.generateRepairPlan() → prepend to stepQueue → continue
  │     └── NO  → completeRun(FAILED, 'max repairs reached')
  │
  └── Verification fails
        ├── repairAttempts < MAX_REPAIR_CYCLES (3)?
        │     ├── YES → TaskPlanner.generateRepairPlan() → append to stepQueue → re-execute
        │     └── NO  → completeRun(FAILED, 'verification failed, max repairs')
        │
        └── SupervisorArbitrator decision:
              ├── COMPLETE → run SUCCEEDED
              ├── REPAIR → repair cycle
              ├── WAITING_FOR_USER → escalate to human
              └── FAILED → run FAILED
```

---

## 7. Handoff Contract

### Lifecycle

```
PENDING → ACCEPTED → IN_PROGRESS → COMPLETED
                         │
                         ├── FAILED
                         └── CANCELLED
```

### Idempotency

If `AgentHandoffService.createHandoff()` finds an existing active handoff with the same objective and source/target, it returns the existing record instead of creating a duplicate.

### Result Envelope

```javascript
{
  status: 'COMPLETED' | 'FAILED',
  summary: "...",
  artifact_refs: [...],
  context_refs: [...],
  verification_status: 'PASSED' | 'FAILED' | 'SKIPPED',
  errors: [{ code: '...', message: '...' }]
}
```

Validated by `ResultValidator.validate()` — rejects invalid schemas.

---

## 8. Workspace Isolation Contract

| Rule | Enforcement |
|------|-------------|
| Path resolution | `WorkspaceManager.getWorkspacePath(projectId)` → deterministic, bounded path |
| Path traversal defense | Canonical path comparison; rejects `..`, symlink escape, UNC paths |
| Mutation serialization | `LockManager.acquire(wsPath)` — only CODER role acquires workspace lock |
| Cross-project isolation | All DAOs filter by `project_id`; ContextAssembler rejects cross-project retrieval |
| File operations | All go through registered Tools (ReadFileTool, WriteFileTool, ListFilesTool) |

---

## 9. Audit Results

| Component | Exists | Tested | Verdict |
|-----------|--------|--------|---------|
| ContextAssembler | ✅ | ✅ Phase 2F | PASS |
| TaskPlanner | ✅ | ✅ Phase 2C | PASS |
| PlannerExecutionLoop | ✅ | ✅ Phase 2C/2E | PASS |
| ExecutionController | ✅ | ✅ Phase 2A/2E | PASS |
| AgentCoordinator | ✅ | ✅ Phase 2G.3 | PASS |
| Supervisor | ✅ | ✅ Phase 2G.3 | PASS |
| CapabilityPolicy | ✅ | ✅ Phase 2G.1 | PASS |
| MultiAgentVerifier | ✅ | ✅ Phase 2G.4 | PASS |
| SupervisorArbitrator | ✅ | ✅ Phase 2G.4 | PASS |
| VerificationContract | ✅ | ✅ Phase 2G.4 | PASS |
| ResultValidator | ✅ | ✅ Phase 2G.3 | PASS |
| LockManager | ✅ | ✅ Phase 2G.3 | PASS |
| Checkpoint/Resume | ✅ | ✅ Phase 2E | PASS |
| Handoff Idempotency | ✅ | ✅ Phase 2G.3 | PASS |
| Workspace Isolation | ✅ | ✅ Phase 4 | PASS |
