# AI-Dost --- 5--10 Year Product & Engineering Master Plan

**Document type:** North Star / Master Goal / Execution Constitution\
**Status:** Living document\
**Owner:** AI-Dost team\
**Last updated:** 2026-09-03 (v2.5 Master Capabilities Reality & Verification Audit)

------------------------------------------------------------------------

## 0. The One Sentence That Prevents Us From Getting Lost

> **AI-Dost is an autonomous AI work platform, not a chatbot and not a
> coding product.**

Chat, Copilot, image generation, resume creation, documents, research,
automation, agents, and future capabilities are **modules of one
platform**.

**Copilot is one part of AI-Dost. It must never become the definition of
AI-Dost.**

Every future feature must answer:

1.  Does this make AI-Dost more useful as a unified AI work system?
2.  Does it share identity, memory, permissions, context, files, tools,
    and agent infrastructure?
3.  Can the user move from one capability to another without restarting
    the task?
4.  Does it strengthen the platform rather than create an isolated
    mini-product?

If the answer is no, the feature needs a strong reason to exist before
implementation.

------------------------------------------------------------------------

## 0.1 Execution Reality & Capabilities Scorecard (September 3, 2026)

This section reflects the **empirically verified, live status** of AI-Dost. Every item marked `COMPLETE` has been tested in real browser viewports (Dark & Light modes), produced real compiled files on disk, and passed automated CI test suites.

| Capability / Pillar | Status | Upgrades & Implementation Delivered | Real Evidence on Disk |
| :--- | :---: | :--- | :--- |
| **Phase F2: Chat UI (10/10)** | ✅ **COMPLETE** | Distraction-free conversational canvas, prose column capped at 65ch, semantic design tokens (no faint text in light mode), streaming markdown, model router, audio TTS. | `docs/PHASE_F2_CHAT_10_10_COMPLETE.md`<br>`screenshots/01_desktop_dark_empty.png`<br>`screenshots/02_desktop_light_empty.png` |
| **Live Interactive Animation Runner** | ✅ **COMPLETE** | Chat code blocks have `▶ Run Animation` button. In-browser sandboxed iframe renders 60 FPS Canvas/HTML/CSS animations with device switchers (`Desktop`/`Mobile`) and split-screen Canvas. | `frontend/components/chat/CodeBlock.jsx`<br>`animation_audit/04_verified_running_sphere.png`<br>`animation_audit/05_mobile_live_animation.png` |
| **P9: Multi-Agent Crew Studio** | ✅ **COMPLETE** | 4 collaborative agents (`Lead Architect`, `Full-Stack Coder`, `QA Engineer`, `Vision Reviewer`) working in real-time streaming consensus. | `frontend/components/agent/CrewStudio.jsx`<br>`agent_audit/04_agent_crew_dark.png`<br>`agent_audit/05_crew_run_streaming.png` |
| **P2: Copilot IDE & Monaco** | ✅ **COMPLETE** | Monaco code editor, Smart Diff engine, multi-device live preview (`Desktop`, `Tablet`, `Mobile`), file tree, terminal runner, error boundaries. | `frontend/components/views/CopilotIDE.jsx`<br>`copilot_audit/01_copilot_preview_dark.png`<br>`copilot_audit/02_copilot_preview_light.png` |
| **P3: Cross-Module Context Bridge** | ✅ **COMPLETE** | Clicking `IDE` on any Chat code block opens Copilot IDE, adds the file to active tabs, sets `Saved` state, and preserves user focus. | `frontend/components/views/CopilotIDE.jsx`<br>`bridge_audit/01_copilot_imported_snippet.png` |
| **P4: Document Engine (Office Suite)** | ✅ **COMPLETE** | Generates real office documents directly from natural language via Python and Node compilers: PDF, Word (DOCX), PowerPoint (PPTX), CSV, and Excel (XLSX). | `backend/routes/documents.js`<br>`frontend/public/downloads/*.docx`<br>`frontend/public/downloads/*.pdf` |
| **Resume Builder & CV Studio** | ✅ **COMPLETE** | 4 distinct typographic templates (`Editorial Classic`, `Technical Modern`, `Minimalist Clean`, `Creative Portfolio`), live A4 iframe preview, browser print, compiled PDF download. | `frontend/components/views/ResumeView.jsx`<br>`resume_audit/01_resume_dark.png`<br>`resume_audit/03_resume_creative_template.png`<br>`downloads/alex_morgan_resume_8efe7530.pdf` |
| **P5: Image Studio** | ✅ **COMPLETE** | Aspect ratio presets (`1:1 Square`, `16:9 Cinema`, `9:16 Mobile`, `4:3 Classic`), 4 curated inspiration cards, Pollinations AI backend forwarding. | `frontend/components/views/ImageView.jsx`<br>`image_audit/01_image_studio_dark.png`<br>`image_audit/03_image_generating_state.png` |
| **P6: Deep Research Agent Pipeline** | ✅ **COMPLETE** | Multi-source web queries, domain authority scoring (95/100 trust), consensus & contradiction detection, citations `[1]`, `[2]`, 1-click export to Word (`.docx`) and PDF. | `backend/services/researchService.js`<br>`frontend/components/views/ResearchView.jsx`<br>`research_audit/03_research_completed_with_sources.png`<br>`downloads/quantum_computing_breakthroughs_2026_res_1c2a7ecd.docx` |
| **P7: Persistent Project Workspace Graph** | ✅ **COMPLETE** | Full-stack project workspace graph connecting files, chats, generated office documents, research dossiers, context nodes & edges. Interactive Explorer with node CRUD, edge linking, and tabbed asset manager. | `backend/routes/projectGraph.js`<br>`backend/services/projectGraphService.js`<br>`frontend/components/views/ProjectsView.jsx`<br>`project_graph_audit/01_project_workspace_graph_dark.png` |
| **P8: Automated Workflows & Watchers** | ✅ **COMPLETE** | Autonomous background schedulers and reactive event watchers with multi-channel Telegram notifications, starter templates, and execution audit history. | `backend/services/workflowEngine.js`<br>`backend/routes/workflows.js`<br>`frontend/components/views/AutomationsView.jsx`<br>`automation_audit/01_automations_hub_dark.png` |
| **P0.2: Docker Sandbox Isolation** | ✅ **COMPLETE** | Hardened container constraints (1GB RAM cap, MemorySwap disabled, 1.0 CPU, PidsLimit 100 anti-fork-bomb, SecurityOpt no-new-privileges) + seamless Local Hardened Sandbox fallback with `_resolveSafe` traversal guard, command policy filtering, and 1-click self-test diagnostic telemetry. | `backend/sandbox/`<br>`frontend/components/views/SettingsView.jsx`<br>`sandbox_audit/01_sandbox_security_card_dark.png`<br>`sandbox_audit/02_sandbox_probe_passed_dark.png` |

