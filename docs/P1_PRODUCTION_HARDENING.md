# P1 Production Hardening

This audit branch carries the next production-hardening layer on top of the P0 runtime work.

## Runtime safety

- Chat autonomous tasks use a stable `taskId` scoped to authenticated user and project identity.
- Duplicate running tasks are rejected instead of executing twice.
- Completed/canceled task results and bounded runtime events can be replayed for client retries.
- Chat task state is persisted through `DurableTaskIdempotencyStore` in SQLite, so task identity survives process restart.

## HTTP boundary

`backend/security-hardening.js` is the centralized preload for production boundary controls. It provides a deny-by-default production CORS policy from `CORS_ORIGINS` / `FRONTEND_URL`, route-aware JSON body limits, and an idempotent response lifecycle guard for the existing AI concurrency semaphore.

## Observability

`ChatTaskGateway` emits structured task lifecycle events and logs task duration, replay, planning failures, execution failures, cancellations, and successful completion without logging authenticated user identifiers or secret material.

## Validation

The CI backend suite includes chat task identity/idempotency coverage and durable SQLite idempotency coverage. `main` remains outside this audit branch.
