# AI Dost / Forge Studio — Quality Upgrade Roadmap

**Version:** 1.0  
**Created:** 2026-10-14  
**Purpose:** Single source of truth for improving generated-output quality, planning/reasoning, multi-agent execution, and verification without drifting into unrelated work.

## 1. Mission

Move AI Dost / Forge Studio from producing mostly basic/demo-like outputs to producing requirement-complete, well-designed, functional, and verifiably tested applications. Improve implementation and algorithms—not just prompts, test counts, or benchmark presentation.

**Operating rule:** Work phases in the order below. Every implementation PR must point to a phase and checklist item. When progress changes, update this file with evidence, PR/commit reference, and remaining blockers.

## 2. Ground rules — do not drift

1. **Trace the real path first.** Do not change a route, template, agent, or orchestrator until we know whether Forge Studio actually uses it for the user flow under investigation.
2. **Code and algorithms before more test-only churn.** Tests must verify product behavior, not merely increase test counts or make CI green.
3. **Green CI is necessary, not sufficient.** Repository tests passing does not prove generated applications are useful, visually strong, or functionally complete.
4. **No simulated success.** A no-op, mocked, simulated, or file-existence-only run must never be reported as verified application success.
5. **Evidence-based status.** Use SUCCEEDED only when relevant acceptance checks have evidence; otherwise use UNVERIFIED or FAILED with the reason.
6. **Safe multi-agent changes.** Do not parallelize agents that can overwrite the same files until isolation, ownership, conflict detection, and integration are defined.
7. **No unsupported claims.** Do not claim model identity, production readiness, benchmark wins, or quality scores unless configuration or recorded results support them.
8. **Keep PRs scoped.** One coherent phase or tightly related set of items per PR. Do not mix unrelated refactors into the current task.
9. **Baseline before targets.** Record current behavior before asserting improvement. Metrics below are goals, not current achievements.
10. **This document governs sequencing.** Log new issues under the right phase or as a documented blocker; do not silently switch projects.

## 3. Known starting hypotheses to re-check

These were previously observed risks; re-read the current branch before editing:

- A React/Vite starter template may lead to a basic counter app instead of request-specific implementation.
- Planner/agent prompts may request high quality without deterministic requirement-coverage or acceptance gates.
- A dependency DAG may exist while ready tasks still execute sequentially; specialist roles may be collapsed into broad coder/verifier roles.
- Verification may fall back to checking that files exist, which is weaker than running the project and testing user flows.
- A worker path may mark simulated/no-runner execution as successful.
- Model prompts and configured model names may disagree; actual runtime configuration must be the source of truth.
- Multiple generation/orchestration paths may overlap. Identify the canonical path before shared changes.
- CI and smoke tests may prove repository compatibility without proving generated-app quality.

These are hypotheses to re-confirm on the current default/active branch, not claims that every risk still exists.

## 4. Phase sequence and exit criteria

### Phase 0 — Establish the real execution path and baseline
**Status: IN PROGRESS**

- [x] Trace the primary Forge Studio Copilot UI action through the frontend request, route bridge, `copilotDirectorHandler`, `CopilotDirector`, task planner/execution loop, workspace tools, and final SSE response.
- [x] Identify overlapping paths: legacy `generate_project_from_prompt` (full-stack prompt + golden-scaffold fallback), plus the planner service's framework-template route. A complete per-request-type canonical-path map remains open.
- [ ] Document the canonical path for each supported request type, including legacy paths and compatibility constraints.
- [ ] Create a repeatable request set: landing page, SaaS dashboard, e-commerce flow, educational app, API-backed CRUD app, and multi-step repair task.
- [ ] Save baseline prompts/specifications, generated files, logs, build/test results, user-flow evidence, and elapsed time/cost where available.
- [ ] Identify one highest-impact basic-output failure and reproduce it.

**Exit gate:** We can identify the exact code path responsible for the poor output and reproduce the baseline.

### Phase 1 — Structured specification and high-quality output engine
**Status: IN PROGRESS**

