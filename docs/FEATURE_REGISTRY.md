# Feature Registry

This document catalogs active, planned, and deprecated features along with their canonical locations.

## 1. Project Management
*   **Projects Store:** \ackend/db/dao/ProjectDAO.js\, \ackend/services/projectService.js\
*   **Workspace Lifecycle:** \ackend/services/workspaceManager.js\
*   **Authorization:** \ackend/services/projectAuthorization.js\

## 2. Agent Artifacts & Visuals
*   **Artifact Registry:** \ackend/db/dao/ArtifactDAO.js\, \ackend/services/artifactService.js\
*   **Visual Verifier:** \ackend/agent/verification/VisualVerifier.js\
*   **Document Generation:** \ackend/routes/documents.js\ (integrated with ArtifactService)
*   **Image Generation:** \ackend/routes/image.js\ (integrated with ArtifactService)

## 3. Communication
*   **Conversations & Messages:** \ackend/db/dao/ConversationDAO.js\, \ackend/db/dao/MessageDAO.js\

## 4. Context & Memory
*   **Context Nodes & Edges:** \ackend/db/dao/ContextNodeDAO.js\, \ackend/db/dao/ContextEdgeDAO.js\
*   **Project-Scoped Memory:** \ackend/services/memoryService.js\
*   **Legacy Migrator:** \ackend/db/legacyMemoryMigrator.js\ (idempotent, migrates personal_brain_memory.json)

## 5. Agent Runtime (Planned - Phase 2)
*   **Autonomous Engine:** TBD
*   **RAG Pipeline:** TBD

## [Phase 2F.1] Retrieval Contracts
- **RetrievalService**: Node.js boundary enforcing schema validation, identity, tenant isolation, and error mapping for external indexing engines.
- **Python Retrieval Scaffold**: Stub REST endpoints defining the strict cross-process boundary for RAG.

## [Phase 2F.2] Retrieval Sync Pipeline
- **Entity Hashing**: Deterministic SHA-256 generation in Node.js for tracking ersion_hash across canonical text and metadata.
- **IndexSyncService**: Safely pushes upsert and delete entity events to the Python i-engine index, strictly enforcing project isolation rules before transmission.
- **Stale Detection**: Ability to instantly detect if retrieved vector results match canonical content.