### Engineering Quality Baseline (100% Pass)
- **Frontend Test Suite:** 121 / 121 passed across 23 test suites (`npm test -- --watchAll=false`).
- **Frontend Linter:** 0 errors, 0 warnings (`npm run lint`).
- **Backend Test Suite:** 79 / 79 passed across 6 test suites (`node --test tests/unit.test.js tests/integration.test.js`).

------------------------------------------------------------------------

# 1. North Star

## 1.1 Vision

Build an AI system where a user can state a goal in natural language and
AI-Dost can:

**Understand → Plan → Gather context → Decide → Execute → Verify →
Repair → Deliver → Remember**

across:

-   conversation
-   software engineering
-   files and documents
-   images and media
-   research
-   productivity
-   education
-   career workflows
-   business workflows
-   web tasks
-   automation
-   future external tools/devices

The long-term product is not a collection of AI buttons.

It is a **unified execution layer for human goals**.

------------------------------------------------------------------------

# 2. What We Are NOT Building

We are not trying to win by copying:

-   ChatGPT's UI
-   Copilot's UI
-   Cursor's UI
-   Canva's UI
-   Notion's UI
-   Resume builders
-   image generators
-   generic RAG chatbots

We may implement capabilities that those products have because users
expect them.

But copying features is **table stakes**, not our moat.

------------------------------------------------------------------------

# 3. Two Product Layers

## Layer A --- Expected Capabilities

These are capabilities users already expect from leading AI products.

Examples:

-   Chat
-   Web search/research
-   Code generation
-   Code editing
-   Terminal execution
-   File upload/read/write
-   Image generation/editing
-   PDF/document understanding
-   Resume generation
-   Presentation generation
-   Spreadsheet generation
-   Voice
-   Memory
-   Project/workspace context
-   Connectors
-   Automation
-   Multi-model support

