# AI-DOST — PHASE 2F.5 CONTEXT BUDGET MANAGER COMPLETE

## Objective
Designed and implemented the `ContextBudgetManager.js` to serve as a deterministic context-selection, deduplication, and packaging layer. This acts as the buffer between upstream context sources (like RetrievalService, DB DAOs) and downstream consumption by the `TaskPlanner` (Phase 2F.6).

## Implementation Details

### Context Taxonomy
Explicit context categories were established and normalized to guarantee a bounded reasoning environment:
- `SYSTEM`
- `USER_REQUEST`
- `PROJECT`
- `WORKSPACE`
- `CONVERSATION`
- `MEMORY`
- `ARTIFACT`
- `EXECUTION_HISTORY`
- `VERIFICATION`
- `RETRIEVAL`

### Budget Policy & Estimation
- Created a conservative token estimator (`Math.ceil(text.length / 4)`).
- Implemented configurable category allocations for optional context:
  - `workspace`: 30%
  - `conversation`: 20%
  - `memory`: 15%
  - `retrieval`: 15%
  - `artifact`: 10%
  - `execution_history`: 10%
- Allows explicit override of total budget (default 100k).

### Priority Model & Freshness
- Modeled deterministic Source Authority (e.g. `WORKSPACE=1.0`, `VERIFICATION=0.9`, `EXECUTION_HISTORY=0.5`).
- Score computation: `relevance * freshness * authority * priority`.
- Freshness handling explicitly discards optional items if marked stale (`is_stale: true`), avoiding hallucinations based on outdated derived indexes.

### Deduplication
- Items are deduplicated based on a stable `source_id`.
- The item yielding the highest composite `final_score` overwrites lower-value duplicates, preserving semantic matches alongside keyword hits or DB retrievals.

### Mandatory vs Optional Context
- **Mandatory** items (`is_mandatory: true`) are immune to token trimming and unconditionally preserved. 
- Example: System prompts, the user's current request, critical project metadata.
- **Optional** context is trimmed predictably via a two-pass algorithm: category-allocated fill followed by a greedy fallback fill. Whole-chunk trimming occurs when capacity is reached.

### Security (Project Isolation)
- `packageContext({ projectId, items })` requires explicit project scoping.
- Items bearing a conflicting `project_id` are instantly trapped and dropped prior to ranking, preventing cross-tenant leakage.

### Performance
- Single-pass normalization.
- O(N) deduplication using `Map`.
- Sort overhead constrained to bounded `limit` arrays (typically N < 100), avoiding O(N^2) traps.

### Tests
- Created `contextBudgetManager.test.js` validating all 18 requirements explicitly (deduplication, project isolation, token estimation, sizing bounds, etc).
- 100% test pass rate.

## Known Limitations
- The token estimator is heuristic (`characters / 4`). For absolute precision, integrating `tiktoken` or a model-specific tokenizer would be required, but the current estimator is deterministic and guarantees bounds.
- RAG `version_hash` cross-referencing happens upstream; `ContextBudgetManager` trusts the `is_stale` boolean provided to it.

## Phase 2F.6 Handoff
`ContextBudgetManager` currently operates entirely standalone. 
In Phase 2F.6, the `ContextAssembler` will be refactored to fetch all data sources, map them through `ContextBudgetManager`, and seamlessly inject the unified `ContextPackage` into the `TaskPlanner` reasoning loop.
