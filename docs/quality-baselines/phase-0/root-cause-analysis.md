# Root-Cause Analysis: Why Forge Studio Generates Basic/Generic Applications (Phase 0)

**Baseline Commit:** `origin/main` @ `76efa666d809c381d61579de5fa7c9d31f6a5a53`
**Investigation Branch:** `audit/phase-0-execution-path-baseline-2026-10`
**Date:** 2026-10-15

---

## 1. Executive Summary

When users ask Forge Studio to generate complete, multi-section, interactive software (e.g. SaaS dashboards with CSV export, e-commerce stores with carts, or quiz apps with scoring), Forge Studio frequently generates basic, generic, or demo-like applications (e.g. starter templates with a single `App.jsx` holding 3 static cards or a counter).

Through direct runtime tracing and code inspection of `origin/main`, we identified the **primary architectural root cause** and two compounding **false-success verification defects**:

1. **Root Cause 1 (Architectural): Absence of Structured Requirement Traceability & AppSpecification.**
   On `origin/main`, neither `CopilotDirector` nor `structuredAgentPlanner` extracts structured requirements, entity models, page archetypes, or acceptance checks from user prompts. Prompts are treated as a single monolithic block of natural language. The planner generates 1 to 3 coarse tasks (e.g. `frontend: Implement complete working code and UI components for: [prompt]`). The specialist worker generates a minimal starter file (`src/App.jsx`), and subsequent tasks either hit `WRITE_FORBIDDEN_ON_EXISTING` or perform trivial edits, leaving explicit user requirements completely unimplemented.
2. **Root Cause 2 (False-Success Gate): Final Verification Degrades to File Existence (`list_directory`).**
   In `CopilotDirector.js:479-559`, the final verification step delegates to a `VERIFIER` role that invokes `taskPlanner.generateVerificationPlan()`. When LLM generation is unavailable or when non-read-only tools are sanitized out, the planner defaults to `steps: [{ tool: 'list_directory', path: '.' }]`. Running `list_directory` succeeds whenever the workspace folder exists. The director marks `verificationStatus = 'SUCCEEDED'` and reports `status: 'SUCCEEDED'` (`verification_status: 'PASSED'`), even though **no build runner, test runner, or browser check ever ran**.
3. **Root Cause 3 (Legacy Fallback Distortion): Pre-Baked Golden Scaffolds with Fabricated Claim Lists.**
   In the legacy ReAct scaffold path (`backend/routes/agent.js:784`), when cloud providers flake or timeout (12s per provider), execution falls back to `fullstackTrainer.js:generateGoldenScaffold`. This writes fixed generic blueprints (e.g. a 3-item static array in `src/App.jsx`). Worse, lines 1116-1134 inject hardcoded markdown bullet points (e.g., claiming "Full Memory Registers (MC, MR, M+, M-)" for calculators or "Interactive SVG Asset Donut Chart" for crypto) regardless of whether those features exist in the code.

---

## 2. Minimal Reproducible Failure Case

### Scenario
**Input Prompt:**
`"Build a multi-section SaaS analytics dashboard with interactive charts, date range filtering, export to CSV, user roles table, and PostgreSQL persistence"`

### Step-by-Step Code Execution Trace on `origin/main`

1. **Frontend Dispatch:**
   `ForgeCopilot.jsx:2930` dispatches `POST /api/agent/run` with `copilotDirector: true`.
2. **Director Plan Creation (`CopilotDirector.js:253`):**
   Sends raw prompt to `AgentCascadeAiService.chat()`. If the response flaked or was malformed JSON, `fallbackPlan(request)` generates:
   - `task-1 (frontend)`: "Implement complete working code and UI components for..."
   - `task-2 (integration)`: "Integrate and wire complete functionality for..."
   - `task-3 (testing)`: "Test the completed implementation for..."
3. **Task 1 Execution (`structuredAgentPlanner.js:207`):**
   The worker prompt receives the task objective with no requirement IDs. The model generates 1-2 steps, writing `src/App.jsx` with a generic starter dashboard.