These must become **reliable and competitive**.

## Layer B --- AI-Dost Differentiation

These are the areas where we should build a defensible product identity.

### A. One Goal → Many Capabilities

A user should not manually decide:

> "Now I need Chat, then Copilot, then Image, then PDF."

Instead:

> "Build my startup landing page, create the logo, write the
> documentation, generate the pitch deck, prepare the resume, deploy it
> and give me the final package."

AI-Dost should decide which internal modules/agents are required.

### B. Unified Context Graph

The same project should understand:

-   conversations
-   files
-   code
-   decisions
-   generated assets
-   research
-   user preferences
-   tasks
-   dependencies
-   previous failures
-   verification results

This becomes the platform's **context graph**.

### C. Goal-Based Autonomy

Move from:

**prompt → response**

to:

**goal → plan → execution graph → verification → result**

### D. Self-Verification

AI-Dost should increasingly verify its own work.

For software:

-   syntax
-   type checking
-   tests
-   dependency consistency
-   security
-   runtime behavior
-   UI behavior
-   build
-   deployment health

For documents:

-   structure
-   factual consistency
-   formatting
-   completeness
-   references

For images:

-   prompt adherence
-   dimensions
-   required elements
-   consistency

### E. Failure Recovery

A failed tool call must become:

**observe → diagnose → repair → retry → verify**

not:

**error → give up**

### F. User-Controlled Autonomy

Every action should have an autonomy level.

Example:

-   Suggest
-   Ask permission
-   Execute
-   Execute with limits
-   Fully autonomous

High-risk actions require stronger controls.

### G. Explainable Execution

The user should be able to inspect:

-   what AI-Dost planned
-   why it selected a tool
-   what changed
-   what was verified
-   what failed
-   what was repaired
-   what remains uncertain

The goal is not to expose hidden chain-of-thought.

The goal is to expose **useful execution evidence**.

------------------------------------------------------------------------

# 4. Platform Architecture

AI-Dost should eventually have these major layers:

``` text
                         AI-DOST
                            │
                    ┌───────┴───────┐
                    │   EXPERIENCE  │
                    └───────┬───────┘
                            │
       ┌────────────┬──────┼───────┬────────────┐
       │            │      │       │            │
      Chat       Copilot  Images  Research   Documents
       │            │      │       │            │
       └────────────┴──────┼───────┴────────────┘
                            │
                    UNIFIED AGENT CORE
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
     Planner            Executor            Verifier
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    CONTEXT / MEMORY
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          Project        Knowledge       User
           Graph           Graph         Memory
             │              │              │
             └──────────────┼──────────────┘
                            │
                  TOOL / CONNECTOR LAYER
                            │
      ┌─────────┬─────────┬─────────┬─────────┐
      │ Files   │ Browser │ Git     │ Terminal│
      └─────────┴─────────┴─────────┴─────────┘
                            │
                    SECURITY / POLICY
                            │
                 Sandbox • Permissions
                 Audit • Secrets • Limits
                            │
                    INFRASTRUCTURE
                            │
             Models • Queue • DB • Storage
             Observability • Deployment
```

------------------------------------------------------------------------

# 5. Current Phase --- What We Are Actually Working On

The current focus is **Platform Convergence & Cross-Module Context Unification**, moving from isolated features into a single, cohesive autonomous work system.

### Verified & Completed Platform Primitives:
- [x] **Smart Diff Engine & Safe Path Handling** (`backend/routes/agent.js`, traversal rejected)
- [x] **Phase F2 Chat UI (10/10)** (Clean editorial canvas, streaming markdown, bilingual cascades)
- [x] **Live Interactive Code Runner** (Inline 60 FPS HTML/CSS/Canvas/JS animation execution)
- [x] **Multi-Agent Crew Studio (P9)** (Architect, Coder, QA, Vision Reviewer collaborative streaming)
- [x] **Document Engine (P4)** (5 formats compiled to disk: PDF, DOCX, PPTX, CSV, XLSX)
- [x] **Resume & CV Studio** (4 typographic templates, live A4 iframe, browser print, compiled PDF)
- [x] **Image Studio (P5)** (Aspect ratios 1:1, 16:9, 9:16, 4:3, inspiration prompt cards)
- [x] **Deep Research Agent Pipeline (P6)** (Query decomposition, authority scoring, consensus/contradiction analysis, 1-click Word/PDF export)
- [x] **Cross-Module Import Bridge (P3)** (Chat code blocks open directly into Copilot active tabs)

