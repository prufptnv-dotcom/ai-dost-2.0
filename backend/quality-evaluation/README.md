# Phase 1: Generated-Application Quality Evaluation

This evaluation is the Phase 1 exit gate for the AppSpecification/generation-prompt changes. It deliberately separates **static diagnostics** from **verified application quality**.

## Fixed test cases

The canonical prompts and required behaviors live in `phase-1-cases.json`:

- `dashboard-search-charts-csv`
- `education-quiz-progress`
- `booking-timezone-cancellation`
- `ecommerce-cart-checkout`

Run every case against both the pre-change baseline and the candidate branch. Keep prompt text identical. Use the same provider/model, model parameters, tool permissions, timeout, seed where supported, and clean workspace state. Record any setting that cannot be held constant. Run each prompt at least three times to expose generation variance; do not compare only the best candidate.

## Capture protocol

For each run, preserve:

1. The exact prompt and generation settings (including actual provider/model identity).
2. The complete generated project directory and the generator's completion/verification report.
3. Dependency install, lint/type-check, build, unit/integration test, and browser-flow logs where applicable.
4. Browser screenshots at 360px, 768px, and 1280px, plus console/network errors.
5. A checklist with one evidence item per required behavior. Use `NOT_EVALUATED` when no evidence exists; never infer a pass from a file name, prompt, or static pattern.

Keep artifacts outside the application source tree, and label them by `baseline-or-candidate / case-id / run-number`. Do not put credentials, real customer data, or secrets in captured artifacts.

## Static diagnostic

From `backend/`, run:

```bash
node scripts/score-generated-app.js --case dashboard-search-charts-csv --project-dir /path/to/generated/project --out /path/to/report.json
```

Repeat with each case ID and project directory. The report identifies source-file inventory, placeholder markers, and regex-based implementation signals. It is **not** a correctness score: matches can occur in comments/dead code, and missing matches can be false negatives. The runner intentionally does not declare a build, UI, or behavior pass.

## Human review rubric (score each dimension 0–5)

- **Requirement completeness:** every explicit requirement has implementation evidence; blockers are disclosed.
- **Functional correctness:** key user flows work end-to-end, including invalid, empty, and error states.
- **Visual quality:** hierarchy, spacing, typography, color/contrast, information density, and domain fit.
- **Responsive behavior:** core flows work at all three target widths without unintended overflow or clipped controls.
- **Accessibility:** semantic structure, names/labels, keyboard operation, visible focus, contrast, and meaningful alternative text.
- **Maintainability:** coherent module boundaries, understandable state/data flow, no dead controls, avoidable duplication, or unexplained placeholders.
- **Execution integrity:** claims about persistence, APIs, auth, payments, bookings, and tests match the evidence.

A score of 0 means absent/broken; 1 means severely incomplete; 2 means major gaps; 3 means usable with material gaps; 4 means strong with minor gaps; 5 means complete and convincingly verified. Reviewers should cite artifacts for every score. For visual review, hide whether an artifact is baseline or candidate until scores are recorded.

## Comparison and Phase 1 exit gate

Report per-case and aggregate results, with run count and failures:

- Build/test pass rate and core-flow pass rate (evidence-backed).
- Requirement coverage: verified requirements / explicit requirements.
- Human review scores by dimension, including variance across runs.
- Critical defects and security regressions.
- Generation mode and whether any fallback scaffold was used.
- Cost/latency and actual model/provider settings, when available.

Do not claim improvement if the evidence is missing, test conditions differ without disclosure, or only the static diagnostic changes. Phase 1 remains **IN PROGRESS** until representative baseline/candidate outputs and runtime evidence are reviewed. Passing repository CI is necessary but does not satisfy this exit gate.


## Generation-time feature preflight (diagnostic, not a pass)

The full-stack generation route now audits generated source for recognizable signals corresponding to known, explicitly requested feature requirements. If one or more signals are missing, it makes **one bounded targeted completion attempt** using the original specification and the first-pass files, then records the remaining signals. This is a repair trigger only: source text can occur in comments/dead code, and different valid implementations can use different names.

Every generated result now carries an explicit output-quality status:

- `SUCCEEDED`: reserved for evidence-backed requirement acceptance checks; a build/render smoke alone cannot produce this status.
- `PARTIAL`: the fallback scaffold was used or the preflight still found likely missing feature signals.
- `UNVERIFIED`: build/render may have passed, but request-specific interactions have not been exercised with evidence.
- `FAILED`: the real build/runtime verification failed.

The generated report keeps each acceptance criterion at `NOT_EVALUATED` until a requirement-specific check and its evidence are actually recorded. The Copilot plan UI must preserve `PARTIAL` / `UNVERIFIED` rather than turning the final QA step green simply because the generation process ended.

## Remaining Phase 1 exit blockers

- Run all four canonical cases against the same baseline and candidate configuration at least three times per case.
- Preserve complete generated projects, actual provider/model settings, build and browser logs, screenshots at 360/768/1280px, and cost/latency where available.
- Execute requirement-specific user flows; the source-signal preflight and repository CI do not count as behavior evidence.
- Compare baseline/candidate artifacts and complete the blind human UX review. Until this is done, Phase 1 remains **IN PROGRESS**.


## Benchmark readiness preflight

Before spending time or model tokens on a generation run, start the intended backend checkout on the local benchmark port and run this from `backend/`:

