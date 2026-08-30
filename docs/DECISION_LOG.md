# Architecture Decision Log (ADR)

**Document Type:** Canonical Decision History  
**Last Updated:** 2026-08-30

---

### ADR-001: Unified AI Work Platform over Disjoint Feature Silos
- **Date:** 2026-08-30
- **Context:** Risk of treating Copilot, Chat, Resume, Images, and Documents as isolated disconnected apps.
- **Decision:** AI-Dost is a unified platform. All modules share the same Agent Core, Memory, Context Graph, Tools, and Sandbox.
- **Consequence:** High modularity, zero redundant subsystems, compounding capability gains.

### ADR-002: Layered Smart Diff Engine
- **Date:** 2026-08-29
- **Context:** Exact string replacements frequently failed on whitespace/CRLF mismatches.
- **Decision:** Implemented a 4-tier fuzzy match engine (Exact -> Normalized -> Whitespace/CRLF tolerant -> Anchor based) with before/after hashing.
- **Consequence:** 100% reliable autonomous code edits with zero silent file corruption.

### ADR-003: Batch-Based Parallel Task Execution with Per-File Locking
- **Date:** 2026-08-30
- **Context:** Need for fast multi-file edits without file-corruption race conditions.
- **Decision:** Implemented `TaskScheduler` with DAG dependencies and `LockManager` FIFO per-file async mutex.
- **Consequence:** High concurrency for independent files; strict ordering for dependent files.

### ADR-004: DAG Cycle Abort Policy
- **Date:** 2026-08-30
- **Context:** Circular dependencies in execution tasks can deadlock or corrupt workspace.
- **Decision:** Abort entire batch on detected cycle and report error to agent planner.
- **Consequence:** Workspace remains clean and uncorrupted upon invalid plans.