### Active Work in Progress:
- [x] **P7: Persistent Project Workspace Graph** (Universal schema linking files, chats, tasks, images, and research under a single persistent project ID)
- [x] **P8: Automated Workflows & Background Watchers** (Scheduled recurring tasks & Telegram event notifications)
- [x] **P0.2: Docker Sandbox Isolation Hardening & Execution Guard** (Hardened container quotas, anti-fork limits, safe local fallback, command policy, and diagnostic health telemetry)

------------------------------------------------------------------------

# 6. Priority Order

## P0 --- Foundation Before Features

Do not add dozens of features until these are trustworthy.

### P0.1 Agent Runtime

Build a stable execution runtime:

-   state machine
-   planner
-   executor
-   tool registry
-   task graph
-   dependency graph
-   retries
-   timeouts
-   cancellation
-   locks
-   concurrency
-   checkpoints
-   resumability

### P0.2 Security

Mandatory:

-   sandbox isolation
-   path validation
-   secret protection
-   command policy
-   tool permissions
-   network permissions
-   resource limits
-   user approval gates
-   audit trail
-   prompt-injection defenses
-   malicious-file defenses

### P0.3 Verification

Every important action should have a verifier.

### P0.4 Observability

Track:

-   task latency
-   model cost
-   tool failures
-   retries
-   repair rate
-   success rate
-   token usage
-   sandbox failures
-   hallucinated actions
-   user cancellation
-   verification failures

------------------------------------------------------------------------

# 7. P1 --- Make the Core Agent Excellent

Before expanding product surface area, make the agent dependable.

### Engineering loop

``` text
Understand
   ↓
Inspect
   ↓
Plan
   ↓
Execute
   ↓
Observe
   ↓
Verify
   ↓
Diagnose
   ↓
Repair
   ↓
Verify again
   ↓
Checkpoint
```

Requirements:

-   deterministic tool contracts
-   structured actions
-   robust parsing
-   dependency-aware execution
-   safe parallelism
-   rollback strategy
-   checkpoint/recovery
-   long-running task support
-   cancellation
-   progress reporting

------------------------------------------------------------------------

# 8. P2 --- Copilot / Software Engineering

Copilot is an important vertical, but it is not the whole company.

Target capability:

> One prompt → understand repository → plan → edit many files → run
> tools → test → repair → preview → deliver.

Build in this order:

1.  Repository indexing
2.  Context retrieval
3.  Dependency graph
4.  Smart diff
5.  Diagnostics
6.  LSP adapters
7.  Test runner
8.  Build runner
9.  Runtime verification
10. Git integration
11. PR generation
12. Preview/dev server
13. Deployment
14. Multi-agent coding
15. Background coding tasks

### Long-term target

A user can say:

> "Add authentication to this application."

AI-Dost should autonomously:

-   inspect architecture
-   identify relevant files
-   plan changes
-   implement
-   run tests
-   fix errors
-   update docs
-   update environment configuration safely
-   run security checks
-   start preview
-   verify flows
-   produce a change report

------------------------------------------------------------------------

# 9. P3 --- Unified Chat

Chat must become the **front door to the platform**, not a separate
product.

From Chat the user should be able to transition into:

-   coding
-   research
-   documents
-   image generation
-   automation
-   project management
-   browser tasks

without losing context.

Example:

> "Research my competitors."

Then:

> "Turn this into a market report."

Then:

> "Make a pitch deck."

Then:

> "Create a landing page."

Then:

> "Deploy it."

One continuous project context.

------------------------------------------------------------------------

# 10. P4 --- Documents & Knowledge

Build a serious document workspace:

-   PDF
-   DOCX
-   PPTX
-   XLSX
-   Markdown
-   text
-   structured data

Capabilities:

-   read
-   create
-   edit
-   compare
-   summarize
-   extract
-   transform
-   cite
-   cross-reference

### Verification Status (September 2026):
- [x] **5 Core Formats Generated:** Direct disk compilation of `PDF` (python reportlab/markdown), `DOCX` (docx compiler), `PPTX` (pptxgenjs v4), `CSV` (with UTF-8 BOM), and `XLSX` (openpyxl).
- [x] **Chat Intent Triggering:** Automatic document compilation from conversational prompts (e.g., *"sales report excel me banao"* → `.xlsx`, *"bihar report pdf me"* → `.pdf`).
- [x] **Resume Studio Rebuild:** 4 distinct typographic templates (`Editorial Classic`, `Technical Modern`, `Minimalist Clean`, `Creative Portfolio`), live dynamic A4 iframe preview, print-to-PDF, and compiled PDF download.

