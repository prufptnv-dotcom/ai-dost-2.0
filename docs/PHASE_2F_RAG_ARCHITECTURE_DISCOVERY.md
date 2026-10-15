# PHASE 2F: RAG ARCHITECTURE DISCOVERY

## 1. Executive Summary
Phase 2F outlines the transition from static, explicitly linked context to a dynamic, semantically aware Context Retrieval (RAG) system. The overarching principle is that the vector index is strictly a **derived, rebuildable index**. The Universal DB and Physical Workspace remain the absolute canonical sources of truth. The RAG system acts purely as an advanced search capability to feed the `ContextBudgetManager` and `ContextAssembler` before reasoning begins in the `TaskPlanner`.

## 2. Phase 1.2–2E Frozen Foundation
The architecture strictly respects existing boundaries:
- **Universal DB**: Canonical truth for Tasks, Runs, Steps, Artifacts, and Memory (ContextNodes).
- **WorkspaceManager**: Canonical truth for the filesystem.
- **ExecutionController**: Canonical truth for runtime state transitions.
- **ProjectAuthorizationService**: Absolute boundary for cross-project isolation.

## 3. Current Context Architecture
Currently, the `ContextAssembler` retrieves fixed data structures (Project Metadata, User Data, explicitly requested Files) directly via DAOs. There is no automated semantic discovery. If a project has 500 files, the agent blindly relies on `ListFilesTool` or `grep` iteratively, which consumes massive planner loops and context tokens.

## 4. Context Taxonomy
We explicitly categorize knowledge to avoid a "generic context bucket":
1. **Conversation Context**: Short-term user/agent messages (Mutable, highly ephemeral, Chronological).
2. **Project/Workspace Context**: Source code, dependencies (Mutable, persistent, Exact/Full-text).
3. **Artifact Context**: Generated specs, docs, plans (Mutable, persistent, Semantic).
4. **Memory (ContextNodes)**: Explicitly learned rules, APIs, architectural choices (Immutable/Mutable, persistent, Semantic).
5. **Execution History**: Failed steps, repair plans, verification evidence (Immutable, persistent, Exact).

## 5. Current Retrieval Mechanisms
- **L0 (Exact)**: `ProjectDAO.getById`, `MemoryService.getNodes`.
- **L1 (Full-Text)**: `ReadFileTool`, `grep_search` tool.
- **L2 (Semantic)**: *Non-existent*.

## 6. RAG Use Cases
Not all data requires embeddings. The primary use cases for semantic retrieval are:
- Finding semantically related `ContextNodes` (e.g., "How did we solve the API rate limit last time?").
- Discovering relevant code files in a massive repository based on functionality descriptions.
- Retrieving relevant Architectural Decision Records (Artifacts) based on user intent.
- Fetching historical failure modes across past `AgentRuns` to avoid repeating mistakes.

## 7. Retrieval Decision Matrix
| Source | Canonical Store | Scope | Future Retrieval Strategy |
| :--- | :--- | :--- | :--- |
| User Intent | Memory/API | Request | Exact Pass-through |
| Core Metadata | Universal DB | Project | L0 SQL Lookup |
| Code Snippets | Workspace | Project | L1 Ripgrep + L2 Semantic |
| Learned Rules | ContextNodeDAO| Project | L2 Semantic |
| Recent Chat | MessageDAO | Session | L0 Chronological SQL |
| Artifacts | ArtifactDAO | Project | L2 Semantic + L1 Full-Text |

## 8. Hybrid Retrieval Architecture
The future pipeline must conceptually follow:
`User Intent → Project Auth Filter → (SQL Exact + BM25 Full-Text + Vector Semantic) → Reranker → ContextBudgetManager → LLM Context`

## 9. Embedding Architecture
- **Target**: `ContextNodes`, `Artifact` contents, Code AST blocks.
- **Index**: Ephemeral/Derived. 
- **Metadata attached**: `project_id` (Mandatory), `source_entity_id`, `source_type`, `version_hash`.

## 10. Chunking Strategy
- **Code**: AST-aware chunking (by function/class) to avoid splitting semantic logic.
- **Documents**: Markdown-header-aware chunking.
- **Overlap**: 10-15% token overlap to preserve contextual boundaries.

## 11. Source Lineage
RAG results will never return raw text directly to the planner as "truth". Instead, RAG returns a ranked list of `source_entity_id`s. The `ContextAssembler` uses these IDs to fetch the canonical data from `Universal DB` or `WorkspaceManager`, guaranteeing absolute lineage and authorization.

