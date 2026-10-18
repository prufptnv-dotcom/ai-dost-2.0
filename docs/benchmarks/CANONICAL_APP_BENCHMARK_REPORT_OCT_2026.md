# AI Dost Canonical Generated-Application Benchmark

- **Benchmark Run ID**: `e5dbdf56-ea27-4e09-a661-1173d6c67f60`
- **Revision**: `ee1bef0`
- **Model Route**: `gemini` (`gemini-3.1-flash-lite` runtime cascade)
- **Execution Date**: 2026-10-18T13:21:16.597Z to 2026-10-18T13:28:56.766Z
- **Container Runtime**: Docker Desktop (`node:22-alpine` isolated execution adapter)
- **Repetitions per Case**: 1
- **Cases Evaluated**: 6/6
- **Cryptographic Receipts Verified**: 5/6 (HMAC-SHA256 run & artifact hash bound)
- **Runtime Status**: **NOT_FULLY_VERIFIED** (0/6 full acceptance gate pass, 5/6 partial/receipt-verified)
- **Investor-Grade Status**: **NOT_EVALUATED**

---

## Benchmark Results Matrix

| Canonical Case | Files | Receipt Verified | Gate Status | Acceptance Status | Score | Coverage | Elapsed | Notes / Primary Failure Reason |
|---|---:|:---:|---|---|---:|---:|---:|---|
| `landing-page-hero-features-cta` | 2 | ✅ True | FAILED | FAILED_OR_PARTIAL | 50/100 | 100% | 42.3s | Functional acceptance flows required full build verification |
| `dashboard-search-charts-csv` | 3 | ✅ True | FAILED | FAILED_OR_PARTIAL | 50/100 | 100% | 42.2s | Quality gate validation failed on strict container acceptance |
| `ecommerce-cart-checkout` | 3 | ❌ False | NOT_EVALUATED | NOT_EVALUATED | n/a | n/a | 91.9s | Static review detected direct state mutation `cart`; self-healing exhausted |
| `education-quiz-progress` | 3 | ✅ True | FAILED | FAILED_OR_PARTIAL | 50/100 | 100% | 52.4s | Quality gate validation failed on timer/progress flow assertions |
| `api-backed-crud` | 6 | ✅ True | FAILED | FAILED_OR_PARTIAL | 0/100 | 0% | 131.0s | Express/React contract capabilities partially detected across files |
| `multi-step-repair` | 5 | ✅ True | PARTIAL | FAILED_OR_PARTIAL | 10/100 | 20% | 100.2s | **Build Passed (true)**, **Acceptance Flows Passed (true)**; state recovery partial |

---

## Key Technical Observations

1. **HMAC-SHA256 Signed Receipts**:
   - 5 out of 6 runs generated and cryptographically verified receipts matching the server secret and SHA-256 artifact hash. Replay protection and SQLite run binding functioned properly.

2. **Docker Container Execution**:
   - Container execution adapter ran with `node:22-alpine`, restricted capabilities (`--cap-drop ALL`), and non-root uid:gid mounting the ephemeral project directory.

3. **Honest Gate Enforcement (P12.4)**:
   - The quality gate did NOT fabricate false passes. When acceptance flows failed or direct state mutation occurred (`cart`), the system truthfully flagged the defect rather than faking 100% score.

4. **Multi-Step Repair Progress**:
   - `multi-step-repair` successfully compiled (`buildPassed: true`) and passed automated acceptance assertions (`acceptanceFlowsPassed: true`), confirming repair iteration mechanics work on broken code fixtures.

5. **Remaining Engineering Gaps to ₹20 Cr Production Quality**:
   - Zero-shot full-stack capability generation for complex multi-route applications (`api-backed-crud`).
   - State immutability enforcement in React prompt priors (`ecommerce-cart-checkout`).
   - Independent multi-viewport visual browser screenshot regression suite (desktop 1280px, tablet 768px, mobile 360px).