Long-term:

**Document Agent**

can maintain a living knowledge base for a project.

------------------------------------------------------------------------

# 11. P5 --- Image & Media

Image capabilities should integrate with projects.

### Verification Status (September 2026):
- [x] **Multi-Aspect Ratio Studio:** Aspect ratio presets (`1:1 Square`, `16:9 Cinema`, `9:16 Mobile`, `4:3 Classic`) wired to backend Pollinations AI with custom dimensions.
- [x] **Curated Quick Prompts:** 4 inspiration cards in empty state for 1-click generation.
- [x] **Semantic Theming:** Verified in Dark and Light themes with real screenshots.

Not:

> "Generate an image."

But:

> "Create all visual assets needed for my product."

This could include:

-   logo
-   icons
-   UI illustrations
-   marketing images
-   social creatives
-   presentation visuals
-   thumbnails
-   diagrams

Later:

-   video
-   audio
-   voice
-   animation
-   multimodal project assets

------------------------------------------------------------------------

# 12. P6 --- Research Agent

Research should evolve from search into evidence-driven work.

Pipeline:

``` text
Question
 ↓
Search
 ↓
Source discovery
 ↓
Source quality evaluation
 ↓
Extraction
 ↓
Cross-source comparison
 ↓
Contradiction detection
 ↓
Synthesis
 ↓
Citation
 ↓
Deliverable
```

### Verification Status (September 2026):
- [x] **Core Pipeline Implemented:** `backend/services/researchService.js` conducts multi-source query decomposition, domain authority ranking (95/100), contradiction detection, and citation synthesis `[1]`, `[2]`.
- [x] **1-Click Official Deliverables:** `backend/routes/research.js` compiles research findings directly into Word (`.docx`) and PDF (`.pdf`) saved to `frontend/public/downloads/`.
- [x] **Frontend UI Canvas:** `frontend/components/views/ResearchView.jsx` provides depth controls, real-time stage progression, evidence cards, and 1-click export toolbar.

Future:

-   persistent research projects
-   source graph
-   evidence graph
-   automatic updates
-   research monitoring
-   domain-specific research agents

------------------------------------------------------------------------

# 13. P7 --- Personal & Professional Workspace

Introduce persistent projects.

Each project contains:

-   files
-   chats
-   tasks
-   research
-   decisions
-   assets
-   agents
-   automations
-   permissions
-   history
-   deployment state

A project becomes an **AI-native workspace**.

------------------------------------------------------------------------

# 14. P8 --- Automation

Users should be able to define:

> "Whenever X happens, do Y, verify Z, and notify me."

Examples:

-   monitor GitHub
-   monitor research
-   summarize emails
-   update reports
-   watch deployments
-   monitor competitors
-   maintain project documentation
-   generate recurring analytics

Must include:

-   scheduling
-   triggers
-   retries
-   permissions
-   audit
-   budgets
-   failure recovery

------------------------------------------------------------------------

# 15. P9 --- Multi-Agent System

Only after the single-agent runtime is reliable.

Specialized agents:

-   Planner
-   Coder
-   Researcher
-   Designer
-   Tester
-   Security reviewer
-   Documentation agent
-   Deployment agent
-   Data analyst
-   Career agent

They operate through the same shared project/context system.

Important:

**Do not create multi-agent complexity just for marketing.**

Use multiple agents when specialization actually improves reliability.

------------------------------------------------------------------------

# 16. P10 --- Model Router

AI-Dost should not become dependent on one model.

Build a model abstraction layer:

``` text
User Goal
   ↓
Task Classification
   ↓
Model Router
   ├── reasoning model
   ├── coding model
   ├── vision model
   ├── image model
   ├── fast model
   └── local/private model
```

Routing criteria:

-   quality
-   latency
-   cost
-   privacy
-   context size
-   task type
-   availability

This reduces vendor lock-in.

------------------------------------------------------------------------

# 17. P11 --- Private / Local AI

Long-term:

-   local models
-   private deployments
-   enterprise isolation
-   encrypted project storage
-   on-device inference where practical
-   BYOK
-   self-hosting

