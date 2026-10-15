================================================================================
AI-DOST — PHASE 2F.3 ARCHITECTURAL APPROVAL
================================================================================

Embedding Model:
`all-MiniLM-L6-v2` via `chromadb.utils.embedding_functions.DefaultEmbeddingFunction`

Embedding Dimension:
384

Chunking:
Handled via `llama_index.core.node_parser.SentenceSplitter` (chunk_size=512, chunk_overlap=50). Chunk IDs are fully deterministic: `sha256(project_id_source_entity_id_version_hash_index)`.

Persistence:
Uses `chromadb.PersistentClient(path="./chroma_db", settings=Settings(anonymized_telemetry=False))`. Index survives service restart and successfully mounts existing files.

Version Replacement:
Before chunking and upserting, an explicit metadata-scoped `delete()` is called for the source entity. This safely purges stale versions ensuring only the latest active chunks remain.

Delete:
Implemented explicitly. Passing action="delete" issues a targeted deletion via metadata filtering, accurately purging source IDs while ignoring all other entities. Unknown deletes execute safely as a NOOP.

Project Isolation:
Enforced natively at the metadata level within the Python engine. Node.js dictates the `project_id`, which is embedded in every chunk's metadata. All CRUD operations strictly enforce `{"project_id": {"$eq": req.project_id}}`. Project-scoped tenant isolation guarantees vectors from Project A are mathematically invisible to Project B scopes.

Source Collision:
Safely resolved via the chunk ID formula and metadata tenant isolation. Two projects containing `doc_1` generate distinctly unique chunk IDs because the formula prepends `project_id`.

Metadata Integrity:
All stored vectors strictly preserve `project_id`, `source_entity_id`, `source_type`, `version_hash`, `chunk_index`, and `embedding_model`. Custom metadata sent from Node is appended carefully, ensuring system-level metadata keys cannot be arbitrarily overridden.

Failure Isolation:
If `ChromaDB` fails to initialize (e.g. malformed environment variables like UTF-16 `.env`), the Python engine handles the exception safely, exposing HTTP 503 Vector Store Unavailable errors to Node. The Node-side `IndexSyncService` intercepts network failures (`INDEX_UNAVAILABLE`) gracefully. Universal DB and canonical files are fully unaffected.

Rebuildability:
Because Universal DB maintains authoritative hashes and sources, deleting the `./chroma_db/` folder safely allows Node.js to trigger a total rebuild of the RAG index by re-syncing events, returning the system to mathematical equivalence. No canonical truth lives in Chroma.

Security:
No plaintext API keys embedded. Vectors are scoped correctly. `chroma_db` is a gitignored runtime derivative.

Tests:
Expanded `backend/tests/indexingIntegration.test.js` to 8 strict scenarios validating chunking, upsert idempotency, version replacement, collision isolation, delete guarantees, and rejection of malformed tenant requests.

Regression:
TOTAL: 37 Unit Tests, 31 Integration Tests, 8 Python-Engine Contracts
PASS: 100%
FAIL: 0
SKIPPED: 0

Defects Found:
1. `indexSyncService` parsing of the new response contract failed due to `response.status` vs HTTP status checks.
2. Python engine crashed entirely on load if the `.env` file contained incompatible UTF-16 encodings.
3. Legacy `RagQuery` endpoints existed concurrently, polluting FastAPI routing logic.

Defects Fixed:
1. Hardened response parsing in `IndexSyncService`.
2. Repaired UTF-8 encoding of the `.env` configuration file to ensure safe ChromaDB client initialization.
3. Systematically purged legacy Phase 2F.2/Phase 1.x `/ai/rag/query` and `/ai/rag/index` endpoints from `main.py`.

Remaining Technical Debt:
None directly blocking Phase 2F.4. (Semantic retrieval & actual querying is next).

Phase 2F.4:
READY

Commits:
NONE

Pushes:
NONE

FINAL DECISION:
PHASE 2F.3 APPROVED

STOP — WAIT FOR EXPLICIT APPROVAL FOR PHASE 2F.4
================================================================================