4. **Task 2 Execution:**
   Specialist attempts to "integrate functionality", but `src/App.jsx` already exists. `write_file` is rejected with `WRITE_FORBIDDEN_ON_EXISTING`. It attempts `apply_diff` or skips.
5. **Task 3 Execution:**
   Specialist attempts testing, but without automated runner tools wired into the plan, it inspects files or concludes.
6. **Final Verification Gate (`CopilotDirector.js:479`):**
   `taskPlanner.generateVerificationPlan()` is invoked.
   When executed against the model or fallback, `structuredAgentPlanner.js:348` and `taskPlanner.js:61` fall back to:
   ```json
   {
     "goal": "Build a multi-section SaaS analytics dashboard...",
     "steps": [
       {
         "id": "step-verify-files",
         "tool": "list_directory",
         "description": "Inspect workspace files",
         "input": { "path": "." }
       }
     ]
   }
   ```
   `list_directory` executes via `PlannerExecutionLoop.js` and outputs `{ success: true, files: [...] }`.
7. **Terminal Event Emission (`CopilotDirector.js:540` & `copilotDirectorHandler.js:263`):**
   Emits `director_complete`:
   ```json
   {
     "type": "director_complete",
     "status": "SUCCEEDED",
     "verification": {
       "status": "SUCCEEDED",
       "summary": "Final verification passed."
     }
   }
   ```
   UI Message to user:
   `"ðŸŽ‰ Copilot Director completed 3 task(s) with verification â€” 1 file(s) changed: src/App.jsx"`

### Omissions in Output vs Request
| Explicit Requirement | Present in Generated Code? | Why Was It Omitted? |
| :--- | :--- | :--- |
| **Interactive telemetry charts** | **Omitted / Generic SVG dummy** | Planner had no requirement ID for charts; worker wrote static card markup |
| **Date range filtering** | **Omitted** | Omitted in worker step; no acceptance check tested for date picker |
| **Export to CSV button & logic** | **Omitted** | Worker did not generate `exportCsv()` or Blob download logic |
| **PostgreSQL persistence** | **Omitted** | No database migration, Docker compose, or pg client was generated |
| **Build verification** | **NOT EXECUTED** | Director verification ran `list_directory`, not `vite build` |
| **Test verification** | **NOT EXECUTED** | No test command was executed; 0 assertions run |

---

## 3. Competing Hypotheses Ruled In / Out

| Hypothesis | Status | Evidence & Rationale |
| :--- | :--- | :--- |
| **Hypothesis A: Prompt wording is simply too weak.** | **RULED OUT** | Even with exhaustive prompt wording specifying CSV, charts, and date filters, the system still omits them because the planner treats the prompt as an unparsed blob and verification only runs `list_directory`. |
| **Hypothesis B: Model context window is exceeded.** | **RULED OUT** | Initial prompts are under 500 tokens. The context assembler truncates safely at 30,000 characters. The issue is lack of requirement deconstruction, not context overflow. |
| **Hypothesis C: Verification only establishes file existence.** | **RULED IN (CONFIRMED)** | Direct inspection of `taskPlanner.js:61` and `structuredAgentPlanner.js:348` proves that fallback verification plan explicitly generates `list_directory`. `CopilotDirector.js:540` reports `SUCCEEDED` when `list_directory` succeeds. |
| **Hypothesis D: Fallback templates return hardcoded demo data.** | **RULED IN (CONFIRMED)** | Direct inspection of `fullstackTrainer.js:4131` proves that fallback blueprints return static 3-item arrays (`System Analytics Module`, `User Access Control`, `Database Replication Pipeline`), while lines 1116-1134 emit fabricated feature claims. |
| **Hypothesis E: Preferred model selection is broken on main.** | **RULED IN (CONFIRMED)** | `copilotDirectorHandler.js` on `origin/main` completely ignores `body.preferredModel` sent by `ForgeCopilot.jsx:2942`, defaulting always to the auto cascade. (Addressed in PR #18, pending merge). |