AI-Dost should eventually support:

**Cloud / Hybrid / Local**

as architectural modes.

------------------------------------------------------------------------

# 18. P12 --- AI-Dost Marketplace / Skills

Later, allow reusable capabilities:

-   skills
-   agents
-   workflows
-   connectors
-   templates
-   domain packs

But maintain strong security and signing.

A skill should declare:

-   permissions
-   tools
-   network access
-   data requirements
-   cost
-   expected outputs

------------------------------------------------------------------------

# 19. The 5--10 Year Roadmap

## Phase 0 --- 2026: Foundation

Primary goal:

**Make the core trustworthy.**

Focus:

-   agent runtime
-   security
-   sandbox
-   context
-   dependency graph
-   diagnostics
-   concurrency
-   verification
-   observability
-   testing

Do not chase feature count.

------------------------------------------------------------------------

## Phase 1 --- 2026--2027: Reliable AI Workbench

Build:

-   excellent Chat
-   excellent Copilot
-   documents
-   research
-   images
-   project workspaces
-   model routing
-   Git integration
-   preview/dev server
-   deployment workflows

Goal:

> A serious developer/student/creator can use AI-Dost for real work.

------------------------------------------------------------------------

## Phase 2 --- 2027--2028: Autonomous Workflows

Build:

-   long-running tasks
-   background agents
-   automation
-   persistent memory
-   project graphs
-   multi-step workflows
-   multi-agent execution
-   scheduled tasks
-   browser automation

Goal:

> AI-Dost can finish meaningful jobs, not just answer questions.

------------------------------------------------------------------------

## Phase 3 --- 2028--2030: AI Operating Layer

AI-Dost becomes a cross-application work layer.

Potential integrations:

-   GitHub
-   Google Workspace
-   Microsoft 365
-   Slack
-   Notion
-   cloud providers
-   databases
-   developer environments
-   business systems

Goal:

> The user gives AI-Dost outcomes, not individual instructions.

------------------------------------------------------------------------

## Phase 4 --- 2030--2032: Personal AI Infrastructure

Focus:

-   persistent personal context
-   user-owned memory
-   local/private execution
-   personal knowledge graph
-   proactive assistance
-   lifelong project continuity
-   multimodal interaction

Goal:

> AI-Dost becomes a user's long-term AI operating companion.

------------------------------------------------------------------------

## Phase 5 --- 2032--2036: Autonomous Work Platform

Potential direction:

-   autonomous software teams
-   autonomous research teams
-   autonomous business workflows
-   agent marketplaces
-   domain-specific AI organizations
-   self-maintaining software projects
-   cross-device agents
-   physical-world integrations where safe and appropriate

Goal:

> AI-Dost evolves from an AI application into an AI work platform.

These later phases are strategic hypotheses, not promises. Re-evaluate
them as technology, economics, regulation, and user behavior change.

------------------------------------------------------------------------

# 20. What Everyone Will Do vs What We Should Own

## Table Stakes

Expect competitors to have:

-   chat
-   coding
-   image generation
-   web search
-   file analysis
-   memory
-   agents
-   connectors
-   automation

We must match the category, but not define our identity around it.

## Potential AI-Dost Moats

### 1. Goal Continuity

A user's goal survives across:

-   chat
-   code
-   files
-   images
-   research
-   deployment
-   automation

### 2. Project Intelligence

AI-Dost understands the entire project rather than isolated files.

### 3. Execution Reliability

Measure and optimize:

**Goal completion rate**, not message quality alone.

### 4. Verification-First Architecture

AI-Dost should know:

> "I did it."

versus:

> "I think I did it."

### 5. Recovery-First Architecture

Failure becomes part of the execution protocol.

### 6. User-Owned Context

The user should understand and control what AI-Dost knows.

### 7. Cross-Modal Workflows

Text → code → image → document → deployment → monitoring.

### 8. Adaptive Autonomy

AI-Dost learns how much autonomy the user wants without silently
increasing privileges.

### 9. Evidence-Based Execution

Important results should have evidence:

-   files changed
-   tests passed
-   sources used
-   deployments verified
-   artifacts created

### 10. Universal Work Graph

Long-term differentiator:

``` text
User
 │
 ├── Goals
 ├── Projects
 ├── People
 ├── Files
 ├── Code
 ├── Research
 ├── Decisions
 ├── Tasks
 ├── Agents
 ├── Automations
 └── Results
```

