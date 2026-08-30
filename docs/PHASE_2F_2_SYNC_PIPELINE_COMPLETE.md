# PHASE 2F.2: RETRIEVAL SYNC & INDEXING TRIGGER PIPELINE COMPLETE

## 1. Overview
Phase 2F.2 established the event and synchronization boundary between the Node.js Universal DB and the Python `ai-engine` index layer. It introduces deterministic entity hashing to detect drift without modifying or exposing the primary SQLite DB directly to the Python process.

## 2. Hash Determinism
Created `backend/utils/hash.js`.
- Generates a deterministic SHA-256 hash using the entity's canonical `content`.
- Incorporates `metadata` by sorting keys deterministically to avoid false positives (e.g., identical JSON objects with different key ordering yielding different hashes).

## 3. Sync Pipeline (Node.js -> Python)
Created `backend/services/indexSyncService.js`.
- Provides an explicit `upsertEntity` and `deleteEntity` API for DAOs to trigger derived index updates.
- **Idempotency**: Pushing an identical event repeatedly is safe. 
- **Project Isolation**: Fails immediately (`PROJECT_NOT_FOUND`) if a sync event attempts to transmit data without a bounded `project_id`.
- **Approved Source Types**: Strictly limited to `workspace_file`, `artifact`, and `context_node`.

### Python Index Boundary
A stub `/ai/rag/index` endpoint was added to the Python `ai-engine`. It currently accepts `IndexRequest` payloads, validates the presence of `project_id` and an approved `action` (`upsert`, `delete`), and returns a success envelope without calculating real embeddings yet.

## 4. Stale-Index Detection
The `isStale` method in `IndexSyncService` enables the Node.js Retriever to instantly evaluate if a result from the Python vector index matches the current canonical state in SQLite or the filesystem. If a canonical file has been modified but the index hasn't synced, the hash divergence gracefully identifies the index result as stale.

## 5. Testing
A comprehensive test suite (`indexSyncService.test.js`) verifies:
- SHA-256 string stability and JSON sorting determinism.
- Enforcement of `project_id` presence on all outgoing sync payloads.
- Rejection of unregistered source types.
- Correct tombstone generation for `delete` events.
- Correct translation of network failures (e.g., Python down) to internal `INDEX_UNAVAILABLE` boundaries.

## 6. Next Steps (Phase 2F.3)
Now that the API (2F.1) and synchronization boundaries (2F.2) are fully constructed, Phase 2F.3 will focus strictly on the Python layer. We will implement the actual vector embeddings, chunking strategy, and the persistent vector database inside the `ai-engine`, safely consuming the validated payloads flowing from this new sync pipeline.
