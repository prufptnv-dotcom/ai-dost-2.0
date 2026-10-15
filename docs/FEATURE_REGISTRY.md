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

## [Architecture Freeze] Core Architecture & Runtime Strategy
- **Core Architecture Freeze**: `docs/AI_DOST_CORE_ARCHITECTURE.md` — Product principle ("Simple UI Outside, Autonomous System Inside"), modular capability architecture (12 modules), autonomy pipeline (8 stages), data authority rules, security boundaries (10/10 verified), failure philosophy.
- **Runtime Profiles**: `docs/RUNTIME_PROFILES.md` — LIGHT (mobile/PWA client), STANDARD (desktop, SQLite, local), SCALE (PostgreSQL, distributed workers, object storage). Contract compatibility matrix and resource-aware execution profiles.
- **Database Driver ADR**: `docs/DATABASE_DRIVER_ARCHITECTURE_DECISION.md` — Evaluated better-sqlite3, sqlite3, node:sqlite, sql.js. Decision: KEEP better-sqlite3 (environment fix, not code fix). Migration path documented.
- **Autonomous Execution Contract**: `docs/AUTONOMOUS_EXECUTION_CONTRACT.md` — Full execution pipeline, state machine, role-capability matrix, delegation rules, checkpoint/resume, repair cycles, handoff contracts, workspace isolation.
- **Scaling Boundaries**: `docs/SYSTEM_SCALING_BOUNDARIES.md` — LOCAL/STANDARD/SCALE tiers. Current abstraction readiness matrix. 7 blocking abstractions identified for future SCALE tier. Migration priority order documented.