```bash
AI_DOST_BENCHMARK_REVISION=76efa666d809c381d61579de5fa7c9d31f6a5a53 \
AI_DOST_BASE_URL=http://127.0.0.1:5000 AI_DOST_BENCHMARK_MODEL=gemini \
  npm run quality:preflight
```

For the candidate checkout, set `AI_DOST_BENCHMARK_REVISION` to that checkout's exact `git rev-parse HEAD`. The preflight checks the loopback-only `/health` endpoint and requires explicit model preference and revision metadata. It does not call the generation endpoint, create artifacts, or consume model tokens. A health check is not proof that generation will succeed or that the preferred model is ultimately selected. If the health response reports zero recognized API keys, it warns rather than failing because an OAuth or other provider path may be configured; verify the intended provider before starting the benchmark.

Run the preflight separately against both baseline and candidate backend checkouts, using the same intended provider configuration. Do not run the full 12-generation phase until both are healthy.

## Runtime evidence package gate

After each generated run has been built/tested and exercised in an isolated browser, create \`runtime-evidence.json\` inside that run's directory. The manifest records:

- Build, test, and browser-flow statuses and log paths.
- Screenshots at 360px, 768px, and 1280px.
- One status and evidence-file reference for every exact \`requiredBehaviors\` string in the canonical case.
- A blind human review with a 0–5 score, notes, and an evidence-file reference for each rubric dimension.

All referenced files must exist inside the same run directory. Do not place credentials or real user data in the artifacts. The validator does not execute generated code and does not prove that the evidence is truthful; reviewers must inspect the referenced files.

Run from \`backend/\` after both phases' artifacts are collected:

\`\`\`bash
npm run quality:evidence:validate -- --artifacts-dir /tmp/ai-dost-phase1-comparison --runs 3
\`\`\`

The report is written to \`evidence-validation-report.json\`. A non-zero exit means at least one run's evidence package is missing or invalid. \`COMPLETE_FOR_HUMAN_QUALITY_REVIEW\` means the packages are complete enough to review, **not** that the apps passed. \`qualityAcceptanceStatus\` remains \`NOT_EVALUATED\`; only human review of the actual evidence can determine product quality.

## Automated live-generation capture

```bash
# Start the backend from the exact baseline checkout, then run from backend/ in the candidate checkout. The backend defaults to port 5000; use the backend port directly (not the frontend dev server) unless you have verified the proxy preserves the agent SSE route:
AI_DOST_BENCHMARK_REVISION=76efa666d809c381d61579de5fa7c9d31f6a5a53 \
AI_DOST_BASE_URL=http://127.0.0.1:5000 AI_DOST_BENCHMARK_MODEL=gemini \
  node scripts/run-phase-1-benchmark.js --phase baseline --runs 3 \
  --artifacts-dir /tmp/ai-dost-phase1-comparison

# Stop baseline and start the candidate checkout on the same local backend port, then:
AI_DOST_BENCHMARK_REVISION="$(git rev-parse HEAD)" \
AI_DOST_BASE_URL=http://127.0.0.1:5000 AI_DOST_BENCHMARK_MODEL=gemini \
  node scripts/run-phase-1-benchmark.js --phase candidate --runs 3 \
  --artifacts-dir /tmp/ai-dost-phase1-comparison

# After both summaries and all per-run artifacts exist:
node scripts/compare-phase-1-benchmark.js --artifacts-dir /tmp/ai-dost-phase1-comparison
```

The comparison script pairs case/run IDs and reports file/latency/static-diagnostic deltas, provider parity, and artifact paths. It deliberately keeps `comparisonStatus: DIAGNOSTIC_ONLY` and `acceptanceStatus: NOT_EVALUATED`; a larger file count or more regex matches is not a quality verdict.

The runner sends each canonical prompt to `POST /api/agent/run` with `copilotDirector: true`, then preserves the generated project by reconstructing files from actual `file_written`/`file_changed` SSE events, alongside the normalized event log (`events.ndjson`), metadata, and static diagnostic report outside the repository. Each run uses a unique `projectId`; the Director route may persist its workspace through the project store rather than writing to the supplied `projectPath`, so SSE file events—not the request path—are the artifact source. A `generation_provider` event is recorded when a generation path exposes its selected provider; the primary Director path may not emit this event yet. The comparison script treats missing provider telemetry as `UNKNOWN`, not as a parity match. Run baseline and candidate with identical backend settings, provider credentials, provider order, model preferences, and timeout. The Director path now passes `preferredModel` to its top-level planner, specialist planners, repair plans, and verification planner; provider fallback remains allowed. Exact model IDs and failed fallback attempts may still be absent from SSE, so inspect backend logs/config where available and mark them unknown otherwise. Never infer the actual model from the requested preference.

The runner intentionally requires a loopback backend URL to avoid accidentally load-testing a remote or production service. For a locally authenticated backend, set `AI_DOST_BENCHMARK_TOKEN` and optionally `AI_DOST_BENCHMARK_USER_ID`; the token is sent only as a request header and is never written into run metadata. It refuses to overwrite existing run folders. Use a new artifacts directory for a fresh experiment. By default it runs all four cases three times (12 generations per phase; 24 total across both phases). To smoke-test one case first, pass `--case dashboard-search-charts-csv --runs 1`.

This is a capture harness, not an automatic acceptance test. It deliberately records `acceptanceStatus: NOT_EVALUATED`; it does not execute arbitrary generated npm scripts, assign UX scores, or claim that a finished SSE stream means a correct app. Run build and requirement-specific browser flows in an isolated environment, capture screenshots at 360/768/1280px, and attach evidence before interpreting baseline/candidate quality.
