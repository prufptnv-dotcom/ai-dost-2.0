# Production Hardening Status

## Controls now present on the audit branch

- Central capability decisions are fail-closed through `CapabilityGatekeeper` and scoped, expiring, single-use approval tokens.
- Workspace file tools resolve paths through `WorkspaceManager.resolvePath`, including traversal, UNC, null-byte, containment, and existing-parent symlink checks.
- Durable task state and idempotency protect retries and process-restart recovery paths.
- `ResourceGuard` provides reusable bounded budgets for input/output-sized values, file/change bytes, execution steps, repairs, and wall-clock time.

## Required integration rule

Every execution adapter that performs filesystem, command, patch, verification, or repair work must receive a request-scoped budget and call:

- `budget.assertActive()` before external work;
- `budget.consumeStep()` for each execution step;
- `budget.consumeRepair()` for each repair attempt;
- `budget.consumeChangedBytes(content)` before persisting generated changes;
- `assertBytes(value, limit, code, label)` for untrusted input/output boundaries.

A capability decision must be re-evaluated immediately before execution. A confirmation or explicit-approval token must be validated with the exact request, plan, and capability set; prompts must never be allowed to override a block decision.

## CI acceptance criteria

- Unit tests cover traversal/symlink rejection, approval replay and mismatch, durable idempotency, cancellation/timeout, and resource-budget exhaustion.
- CI must run both backend Node tests and Python tests.
- No production claim is considered complete until the relevant execution adapter is wired to these controls and CI is green on the branch head.