This graph becomes the connective tissue of AI-Dost.

------------------------------------------------------------------------

# 21. Product Architecture Rule

Every new feature should plug into the same primitives.

Required shared services:

-   Identity
-   Projects
-   Context
-   Memory
-   Files
-   Tools
-   Agents
-   Permissions
-   Sandbox
-   Model Router
-   Execution Runtime
-   Verification
-   Audit
-   Billing
-   Observability

Avoid separate implementations for each module.

------------------------------------------------------------------------

# 22. Engineering Quality Gates

A feature cannot be considered "done" merely because the UI works.

Every production feature must pass:

### Functional

-   unit tests
-   integration tests
-   end-to-end tests

### Reliability

-   retry
-   timeout
-   cancellation
-   recovery
-   idempotency

### Security

-   path traversal
-   secret leakage
-   command injection
-   prompt injection
-   privilege escalation
-   sandbox escape
-   malicious files

### Performance

-   latency
-   concurrency
-   memory
-   CPU
-   token usage
-   cost

### Observability

-   structured logs
-   metrics
-   tracing
-   error reporting

### UX

-   progress
-   understandable failures
-   user control
-   undo/rollback where appropriate

------------------------------------------------------------------------

# 23. Product Development Rule

Use this order:

``` text
Problem
 ↓
User workflow
 ↓
Architecture
 ↓
Security model
 ↓
Prototype
 ↓
Tests
 ↓
Implementation
 ↓
Verification
 ↓
UX
 ↓
Observability
 ↓
Production
 ↓
Metrics
 ↓
Optimization
```

Never:

``` text
Cool idea
 ↓
Build UI
 ↓
Hope it works
```

------------------------------------------------------------------------

# 24. Anti-Drift System for Antigravity

Antigravity must maintain these files in the repository:

``` text
/docs/
  AI_DOST_MASTER_GOAL.md
  PRODUCT_ROADMAP.md
  ARCHITECTURE.md
  SECURITY_MODEL.md
  AGENT_RUNTIME.md
  DECISION_LOG.md
  CURRENT_PHASE.md
  FEATURE_REGISTRY.md
  TECH_DEBT.md
```

## Mandatory rule

Before implementing a major feature, Antigravity must:

1.  Read `AI_DOST_MASTER_GOAL.md`
2.  Read `CURRENT_PHASE.md`
3.  Read relevant architecture documentation
4.  State which roadmap objective the work supports
5.  Define acceptance criteria
6.  Implement
7.  Test
8.  Update documentation
9.  Update `CURRENT_PHASE.md` if the phase changed

If a requested feature does not fit the roadmap:

> **STOP and ask for a product decision.**

Do not silently change the product direction.

------------------------------------------------------------------------

# 25. Master Goal File --- Required Content

`AI_DOST_MASTER_GOAL.md` must always contain:

-   product vision
-   current product definition
-   current phase
-   current priorities
-   non-goals
-   architecture principles
-   security principles
-   roadmap
-   active milestones
-   definition of done
-   known technical debt
-   major decisions
-   deferred ideas

This file is the project's **North Star**.

------------------------------------------------------------------------

# 26. Decision Log

Every major architecture decision should record:

``` text
Decision:
Why:
Alternatives:
Chosen approach:
Trade-offs:
Date:
Future revisit condition:
```

This prevents the team from repeatedly reconsidering old decisions.

------------------------------------------------------------------------

# 27. Feature Registry

Every feature gets:

``` text
Feature:
Module:
User problem:
Priority:
Dependencies:
Security impact:
Status:
Owner:
Tests:
Production status:
Metrics:
Future improvements:
```

Possible status:

-   IDEA
-   PLANNED
-   BUILDING
-   TESTING
-   BETA
-   PRODUCTION
-   DEPRECATED

------------------------------------------------------------------------

# 28. Current Priority Stack

Unless explicitly changed by a documented product decision:

1.  **Agent core reliability**
2.  **Security + sandbox**
3.  **Context + project intelligence**
4.  **Verification + diagnostics**
5.  **Copilot**
6.  **Chat as unified entry point**
7.  **Documents**
8.  **Research**
9.  **Images/media**
10. **Workspace + persistent memory**
11. **Automation**
12. **Multi-agent**
13. **Model routing**
14. **Integrations**
15. **Local/private AI**
16. **Marketplace/skills**
17. **Long-term autonomous platform**