- [x] Define a validated AppSpecification contract with requirement IDs, target audience guidance, stack, page/archetype guidance, component boundaries, data entities, interactions/state transitions, responsive/accessibility guidance, security/non-functional constraints, and linked acceptance criteria.
- [x] Inject the spec before generation/planning in the primary Copilot Director flow and legacy full-project prompt; general tool paths still need end-to-end confirmation.
- [x] Add non-binding archetype guidance (SaaS dashboard, commerce, education, booking, portfolio/marketing, content, collaboration) without making it a hard-coded page template.
- [ ] Build reusable design-system foundations: spacing/typography/color tokens, hierarchy, responsive layouts, consistent components, loading/error/empty/success states, and accessible controls.
- [ ] Generate request-specific pages and real interactions from the specification. Templates can seed the design system but must not be treated as the finished answer for a non-trivial request.
- [ ] Preserve requirement IDs through implementation and verification so omissions are detectable.
- [ ] Compare the before/after output using the Phase 0 request set.

**Exit gate:** Representative outputs map to requested features, have coherent UI/design, and implement explicitly requested core interactions instead of returning a generic demo scaffold.

### Phase 2 — Planning, reasoning, and requirements coverage
**Status: NOT STARTED**

- [ ] Add a structured plan with deliverables, dependencies, affected files/modules, risks, requirement IDs, and acceptance checks per task.
- [ ] Deterministically validate that every explicit requirement maps to at least one task and one verifiable acceptance check.
- [ ] Add a bounded plan critique that finds omissions, architecture mismatches, vague tasks, conflicts, and untestable claims; revise before execution.
- [ ] Build and validate a dependency graph; distinguish independent tasks from tasks that depend on earlier outputs.
- [ ] Feed actual tool/build/test/runtime errors into targeted repair or replanning instead of blindly retrying the whole task.
- [ ] Track changed files/diffs and check that the patch addresses the requirement without unnecessary rewrites.
- [ ] Make fallback planning explicit and lower confidence/status when it cannot satisfy the request.

**Exit gate:** Requirement coverage and dependencies are validated, and execution decisions are based on structured state and evidence rather than optimistic prompt wording.

### Phase 3 — Real specialist multi-agent execution
**Status: NOT STARTED**

- [ ] Define distinct contracts where useful: architect/planner, researcher, frontend, backend, integration, QA, security, and arbiter/reviewer.
- [ ] Give every worker bounded tasks, requirement IDs, inputs, output contract, allowed file ownership/change set, and acceptance checks.
- [ ] Implement bounded parallel execution only for independent dependency-graph nodes.
- [ ] Prevent write races using isolated workspaces/patches or equivalent ownership and conflict detection; integrate through an explicit integration stage.
- [ ] Propagate dependency failures correctly and cancel/replan dependent tasks when necessary.
- [ ] Have an arbiter resolve conflicting outputs and check UI/API/data-model/test consistency.
- [ ] Measure whether multiple agents improve quality, time, and cost against the single-agent baseline.

**Exit gate:** Parallel work is real, bounded, conflict-safe, and measurably useful. Multiple names or roles alone do not count as multi-agent completion.

### Phase 4 — Evidence-based verification and self-healing
**Status: NOT STARTED**

- [ ] Remove file-existence-only checks as the sole success condition.
- [ ] Run applicable formatting/lint/type checks, build, unit/integration tests, and application startup in an isolated runtime/sandbox.
- [ ] Exercise acceptance-critical user flows in a browser or equivalent runtime; check routing, interactions, API integration, console/runtime errors, and responsive behavior where applicable.
- [ ] Check API contracts, schema consistency, authn/authz, input validation, secret handling, and relevant security risks.
- [ ] Store evidence for each gate (command/result, test report, screenshots or flow logs where applicable).
- [ ] Classify failures: planning, generation, dependency/install, compile, runtime, integration, UX, security, or environment.
- [ ] Attempt bounded targeted repairs and re-run failed gates. A failure cannot become success without new passing evidence.
- [ ] Prevent mocked, simulated, or missing-runner success from masquerading as production verification.
- [ ] Standardize final statuses: SUCCEEDED, FAILED, UNVERIFIED, and PARTIAL, each with evidence and unresolved issues.

**Exit gate:** An application is called successful only after its applicable acceptance gates pass; otherwise the report truthfully states what is failed or unverified.

### Phase 5 — Model/provider routing and capability honesty
**Status: NOT STARTED**

- [ ] Read the configured provider/model from runtime configuration and use it as source of truth in logs and user-facing descriptions.
- [ ] Design task-aware routing for planning, coding, research, visual review, and verification using measured quality, context needs, latency, and cost.
- [ ] Define visible fallback behavior when a provider/model/tool fails; record fallback and any capability reduction.
- [ ] Add safe timeouts, bounded retries, structured errors, and model-call observability.
- [ ] Test routing on fixed representative tasks; never select a model based only on its name or an unsupported quality claim.

