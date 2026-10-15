# PHASE 2F.1: RETRIEVAL API CONTRACTS COMPLETE

## 1. Overview
Phase 2F.1 establishes the foundational boundaries for semantic retrieval without introducing an actual vector database or embedding model. This phase enforces strict boundaries separating the authoritative universal data layer (Node.js) from the future derived index layer (Python `ai-engine`).

## 2. API Contracts & Boundaries

### Request Contract
The Node.js `RetrievalService` strictly orchestrates requests ensuring that identity and authorization constraints are fulfilled before contacting the Python engine. 

```json
{
  "version": "1",
  "user_id": "u123",
  "project_id": "p456", 
  "query": "find authentication logic",
  "mode": "HYBRID",
  "filters": {
    "source_types": ["workspace_file", "context_node"],
    "limit": 10
  }
}
```
**Constraint**: The `project_id` and `user_id` are populated directly from the authenticated Node.js session. No LLM or external agent provides this identity, eliminating tenant spoofing attacks.

### Response Contract
The Python engine returns derived metadata and canonical entity pointers, never authoritative text.

```json
{
  "version": "1",
  "results": [
    {
      "source_entity_id": "file_789",
      "project_id": "p456",
      "source_type": "workspace_file",
      "chunk_id": "chunk_99",
      "score": 0.87,
      "version_hash": "a1b2c3d4",
      "metadata": {}
    }
  ]
}
```

## 3. Core Capabilities Defined

### Authorization & Project Isolation
- **Node.js Pre-flight**: Rejects requests missing valid tenant identifiers.
- **Python Index Filter**: Must filter indices natively via `WHERE project_id = ?`.
- **Node.js Post-flight**: The `RetrievalService` explicitly scrubs any results where `result.project_id !== request.project_id`, acting as a fallback safeguard against index leakage.

### Retrieval Modes
- `EXACT`, `FULL_TEXT`, `SEMANTIC`, `HYBRID`

### Source Types Controlled
- `workspace_file`, `artifact`, `context_node`, `message`, `execution_record`, `verification_result`.

### Stale Result Policy
Retrieval results include a `version_hash`. The future `ContextAssembler` will fetch the corresponding entity from the canonical `Universal DB`. If the database hash differs from the indexed hash, the source is deemed **stale** and either rejected or flagged for re-embedding.

### Failure Contract
Deterministic errors mapped cleanly for `TaskPlanner` consumption:
- `INVALID_REQUEST`, `UNAUTHORIZED`, `PROJECT_NOT_FOUND`, `INDEX_UNAVAILABLE`, `INDEX_TIMEOUT`, `NO_RESULTS`, `STALE_RESULT`, `INTERNAL_ERROR`.
No internal filesystem paths, DB queries, or stack traces are leaked.

## 4. SQLite Boundary Decision
The architecture document initially suggested the Python engine could directly read the SQLite DB for indexing. This has been **rejected**. 
- **Why**: Two-process DB coupling introduces severe schema ownership conflicts, lock contention, and breaks the encapsulation of the Node.js DAO layer.
- **Decision**: The Node.js Universal DB remains absolute. In Phase 2F.2, a controlled sync/export/event boundary will be introduced (e.g., Node pushes data to Python, or Python calls a Node HTTP sync endpoint). 

## 5. Tests
A dedicated `retrievalService.test.js` suite verifies the schema constraints, mapping of deterministic errors, and the rigorous tenant isolation checks (simulating a leaked cross-project result and verifying the Node boundary drops it).

## 6. Deferred Phase 2F.2 Work
The next phase (2F.2) will focus on constructing the synchronization pipeline: calculating entity hashes, detecting dirty state in the SQLite DB, and pushing those updates across the established API boundary to the Python engine. No embeddings will be calculated yet.
