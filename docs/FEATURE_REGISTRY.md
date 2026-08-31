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
*   **Context Nodes & Edges:** \ ackend/db/dao/ContextNodeDAO.js\, \ ackend/db/dao/ContextEdgeDAO.js\
*   **Project-Scoped Memory:** \ ackend/services/memoryService.js\
*   **Legacy Migrator:** \ ackend/db/legacyMemoryMigrator.js\ (idempotent, migrates personal_brain_memory.json)

## 5. Agent Runtime (Planned - Phase 2)
*   **Autonomous Engine:** TBD
*   **RAG Pipeline:** TBD

## [Phase 2F.1] Retrieval Contracts
- **RetrievalService**: Node.js boundary enforcing schema validation, identity, tenant isolation, and error mapping for external indexing engines.
- **Python Retrieval Scaffold**: Stub REST endpoints defining the strict cross-process boundary for RAG.

## [Phase 2F.2] Retrieval Sync Pipeline
- **Entity Hashing**: Deterministic SHA-256 generation in Node.js for tracking  ersion_hash across canonical text and metadata.
- **IndexSyncService**: Safely pushes upsert and delete entity events to the Python  i-engine index, strictly enforcing project isolation rules before transmission.
- **Stale Detection**: Ability to instantly detect if retrieved vector results match canonical content.

## [Phase 2G.3] AgentCoordinator & Multi-Agent Delegation
- **AgentCoordinator**: `backend/agent/runtime/AgentCoordinator.js` managing Supervisor/Worker lifecycle, delegation depth, and worker concurrency.
- **Concrete Supervisor**: `backend/agent/runtime/Supervisor.js` and `backend/services/supervisorService.js` bound strictly to `orchestration.manage`.
- **Capability Policy**: `backend/agent/policy/CapabilityPolicy.js` enforcing role-based capabilities (`SUPERVISOR`, `RESEARCHER`, `CODER`, `VERIFIER`).
- **AgentHandoffService**: `backend/services/agentHandoffService.js` and `backend/db/dao/AgentHandoffDAO.js` managing handoff state machine and idempotency.
- **Canonical Result Persistence**: `backend/db/migrations/004_agent_handoff_results.js` and `backend/agent/runtime/resultValidator.js` providing bounded, validated worker results in `agent_handoffs.result_json`.

## [Phase 2G.4] Advanced Multi-Agent Verification & Arbitration
- **VerificationContract**: `backend/agent/verification/VerificationContract.js` defining canonical PASS/FAIL/BLOCKED results and check types.
- **MultiAgentVerifier**: `backend/agent/verification/MultiAgentVerifier.js` providing independent, read-only verification of worker results and evidence freshness.
- **SupervisorArbitrator**: `backend/agent/arbitration/SupervisorArbitrator.js` providing deterministic supervisor arbitration (`COMPLETE`, `REPAIR`, `WAITING_FOR_USER`, `FAILED`) and bounded repair cycles (max 3).

## [Phase 3.2] Design System Tokens & Core Primitives
- **Centralized Tokens**: `frontend/styles/tokens.css` & `frontend/tailwind.config.js` with semantic canvas, border, typography, and motion tokens.
- **Core Primitives**: `frontend/components/ui/` (`Button`, `IconButton`, `Input`, `Textarea`, `Badge`, `StatusIndicator`, `Tabs`, `Modal`, `Panel`, `Divider`, `Skeleton`, `EmptyState`, `BrandLogo`).
- **Layout Primitives**: `frontend/components/layout/` (`AppShell`, `SplitPane`, `PanelGroup`).

## [Phase 3.3] Product Shell & Navigation Architecture
- **Sidebar Navigation**: `frontend/components/Sidebar.jsx` with 3-tier information architecture (Core, Projects/Artifacts, System), collapsed/expanded modes, active indicators, and quick actions.
- **TopBar Controls**: `frontend/components/TopBar.jsx` with section context, integrated ProjectSwitcher, live agent runtime status, model picker, and command palette triggers.
- **ProjectSwitcher**: `frontend/components/ui/ProjectSwitcher.jsx` for compact, high-clarity project context switching.

## [Phase 3.4] Chat UX & Editorial Stream
- **Editorial Stream**: `frontend/components/chat/MessageStream.jsx` rendering user/assistant messages with clean markdown, code block header/copy/runner, and thinking pill.
- **Tool Execution Blocks**: `frontend/components/chat/ToolExecutionCard.jsx` displaying structured tool calls (`read_file`, `write_file`, `run_command`, `search_code`, `verify`) with expandable output.
- **Verification Cards**: `frontend/components/chat/VerificationCard.jsx` displaying Phase 2G independent verification check breakdowns.
- **Artifact Integration**: `frontend/components/chat/ArtifactCard.jsx` displaying document/image/widget artifact summaries with preview and download actions.
- **Chat Composer**: `frontend/components/chat/ChatComposer.jsx` with auto-resizing textarea, voice, persona, and send/stop states.