**Exit gate:** The selected model is the model actually called, fallback use is visible, and routing decisions are supported by comparative measurements.

### Phase 6 — Competition-grade evaluation and evidence
**Status: NOT STARTED**

- [ ] Evaluate chat assistance separately from coding/app generation.
- [ ] Create a fixed public development set and a separate hidden/holdout set to reduce overfitting.
- [ ] Score requirement coverage, build success, core-flow completion, defect severity, security regressions, UI/UX quality, and task completion; also track latency and cost.
- [ ] Combine automated checks with blind human UX review and a documented scoring rubric.
- [ ] Compare against the Phase 0 baseline with repeatable runs; retain generated artifacts and raw results.
- [ ] Report failures, sample sizes, confidence, and limitations as well as wins; do not cherry-pick successful examples.
- [ ] Finish/review separate benchmark-integrity work (including PR #14 if it remains the active vehicle) independently. Benchmark-report cleanup alone does not prove generated-app quality.

**Exit gate:** Reproducible holdout-backed evidence shows real quality improvement, with raw artifacts and limitations available for review.

## 5. Target metrics — goals, not current results

Set final thresholds after the Phase 0 baseline. Initial working goals:

- **Requirement traceability:** at least 95% of explicit requirements map to acceptance checks; critical requirements must have 100% coverage.
- **Build/core flows:** at least 85% of representative generated projects pass predefined build and critical-flow gates in the first measured iteration, then improve based on baseline evidence.
- **Blind UX review:** average at least 4/5 on a rubric covering layout, hierarchy, responsiveness, accessibility, and interaction completeness.
- **Critical security regressions:** zero in the evaluation set.
- **Status honesty:** zero simulated/no-runner runs reported as verified success.
- **Reproducibility:** each benchmark result links to versioned prompts, configuration, generated artifacts, and test evidence.

These are targets only. Record actual values and sample sizes; do not present them as achieved before measurement.

## 6. Implementation order and scope control

1. Phase 0 — trace the path and baseline.
2. Phase 1 — structured specification and output quality.
3. Phase 2 — planning and coverage validation.
4. Phase 4 safety prerequisite — patch any confirmed false-success path early; complete the broader verification suite in Phase 4.
5. Phase 3 — safe multi-agent execution.
6. Phase 5 — model routing and identity honesty.
7. Phase 6 — baseline/holdout evaluation.

**Dependency note:** Basic verification honesty (no simulated success; UNVERIFIED when evidence is absent) is a prerequisite. Patch it immediately if Phase 0 confirms the risk rather than waiting for the whole roadmap to finish.

## 7. Definition of done for every PR

- [ ] Names the phase and checklist item(s) it addresses.
- [ ] Fixes a reproducible product issue or adds a necessary capability—not only cosmetic status/test changes.
- [ ] Includes targeted tests or explains why a test is inappropriate.
- [ ] Includes real output/runtime/benchmark evidence when generation behavior or quality changes.
- [ ] Does not hide fallbacks, warnings, failures, or incomplete verification.
- [ ] Updates this roadmap if checklist status or a phase gate changes.
- [ ] Leaves unrelated phases untouched unless the dependency is documented.

## 8. Progress log

| Date | Phase/item | Change or evidence | PR/commit | Status |
|---|---|---|---|---|
| 2026-10-14 | Roadmap | Phases, order, constraints, and exit gates documented. | PR #15 | DOCUMENTED |
| 2026-10-14 | Phase 0 / Phase 1 | Primary Copilot path traced; structured AppSpecification wired into Director and legacy full-project flows; full-stack prompt no longer forces dark theme or one icon library; fabricated feature-claim list replaced with requirement/evidence report. Generated output quality is not yet benchmarked; baseline corpus and full request-path map remain open. | [PR #16](https://github.com/prufptnv-dotcom/ai-dost-2.0/pull/16), current head CI PASS (backend/frontend/E2E/Docker/sandbox); generated app quality evaluation pending | IN PROGRESS |

## 9. Next concrete action

Continue **Phase 1** after current-head CI passes: run representative generation requests, preserve the generated files and build/runtime evidence, and compare output against the new AppSpecification. Complete the remaining Phase 0 baseline corpus in parallel before claiming measurable quality improvement.
