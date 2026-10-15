# Forge Studio — Developer & Contributor Guide

## 1. Directory Structure

```
forge-studio/
├── frontend/                     # UI components, styles, in-browser compiler
│   ├── components/
│   │   ├── ForgeCopilot.jsx      # Core Autonomous Studio component
│   │   └── forgePlatformData.js  # Providers, templates, and presets
│   ├── src/
│   │   ├── main.jsx              # Standalone Forge platform entry
│   │   └── styles.css            # Dark glassmorphism stylesheet
│   ├── tests/
│   │   └── forgeCopilot.test.jsx # Complete Jest unit test suite
│   ├── index.html                # Standalone preview shell
│   └── package.json              # Frontend dependencies
├── backend/                      # Autonomous director runtime & cascade AI
│   └── runtime/
│       ├── CopilotDirector.js    # Multi-agent Director & DAG planner
│       ├── copilotDirectorHandler.js # SSE streaming endpoint handler
│       ├── AgentCoordinator.js   # Supervisor & worker task delegation
│       ├── Supervisor.js         # Supervisor run lifecycle state machine
│       ├── structuredAgentPlanner.js # Low-level JSON plan prompt & parser
│       ├── TaskPlanner.js        # Step sanitization & verification filters
│       ├── PlannerExecutionLoop.js   # Step-by-step runner with self-healing
│       ├── AgentCascadeAiService.js  # Resilient multi-provider cascade
│       ├── createChatTaskGateway.js  # Runtime factory gateway
│       ├── resultValidator.js    # Evidence output validator
│       └── CopilotDirector.test.js   # Node.js backend unit tests
├── agent-platform/               # MCP tools, skills, evals, and support matrix
│   ├── evals/                    # Test cases and quality rubrics
│   ├── mcps/                     # Admin-managed and pending MCP configs
│   ├── providers/                # Model support matrix and latency profiles
│   └── skills/                   # Bundled domain skills (fullstack, UI, etc.)
├── architecture/                 # Architecture, execution plans & API specs
│   ├── ARCHITECTURE.md           # System design & component diagrams
│   ├── EXECUTION_PLAN.md         # Autonomous lifecycle & self-healing loop
│   └── API_CONTRACTS.md          # SSE event schema & REST endpoints
├── docs/                         # Developer manuals & troubleshooting
│   └── DEVELOPER_GUIDE.md        # This guide
└── README.md                     # Root overview and quick-start guide
```

---

## 2. Integration with AI-Dost Workspace

Forge Studio is fully wired into AI-Dost:
- **Frontend Mount**: Mounted in `frontend/pages/` or as the dedicated Copilot view in `frontend/components/views/CopilotIDE.jsx`.
- **Backend Mount**: Handled by `backend/routes/agent.js` and `backend/agent/runtime/copilotDirectorHandler.js`.
- **Preview System**: Reads from `backend/data/app.db` and compiles dynamically via `frontend/components/ide/PreviewEngine.js`.

---

## 3. Running Tests

### Frontend Jest Tests
```powershell
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm test -- tests/forgeCopilot.test.jsx
```

### Backend Node.js Tests
```powershell
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
node --test agent/runtime/CopilotDirector.test.js
```