## [Phase F1] Frontend Interaction Foundations
- **Command Palette Arrow Navigation**: `frontend/pages/dashboard.jsx` — Complete keyboard accessibility (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`) with active index wrap-around, hover synchronization, and ARIA combobox semantics.
- **Accessible Destructive Confirmations**: `ProjectsView.jsx`, `HistoryView.jsx`, `SettingsView.jsx` — Replaced blocking native `window.confirm()` popups with accessible, non-blocking `Modal` dialogs styled with semantic tokens.
- **Theme-Adaptive IDE Surfaces**: `frontend/components/views/IDEOverlays.jsx`, `frontend/components/views/CopilotIDE.jsx` — Refactored hardcoded dark hex values and zinc styling to semantic CSS variables, enabling seamless Light/Dark mode transitions.
- **Typography Optimization**: `frontend/styles/globals.css` — Removed external Google Fonts network dependency; 100% self-hosted local font rendering with zero FOUT.
- **Mobile Touch Targets**: `frontend/styles/chat-ux.css` — Standardized 44×44px minimum touch target dimensions for mobile navigation and chat action triggers.
- **Global Offline State Indicator**: `frontend/components/layout/AppShell.jsx` — Ambient connectivity status banner alerting users when offline while preserving local cached workflows.
- **Behavioral Test Suite**: `frontend/tests/phaseF1Foundations.test.jsx` — 5 unit tests validating offline indicators, modal confirmations, and tokenized styles. All 21 frontend suites (105 tests) passing.

## [Phase W1] Public Website & Documentation Ecosystem
- **Public Shared Shell**: `frontend/components/public/PublicNavbar.jsx`, `PublicFooter.jsx`, `PublicLayout.jsx` — Dedicated marketing navbar and 4-column footer decoupled from internal app navigation, featuring persistent theme switching and WCAG skip links.
- **Production Landing Page**: `frontend/pages/index.js` — Canonical narrative ("Tell AI-Dost what you need. Let it figure out the work."), interactive multi-scenario execution demo, 6 outcome capabilities, 8-stage pipeline stepper, and differentiation matrix.
- **Product Overview**: `frontend/pages/product.jsx` — 5 architectural layers and core engineering values breakdown.
- **Outcome Capabilities Catalog**: `frontend/pages/capabilities.jsx` — Outcome-oriented capability groupings: Build & Code, Research & Synthesize, Create Documents & Media, and Verify & Self-Heal.
- **Visual Execution Pipeline**: `frontend/pages/how-it-works.jsx` — Visual 8-stage lifecycle (Intent through Delivery) and 4-role authority matrix (Supervisor, Researcher, Coder, Verifier).
- **Security & Governance**: `frontend/pages/security.jsx` — Grounded technical safeguards mapped to code implementations, with honest disclosures disclaiming uncertified compliance badges.
- **Transparent Privacy**: `frontend/pages/privacy.jsx` — Local SQLite data residency, zero telemetry, and user deletion rights.
- **Legal & Platform Policy**: `frontend/pages/terms.jsx`, `frontend/pages/policy.jsx` — Open-source licensing (MIT), user output ownership, and responsible AI safety boundaries.
- **Company Story & History**: `frontend/pages/about.jsx`, `frontend/pages/changelog.jsx`, `frontend/pages/support.jsx` — Authentic project mission, verified release history (v2.0.0-rc.1 back to beta), and developer support hub.
- **Documentation Hub & Topic Guides**: `frontend/pages/docs/index.jsx`, `getting-started.jsx`, `concepts.jsx`, `agent.jsx`, `tools.jsx`, `projects.jsx`, `security.jsx`, `troubleshooting.jsx` — 7-part pedagogical blueprint (What, Why, When, How, Example, Limitations, Common Mistakes) with persistent sidebar navigation.
- **Public Suite Verification**: `frontend/tests/publicWebsite.test.jsx` — 11 automated test specs verifying public navigation, footer, trust pages, and documentation tracks. All 22 frontend suites (116 tests) passing.

## [Phase F2] Chat UI Final 10/10 Polish
- **Calm Editorial First Chat State**: `frontend/components/views/ChatView.jsx` — Restrained opening ("Hey. What are we working on today?") removing intrusive cards and feature chips.
- **Light Theme Typography & Contrast Engine**: `frontend/styles/globals.css` — High-contrast semantic mapping for headings, bold elements, tables, and blockquotes across light and dark themes.
- **Developer Code Blocks**: `frontend/components/chat/CodeBlock.jsx` — Clean lowercase language headers, accessible copy action with checkmark confirmation, and monospace styling.
- **Contextual Action Toolbar**: `frontend/components/views/ChatView.jsx` — Hover/focus reveals Copy, Read Aloud with live stop interruption, Try again, and persistent Thumbs Up/Down feedback.
- **User Message Edit**: `frontend/components/views/ChatView.jsx` — Hover pencil triggers composer prepopulation, cursor adjustment, and focus.
- **Smart Reading Scroll Engine & Jump Pill**: `frontend/styles/chat-ux.css`, `ChatView.jsx` — Scroll preservation while AI generates; floating "↓ Jump to latest" button when user scrolls away from bottom.
- **Polished Composer**: `frontend/components/views/ChatView.jsx` — Auto-grow input, radiant send state, accessible keyboard bindings (`Enter`/`Shift+Enter`), and compact tool controls.
- **Responsive Mobile Navigation**: `frontend/components/chat/SmartChatHeader.jsx`, `frontend/components/layout/AppShell.jsx` — Unified single top header with drawer trigger for mobile viewports.
- **Automated Verification**: Headless Playwright browser audit matrix (`screenshots/01-08`), 116 frontend tests passing, 0 ESLint warnings, 68 backend tests passing.

## [Milestone 1 - P7] Project Workspace Graph & Entity Engine
- **WorkspaceGraphService**: `backend/services/workspaceGraphService.js` managing context nodes (files, docs, research, endpoints, databases), dependencies, and topological query contracts.
- **Graph REST API**: `backend/routes/workspaceGraph.js` mounted at `/api/projects/:projectId/graph` with node addition, edge connections, and cluster analytics.
- **Interactive Graph Canvas**: `frontend/components/views/ProjectDetailView.jsx` featuring dynamic node layout, search filtering, node addition modal, and responsive light/dark themes.

## [Milestone 2 - P8] Project Automations & Workflow Hub
- **WorkflowEngine**: `backend/services/workflowEngine.js` supporting scheduled/triggered actions (`repo_health_check`, `test_watcher`, `auto_backup`, `sync_docs`).
- **Automations REST API**: `backend/routes/workflows.js` mounted at `/api/workflows` with full CRUD, template presets, and execution run history.
- **Automations View UI**: `frontend/components/views/AutomationsView.jsx` with template modals, trigger toggles, live run status, and run history viewer.

## [Milestone 3 - P0.2] Docker Sandbox Isolation Hardening & Safe Execution Guard
- **Resource Hardening**: `backend/sandbox/SandboxManager.js` capping memory (1GB max 2GB, swap capped), NanoCPUs (1.0 core), PidsLimit (100 anti-fork bomb), and no-new-privileges: true.
- **Local Sandbox Fallback Guard**: Hardened local fallback environment with strict path traversal rejection (`_resolveSafe`), destructive command policy (`validateCommandPolicy`), host secret sanitization (`sanitizeEnvironment`), and process timeouts.
- **Sandbox Telemetry API**: `backend/sandbox/routes.js` providing `/api/sandbox/health`, `/status`, and 1-click `/test` diagnostic probe.
- **Settings Security Telemetry UI**: `frontend/components/views/SettingsView.jsx` featuring Sandbox & Security Isolation Card, resource quota grid, and live probe test trigger with latency tracking.

## [Milestone 4 - P0.3] Automated Action Verifiers (Self-Verification Engine)
- **Verifier Engine**: `backend/services/verifierService.js` validating code syntax (AST parsing, bracket balancing, string literal check for JS/TS/JSX/JSON/Python), secret leak shielding (API keys/tokens regex), dependency consistency (`package.json`), and document magic byte integrity (`%PDF-`, `PK\x03\x04`, CSV).
- **Verifier REST API**: `backend/routes/verifier.js` mounted at `/api/verify` with `/health`, `/code`, `/document`, and `/action`.
- **Inline Agent Guard**: `backend/routes/agent.js` integrated with verifier to automatically validate `write_file` and `apply_diff` actions.
- **Copilot IDE AI Inspector**: `frontend/components/ide/AiInspector.jsx` featuring Quality & Verification score badge (100/100 Verified), 3 automated check items, 1-click verification trigger, and diagnostics list.
- **Editor Toolbar Integration**: `frontend/components/ide/EditorToolbar.jsx` & `CopilotIDE.jsx` with inspector toggle button and flex-safe side-by-side rendering.