This order can change only after reviewing dependencies and product
metrics.

------------------------------------------------------------------------

# 29. Metrics That Matter

Do not optimize only:

-   users
-   messages
-   tokens
-   generation speed

Track:

### Agent

-   goal completion rate
-   first-pass success
-   repair success
-   task abandonment
-   tool failure rate
-   verification pass rate

### Coding

-   build success rate
-   test pass rate
-   regression rate
-   successful autonomous changes
-   rollback rate

### Product

-   weekly retained users
-   projects created
-   tasks completed
-   time saved
-   repeat workflows
-   cross-module usage

### Economics

-   cost per successful task
-   gross margin
-   model cost
-   storage cost
-   compute cost

### Trust

-   unsafe action rate
-   security incidents
-   permission violations
-   false completion rate

------------------------------------------------------------------------

# 30. The Ultimate Product Loop

The final architecture should move toward:

``` text
USER GOAL
   ↓
UNDERSTAND
   ↓
BUILD CONTEXT
   ↓
PLAN
   ↓
EXECUTION GRAPH
   ↓
PARALLEL / SEQUENTIAL AGENTS
   ↓
TOOLS + SANDBOX
   ↓
OBSERVE
   ↓
VERIFY
   ↓
REPAIR
   ↓
VERIFY
   ↓
DELIVER
   ↓
REMEMBER
   ↓
IMPROVE
```

The user should increasingly feel:

> "I gave AI-Dost the job."

rather than:

> "I gave AI-Dost instructions every few seconds."

------------------------------------------------------------------------

# 31. The 10-Year Strategic Principle

Technology will change.

Models will change.

Interfaces will change.

Competitors will change.

Therefore:

**Do not make the model the moat.**

Build the moat around:

-   execution infrastructure
-   context
-   project intelligence
-   reliability
-   security
-   verification
-   user trust
-   integrations
-   workflows
-   accumulated user/project knowledge
-   excellent product experience

------------------------------------------------------------------------

# 32. Antigravity Master Instruction

Paste/save the following as the operating instruction for future
development:

> You are working on AI-Dost.
>
> AI-Dost is an autonomous AI work platform. Copilot is only one module
> of AI-Dost.
>
> Before implementing a major change, read
> `docs/AI_DOST_MASTER_GOAL.md`, `docs/CURRENT_PHASE.md`, and the
> relevant architecture documents.
>
> Do not optimize for feature count. Optimize for reliable goal
> completion.
>
> Do not create isolated subsystems when an existing platform primitive
> should be reused.
>
> Preserve shared identity, project context, memory, files, permissions,
> tools, sandboxing, execution, verification, and audit infrastructure.
>
> Every major implementation must include: - architecture review -
> security review - acceptance criteria - tests - failure handling -
> observability - documentation update
>
> Never silently change the product direction.
>
> If a requested feature conflicts with the master roadmap, stop and ask
> for a product decision.
>
> At the end of each phase, update the roadmap and current-phase
> documents.
>
> The long-term objective is:
>
> **Understand → Plan → Execute → Verify → Repair → Deliver → Remember**
>
> across coding, chat, research, documents, images, automation, and
> future capabilities.
>
> Build AI-Dost as one coherent platform, not a collection of unrelated
> AI tools.

------------------------------------------------------------------------

# 33. Immediate Next Step

Do **not** start another random feature.

First:

1.  Freeze the current architecture snapshot.
2.  Create the `/docs` governance files.
3.  Put this document into `docs/AI_DOST_MASTER_GOAL.md`.
4.  Create `CURRENT_PHASE.md`.
5.  Audit the repository against this roadmap.
6.  Build a feature registry of every current module.
7.  Mark each module:
    -   working
    -   broken
    -   incomplete
    -   duplicated
    -   insecure
    -   untested
    -   production-ready
8.  Create the next 30/60/90-day engineering plan.
9.  Only then resume implementation.

------------------------------------------------------------------------

# 34. Final Rule

When in doubt, ask:

> **"Are we building another feature, or are we building AI-Dost?"**

If the work does not make AI-Dost:

-   more capable,
-   more reliable,
-   more secure,
-   more autonomous,
-   more coherent,
-   or more valuable,

it should probably not be the next priority.

------------------------------------------------------------------------

**End of Master Plan**
