# AI-DOST — PHASE 2F.4 HYBRID RETRIEVAL COMPLETE

## Objective
Implemented the Phase 2F.4 Hybrid Retrieval & Ranking Engine, allowing for secure, normalized, and ranked retrieval against the Phase 2F.3 derived vector index.

## Implementation Details

### Retrieval Modes
- **EXACT / FULL_TEXT**: Uses ChromaDB's `$contains` filter to deterministically retrieve exact keyword matches.
- **SEMANTIC**: Uses L2 distance queries against the configured embedding model (`all-MiniLM-L6-v2`), normalizing scores using `1.0 / (1.0 + distance)`.
- **HYBRID**: Combines Semantic and Keyword candidates into a unified ranker.

### Ranking & Normalization
The ranking formula normalizes scores into a (0, 1] range.
`hybrid_score = (0.6 * semantic_score) + (0.3 * keyword_score) + (0.1 * authority_score)`

### Authority Policy
Source types contribute a deterministic authority score (`gamma = 0.1` weight):
- `workspace_file`: 1.0
- `artifact` / `verification_result`: 0.9
- `context_node`: 0.8
- `message`: 0.6
- `execution_history`: 0.5

### Deduplication
Chunks belonging to the same `source_entity_id` are merged. The highest score among the chunks dictates the final entity score, preserving the highest-relevance evidence.

### Project Isolation
Strict metadata boundary: `{"project_id": {"$eq": req.project_id}}`. Cross-pollination is explicitly blocked at the vector-search level.

### Failure Handling
- **Semantic Fallback**: Implemented a graceful degradation where Python handles internal exception traces and returns empty candidates if thresholds aren't met. Node.js interprets timeouts/disconnects as `INDEX_UNAVAILABLE`.
- **Thresholding**: Applied a strict Semantic threshold (`norm_score > 0.4`) to prevent gibberish queries from returning irrelevant nodes.

### Evaluation Metrics
Implemented baseline deterministic evaluation inside `retrievalIntegration.test.js`:
- Precision@K
- Recall@K
- MRR (Mean Reciprocal Rank)

## Known Limitations
- Lexical full-text is currently implemented via `$contains`, which is naive substring matching. A true BM25 lexical implementation could replace this later if advanced keyword search is required.
- Stale version filtering validates presence, but true node-level hash verification requires `ContextAssembler` to pull canonical hashes in Phase 2F.5/2F.6.

## Phase 2F.5 Handoff
The retrieval system is fully independent. Phase 2F.5 will introduce the `ContextBudgetManager` to consume these results and dynamically budget them into LLM prompt windows.