## 12. Project/User Isolation (Non-Negotiable)
All vector database queries MUST include a pre-filter:
`WHERE metadata.project_id = 'canonical_project_id'`
Global vector search followed by post-filtering is expressly forbidden due to data leakage risks.

## 13. Freshness & Invalidation
- **Hash Tracking**: Each embeddable entity in the canonical DB gets a `source_hash`.
- **Invalidation**: When a file/artifact is updated, the hash changes. The derived vector chunk is marked stale.
- **Re-embedding Queue**: Background workers re-embed stale sources. Retrievers can optionally fallback to L1 search if L2 index is stale.

## 14. Context Budgeting
A `ContextBudgetManager` will allocate the LLM's context window (e.g., 128k tokens):
- 10% Reserved for System Prompt / Core Rules.
- 15% Reserved for Recent Conversation.
- 40% Reserved for Workspace/Code Context.
- 15% Reserved for Artifacts/Memory.
- 20% Reserved for LLM Output generation.
If RAG returns too many chunks, the Budget Manager truncates based on relevance scores.

## 15. RAG Failure Modes
- **No Results**: The `TaskPlanner` explicitly receives `context.semantic_results = []`. It must rely on exact lookups or ask the user. It must NEVER invent sources.
- **Vector DB Down**: Gracefully degrade to L1 (ripgrep/SQL) search without halting the agent.

## 16. Vector Store Evaluation
Given AI-Dost's `AGENTS.md` spec, a Python `ai-engine` (FastAPI + LlamaIndex) already exists. 
- **Recommendation**: Node.js backend treats the Python `ai-engine` as an external indexer. 
- **Storage**: Python side uses a local persistent index (e.g., ChromaDB or LlamaIndex SimpleVectorStore) entirely rebuildable from the Node.js Universal DB SQLite file.

## 17. Performance Architecture
- **L0 (Immediate)**: SQLite ID lookups.
- **L1 (Fast)**: BM25/ripgrep.
- **L2 (Slower)**: Network call to Python `ai-engine` for embeddings and similarity search.

## 18. Evaluation Metrics
The retrieval system should be evaluated using:
- **Precision@K**: How many of the top-K retrieved files were actually needed for the tool step?
- **Answer Grounding**: Does the generated `RepairPlan` exclusively use retrieved context without hallucinating file paths?

## 19. Agent Integration
The `TaskPlanner` remains ignorant of RAG. 
The `ContextAssembler` orchestrates the retrieval via a new `RetrievalOrchestrator`, bundles the text, and provides it to the Planner as standard context.

## 20. Memory vs RAG vs Context
- **Memory**: The canonical storage of user rules (e.g. "Always use Tailwind").
- **RAG**: The engine that finds the "Tailwind rule" when the user asks to "build a button".
- **Context**: The final compiled string given to the LLM during a step.

## 21. Multi-Agent Compatibility
Because the vector store enforces strict `project_id` pre-filtering and acts merely as an ID-retriever for the `Universal DB`, multiple agent types (Research, Code, Verify) can hit the same index simultaneously without race conditions or memory contamination.

## 22. Data Model Evolution
**Future SQLite additions (NOT implemented now)**:
- `sync_status` on `ContextNodes` and `Artifacts`.
- `last_embedded_hash` on `workspace_files`.

## 23. Phase 2F Implementation Sequence
1. **2F.1 Retrieval Contracts**: Define API schema between Node.js `ContextAssembler` and Python `ai-engine`.
2. **2F.2 Sync Triggers**: Add hash calculation and dirty-flagging to Node.js DAOs.
3. **2F.3 External Indexer**: Implement LlamaIndex processing in Python.
4. **2F.4 Context Budgeting**: Implement truncation limits in `ContextAssembler`.
5. **2F.5 Agent Integration**: Feed RAG results into the `PlannerExecutionLoop`.

## 24. Risks
- Embedding latency stalling the `PlannerExecutionLoop` during fast iterations.
- Out-of-sync derived indexes feeding stale code structure to the LLM.

## 25. Open Questions
- Should the Node.js backend push data to Python (Webhook), or should Python pull data from SQLite natively (Direct DB Read)? *Recommendation: Pull (Direct Read) to avoid network payloads for large files.*

## 26. Recommended Phase 2F.1 Scope
Define the JSON/REST contracts between the Node.js `ContextAssembler` and the Python `ai-engine`. Do not implement the database migrations or vector engine yet.