## [Phase 3 Rebuild] Editorial Workbench Visual Architecture
- **Signature Mark**: `frontend/components/brand/AiDostMark.jsx` & `AiDostWordmark.jsx` — flat geometric A/D monogram with conversation notch and terracotta accent.
- **Command Rail**: `frontend/components/layout/CommandRail.jsx` — 56-64px icon-first rail with terracotta active indicator.
- **App Shell**: `frontend/components/layout/AppShell.jsx` — Orchestrates Rail → Canvas → Context Inspector.
- **Context Inspector**: `frontend/components/layout/ContextInspector.jsx` — 300-360px contextual data and evidence drawer.
- **Action Spine**: `frontend/components/chat/ActionSpine.jsx` — Vertical tool action spine attaching to assistant prose.
- **Composer Dock**: `frontend/components/chat/ComposerDock.jsx` — Non-bloated, auto-resizing input dock.
- **Agent Workbench**: `frontend/components/views/AgentView.jsx` — Mission header, coordinator tree, active work panel, timeline, and `WAITING_FOR_USER` approval surface.
- **Editorial Projects Table**: `frontend/components/views/ProjectsView.jsx` — Table/list view with activity and direct workspace actions.

## [Phase 3.6] Copilot IDE & Monaco Editor Chrome Rebuild
- **File Explorer**: `frontend/components/ide/FileExplorer.jsx` — compact 26px rows, clear indentation guides, terracotta active marker, search filter, and ARIA treeitem semantics.
- **Workspace Tabs**: `frontend/components/ide/WorkspaceTabs.jsx` — restrained 32px height, active terracotta bottom indicator, modified status dot, hover close.
- **Editor Toolbar**: `frontend/components/ide/EditorToolbar.jsx` — path breadcrumbs, language badge, saved/modified status, format, diff, preview, and inline AI triggers.
- **Monaco Syntax Theme**: `frontend/components/ide/MonacoTheme.js` — `aidost-dark` and `aidost-light` themes with non-neon semantic syntax tokens.
- **Terminal Dock**: `frontend/components/ide/TerminalDock.jsx` — JetBrains Mono execution surface with Terminal, Problems, Output tabs and real `$ ` command prompt.
- **AI Inspector**: `frontend/components/ide/AiInspector.jsx` — contextual slide-out drawer with AST target context, agent diff stats, and quick actions.
- **Diff Review**: `frontend/components/ide/DiffReview.jsx` — split before/after diff review with subtle green/red gutter markers.

## [Phase 3.7] Secondary Product Surfaces Rebuild
- **Document & Artifact Shelf**: `frontend/components/views/ArtifactsView.jsx` — Table view of generated PDF/DOCX/Excel/PPTX/CSV artifacts with preview and download.
- **Conversation & Task History**: `frontend/components/views/HistoryView.jsx` — Searchable chronological timeline with grouped SQLite sessions.
- **Workspace Settings**: `frontend/components/views/SettingsView.jsx` — AI Model Cascade, masked API key inputs, and preferences.
- **Voice Assistant**: `frontend/components/views/VoiceView.jsx` — Flat technical waveform, live transcription stream, and keyboard fallback.
- **MCP Registry**: `frontend/components/McpPanel.jsx` — Technical connector table for external tools and databases.
- **Resume & CV Editor**: `frontend/components/views/ResumeView.jsx` — Document editor layout, paper document live preview, and artifact shelf export integration.

## [Phase 3.8] Product-Wide UI/UX Polish & Integration
- **Shared UI Primitives**: Standardized `Button`, `Badge`, `StatusIndicator`, `EmptyState`, `Modal`, `Tabs`, `Input` across all screens.
- **Semantic Status Engine**: Cohesive vocabulary mapping (`active`/terracotta, `working`/blue, `success`/green, `warning`/amber, `error`/red).
- **Production Gate**: All 10 views verified with real-browser Playwright matrix (Average Score: 9.57/10), 29/29 unit tests passing, 0 lint errors, 0 git diff errors.

## [Phase 4] Production Hardening, E2E Validation & Release Engineering
- **Production Readiness Suite**: `backend/tests/productionReadiness.test.js` — 10 test scenarios covering path traversal defense, UNC blocking, null byte rejection, cross-user isolation, capability enforcement, database restart durability, and large-scale (1,000+ files) workspace scanning.
- **Architecture & Security Audit**: `docs/PHASE_4_1_PRODUCTION_ARCHITECTURE_AUDIT.md` — Threat modeling, attack defense validation, defect classification (0 P0, 0 P1).
- **Deployment Runbook**: `docs/PHASE_4_2_DEPLOYMENT_RUNBOOK.md` — Complete production startup, health monitoring, disaster recovery, and offline backup procedures.

