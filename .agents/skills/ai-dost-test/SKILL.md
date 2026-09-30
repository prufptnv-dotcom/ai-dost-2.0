---
name: ai-dost-test
description: >-
  Use this skill to run tests for AI-Dost 2.0. This includes frontend Jest tests, backend unit/integration tests, and E2E Playwright tests.
---

# Testing AI-Dost 2.0

The project uses multiple testing frameworks. Use the following commands from the root directory (`c:\Users\vikash kumar\Pictures\ai dost 3.0\`) based on the type of test needed:

## 1. Frontend Tests (Jest)
To run the React component tests:
```powershell
npm run test:frontend
```

## 2. Backend Unit & Integration Tests (Node native test runner)
To run the core backend tests, including agent tools and RAG integration:
```powershell
npm run test:backend
```

## 3. End-to-End Tests (Playwright)
To run the full flow browser tests (requires both frontend and backend to be available):
```powershell
npm run test:e2e
```

## 4. Run Everything
```powershell
npm run test
```

## Troubleshooting
- If `test:e2e` fails, ensure that the dev servers are running on `:3000` (frontend) and `:5000` (backend), as E2E tests may require them depending on configuration.
- Watch out for port conflicts if tests spawn dummy servers.
