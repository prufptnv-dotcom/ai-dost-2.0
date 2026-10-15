# Forge Studio — Autonomous Execution Plan & Lifecycle Specification

## 1. Execution Lifecycle

Every user request follows an automated, self-healing 6-phase lifecycle:

```
[Phase 1: Ingestion & Auth]
   │ Validates user identity and project permissions.
   ▼
[Phase 2: Adaptive Planning]
   │ Director analyzes scope and builds a code-first specialist DAG.
   ▼
[Phase 3: Specialist Execution]
   │ Dispatches workers (CODER / RESEARCHER) with bounded workspace context.
   ▼
[Phase 4: Surgical Diffs & Verification]
   │ Applies exact diff patches; validates syntax integrity before writing.
   ▼
[Phase 5: Automated QA Gate]
   │ VERIFIER inspects output; triggers self-healing repairs on syntax/runtime errors.
   ▼
[Phase 6: Live Sync & Preview]
   │ Emits director_complete event; mounts live preview in UI.
```

---

## 2. Phase Details

### Phase 1: Ingestion & Policy Probe
- Request received on `/api/agent/run` with `copilotDirector: true`.
- Resolves `projectId` and creates a unique `taskId` and `runId`.
- Evaluates permission levels (`ask`, `auto`, `turbo`) against `CapabilityGatekeeper`.
- If gated in `ask` mode, mints a cryptographic single-use token and halts until user clicks **Approve**.

### Phase 2: Adaptive Planning
- Calls `CopilotDirector.createPlan(request)`.
- Enforces **CODE-FIRST RULE**: User prompts asking for websites, apps, or components generate immediate coding tasks targeting executable files (`src/App.jsx`, `index.html`), bypassing documentation-only traps.
- Returns normalized task graph with dependencies and roles (`CODER`, `RESEARCHER`, `VERIFIER`).

### Phase 3: Specialist Execution & Self-Healing Loop
- For each task in the plan:
  - Collects verbatim file content from workspace (`readKeyFileContents`).
  - Dispatches to `TaskPlanner.generatePlan()`.
  - Runs steps in `PlannerExecutionLoop`.
  - If a step fails (e.g. invalid syntax or rejected diff), invokes `TaskPlanner.generateRepairPlan()` with error diagnostic logs (up to 3 self-healing attempts).

### Phase 4: Surgical Diff Engine
- Existing files are never wiped or overwritten with blind full-file dumps.
- Edits are performed via `apply_diff` using verbatim `SEARCH` and `REPLACE` blocks.
- If a search block fails to match, feedback includes current file lines so the repair iteration can extract exact target characters.

### Phase 5: Verification Gate
- When all execution tasks complete, `CopilotDirector` automatically delegates a read-only `VERIFIER` task.
- Ensures no broken closing tags, unescaped strings, or missing imports exist in generated code.

### Phase 6: Sync & Preview
- Real-time SSE stream emits `director_complete`.
- `ForgeCopilot.jsx` updates local contents and triggers `generateLiveAppHtml` to re-mount the preview iframe with zero page reload.
