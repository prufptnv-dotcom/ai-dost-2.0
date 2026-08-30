# Agent Runtime & Execution Lifecycle

**Document Type:** Runtime Engineering Specification  
**Status:** Active  
**Last Updated:** 2026-08-30

---

## 1. Lifecycle State Machine

```text
       ┌──────────────┐
       │     INIT     │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │   INSPECT    │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │     PLAN     │
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
  ┌───►│   EXECUTE    │◄────────┐
  │    └──────┬───────┘         │
  │           │                 │
  │           ▼                 │
  │    ┌──────────────┐         │
  │    │    VERIFY    │         │
  │    └──────┬───────┘         │
  │           │                 │
  │     Pass? ├────────┐ Fail   │
  │           ▼        ▼        │
  │    ┌──────────┐ ┌───────────┴──┐
  │    │  REVIEW  │ │   DIAGNOSE   │
  │    └────┬─────┘ └───────┬──────┘
  │         │               │
  │   Pass? ├──────┐ Fail   ▼
  │         ▼      │  ┌────────────┐
  │    ┌────────┐  └─►│   REPAIR   │
  │    │  DONE  │     └────────────┘
  │    └────────┘
  │
  └──── Max 50 Steps / Max 5 Repairs
```

---

## 2. Core Subsystems
1. **Smart Diff Engine:** Layered fuzzy patch matching preventing syntax destruction.
2. **Lock Manager:** Per-file FIFO async mutexes with 30s timeout to prevent race conditions during parallel edits.
3. **Dependency Graph:** Dynamic import extraction and reverse dependent invalidation.
4. **Task Scheduler:** Topological DAG task scheduler with cycle detection (abort policy).
5. **Diagnostics Interceptor:** Automated static analysis triggering `DIAGNOSE -> REPAIR` transitions.
