# Canonical App Benchmark Runbook

This runbook describes how to execute the six canonical generated-application cases against a running AI Dost backend. The live runner records actual SSE events and the server-emitted quality-gate result. It does not turn static diagnostics or unit-test fixtures into benchmark passes.

## Prerequisites

- Run the code from the same machine as the backend. The runner deliberately accepts loopback URLs only and preserves generated projects locally.
- Start the backend with a valid model/provider credential and the configured \`AIDOST_RUNNER_SECRET\` (at least 16 characters) in \`backend/.env\`.
- Use the same model route and comparable settings when comparing baseline and candidate revisions.
- Keep API tokens and runner secrets out of the report. The runner does not print them.

## PowerShell: run all six cases once

From the repository root:

\`\`\`powershell
$revision = (git rev-parse HEAD).Trim()
cd backend
npm run benchmark:canonical -- --base-url http://127.0.0.1:5000 --preferred-model auto --revision $revision --runs 1
\`\`\`

Use the actual local backend port if it differs from 5000. Replace \`auto\` with a specific configured model route if the benchmark requires model parity. The backend and CLI must both be able to load \`AIDOST_RUNNER_SECRET\`; the CLI loads \`backend/.env\` when present.

Run an individual case with \`--case <case-id>\`. Available IDs are read from \`backend/quality-evaluation/canonicalCases.json\`; the current six are:

1. \`landing-page-hero-features-cta\`
2. \`dashboard-search-charts-csv\`
3. \`ecommerce-cart-checkout\`
4. \`education-quiz-progress\`
5. \`api-backed-crud\`
6. \`multi-step-repair\`

The repair case seeds a deliberately defective state-update/API helper and failing Node tests so it evaluates an actual repair task rather than asking an empty workspace to imagine a defect.

## Output and status rules

The runner prints the output directory and writes:

- \`canonical-benchmark-summary.json\`: machine-readable run matrix, statuses, scores, timing and evidence paths.
- \`canonical-benchmark-report.md\`: concise per-case report.
- For each case/run: \`events.ndjson\`, \`metadata.json\`, and the generated project files.

Output is written outside the repository by default to avoid accidentally committing generated artifacts. Preserve the full output directory when reviewing a run.

A case receives \`PASSED\` only when the run has a successful Director terminal event, generated files, a \`VERIFIED_PASS\` quality-gate outcome, a verified trusted execution receipt, a passing build and passing canonical acceptance flows. If any of these are missing, the case is not a pass.

The summary's \`investorGradeStatus\` intentionally remains \`NOT_EVALUATED\`: this runner does not independently capture actual browser screenshots at 360/768/1280 px, conduct visual/accessibility review, or compare baseline and candidate outputs. Complete and preserve those checks before claiming investor-grade quality improvement.

## Reading a failed run

Inspect each run's \`metadata.json\` and \`events.ndjson\` for the generation terminal status, provider/model observations, quality-gate status, receipt verification, build/test/acceptance results, errors and artifact hash. Do not infer the actual model solely from the requested model route. If the backend emits no quality-gate result, the runner reports \`NOT_EVALUATED\` rather than manufacturing a score.

A \`VERIFIED_PASS\` on these cases is an engineering signal, not evidence of revenue or a ₹20 crore valuation by itself.
