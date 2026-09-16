# CI/CD Pipeline Audit — AI-Dost 3.0

**Audit Date:** 2026-09-16  
**Workflow Path:** `.github/workflows/ci.yml`

---

## 1. Workflow Architecture & Jobs

The CI workflow is configured to execute on pushes and pull requests across `main`, `master`, and `audit/**`:

- **Job 1: `frontend` (runs on `ubuntu-latest`)**
  - Node 22 setup with npm dependency caching.
  - `npm ci`
  - `npm run lint`
  - `npm test -- --coverage`

- **Job 2: `backend` (runs on `ubuntu-latest`)**
  - Node 22 setup with npm dependency caching.
  - `npm ci`
  - `node --check server.js`
  - Backend integration and security test suite:
    `node --test tests/unit.test.js tests/integration.test.js tests/security-hardening.test.js tests/projectAuthorization.security.test.js tests/ssrf.security.test.js tests/chatTaskEvents.test.js tests/taskCancellation.test.js tests/chatTaskAdapter.test.js tests/chatTaskGateway.identity.test.js tests/chatTaskGateway.idempotency.test.js tests/durableTaskIdempotencyStore.test.js tests/startupParity.test.js`
  - Runtime actor test steps:
    - Copilot Director runtime tests (`agent/runtime/CopilotDirector.test.js`)
    - ChatTaskGateway replay tests (`agent/runtime/ChatTaskGateway.test.js`)
    - ExecutionController timeout tests (`agent/runtime/ExecutionController.test.js`)
    - DurableTaskStore recovery tests (`agent/runtime/DurableTaskStore.test.js`)
  - **Newly Added Hardening Step:**
    - Production Hardening Security Runtime tests (`agent/security/ProductionExecutionGuard.test.js agent/security/ProductionHardeningRuntime.test.js agent/security/ProductionRuntimeIntegration.test.js agent/security/ResourceGuard.test.js tests/orchestratorSecurityBoundary.test.js`)

- **Job 3: `e2e` (Playwright smoke test)**
  - Installs Chromium headless shell.
  - Runs frontend & backend integration smoke tests with artifact upload on failure.

- **Job 4: `docker` (Sandbox preview test)**
  - Uses `docker:24-dind` service container with `--privileged`.
  - Validates sandbox container creation and execution.

---

## 2. Hardening Recommendations Implemented

- Pinned security runtime and orchestrator boundary tests into the CI execution path.
- Verified absence of leaked secrets in workflow files.
