# Forge Studio — System Architecture & Design Specification

## 1. Executive Overview

**Forge Studio** is an autonomous, full-stack AI development platform and copilot designed to rival tools like Devin, Bolt.new, Lovable, v0, and Replit. It enables users to express software outcomes in natural language and coordinates specialized AI agents to generate, test, repair, and preview complete web applications in real time.

---

## 2. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Forge Studio UI Layer                          │
│   (Next.js 16 + React 18 + Tailwind / CSS Glassmorphism + Lucide/FA)   │
└─────────────────────────────────▲──────────────────────────────────────┘
                                  │ HTTP / SSE Stream
                                  │ (event-stream, : ping heartbeat)
┌─────────────────────────────────▼──────────────────────────────────────┐
│                    Copilot Director & Coordinator                      │
│            (CopilotDirector.js / copilotDirectorHandler.js)             │
│   - Code-First Rule Engine (Immediate Code Delivery, No Docs Only)     │
│   - Capability Discovery & Gatekeeper Approval Token                   │
│   - Adaptive Specialist Multi-Task Breakdown                           │
└──────────────┬──────────────────────────────┬──────────────────────────┘
               │                              │
      ┌────────▼────────┐            ┌────────▼────────┐
      │ Supervisor Run  │            │ Multi-Model AI  │
      │ (Supervisor.js) │            │ Cascade Engine  │
      └────────┬────────┘            │ (AgentCascade)  │
               │                     └────────┬────────┘
     ┌─────────┴───────────────┐              │
     │ Specialized Sub-Agents  │◄─────────────┘
     │ - CODER (Frontend/App)  │
     │ - RESEARCHER (Context)  │
     │ - VERIFIER (Runtime QA) │
     └─────────┬───────────────┘
               │
┌──────────────▼─────────────────────────────────────────────────────────┐
│              Surgical Diff Engine & Workspace Manager                  │
│   - read_file + apply_diff (Verbatim SEARCH/REPLACE)                   │
│   - Workspace Files Persistence (app.db SQLite / Temp Workspace)       │
│   - Sandboxed Execution & Live In-Browser Babel Preview                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Subsystems

### 3.1. Autonomous Director & Multi-Agent Coordinator
- **Director (`CopilotDirector.js`)**: Converts single-prompt user goals into an optimized Directed Acyclic Graph (DAG) of specialist tasks.
- **Supervisor (`Supervisor.js`)**: Tracks task delegation, state transitions (`PENDING` -> `DELEGATING` -> `RUNNING` -> `SUCCEEDED` / `FAILED`), and coordinates handoffs.
- **Specialists**:
  - `CODER`: Primary implementation specialist targeting `src/App.jsx`, `src/index.css`, `index.html`.
  - `RESEARCHER`: Workspace context indexing and analysis.
  - `VERIFIER`: Read-only build and test verification gate.

### 3.2. Code-First Rule Guarantee
- **Strict Anti-Stagnation Rule**: Eliminates the common AI trap where agents write `docs/architecture.md` and finish without generating runnable code.
- **Direct Code Generation**: Prompts specifically instruct models that user requests for apps, websites, portfolios, or features MUST write working code directly.

### 3.3. Real-Time Streaming & Keep-Alive Protocol
- Uses HTTP Server-Sent Events (SSE) with `X-Accel-Buffering: no`.
- Emits `: ping\n\n` comments every 10 seconds to ensure intermediate proxy layers (Next.js rewrites, reverse proxies) do not drop connections during long LLM inferences.
- Supports fine-grained activity telemetry:
  - `director_plan`: Task graph and objectives.
  - `director_task`: Specialist assignment and status.
  - `thinking`: Agent reasoning and analysis steps.
  - `step`: Individual tool executions (`read_file`, `write_file`, `apply_diff`).
  - `director_file_diff`: Real-time file additions and modifications with line counts.
  - `director_verification`: Pre-commit QA and health validation.
  - `director_complete`: Final success message and files written summary.

### 3.4. Dual Preview Engine
- **In-Browser Babel Transformer**: Compiles modern JSX/TSX and Tailwind CSS in real time using an isolated sandboxed iframe. Injects API mock fallbacks, Lucide icons, and Font Awesome stubs.
- **Isolated Sandbox Dev Server**: Starts containerized Node/Vite dev servers on dedicated ports (`devServerManager`) with live HMR websocket reverse proxying.

---

## 4. Security & Gatekeeping
- **Capability Discovery**: Detects potentially sensitive actions (file deletions, terminal commands, network access).
- **Capability Gatekeeper**:
  - `Auto`: Executes safe edits within workspace bounds automatically.
  - `Ask`: Emits an approval token and pauses execution until user approval is confirmed via UI banner.
  - `Turbo`: High-speed execution with relaxed prompt pauses.
