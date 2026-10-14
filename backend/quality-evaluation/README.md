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
