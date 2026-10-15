# 🚀 Forge Studio — Autonomous AI Full-Stack Copilot

**Forge Studio** is a next-generation autonomous software development studio and AI copilot inspired by Devin, Bolt.new, Lovable, v0, and Replit. It enables natural language prompting to autonomously plan, code, diff, test, and render full-stack web applications.

---

## 🌟 Key Features

1. **Autonomous Multi-Agent Director**:
   - Deconstructs complex requests into dependency-ordered specialist tasks (`CODER`, `RESEARCHER`, `VERIFIER`).
   - Strictly enforces **Code-First Execution** to deliver real working code files (`src/App.jsx`, `index.html`) without stalling at markdown specifications.

2. **Real-Time Streaming Telemetry (Devin / Replit Style)**:
   - High-fidelity SSE streams showing active specialist badges, live action logs (reading, writing, analyzing), and real-time elapsed timers.
   - 10-second heartbeat keep-alive prevents socket timeouts during long LLM reasoning chains.

3. **Surgical Diff & Anti-Corruption Engine**:
   - Uses exact `SEARCH` / `REPLACE` diffing so existing code is never blindly wiped or lost.
   - Automated self-healing loop (up to 3 repair iterations) fixes syntax errors, missing brackets, or bad imports before completion.

4. **Instant Dual Preview**:
   - **In-Browser Babel Transformer**: Compiles React 18, Tailwind CSS, Lucide icons, and Font Awesome in an isolated sandbox iframe with zero lag.
   - **Containerized Dev Server**: Automatically provisions and manages dedicated Vite/Node dev servers with HMR reverse proxying.

5. **Multi-Model Resilient Cascade**:
   - Primary: Fast Groq & Gemini 2.5.
   - Fallback tiers: NVIDIA NIM, DeepSeek, Mistral, Together AI, OpenRouter, and local Ollama (`qwen2.5-coder:7b`).

---

## 📂 Project Organization

```
forge-studio/
├── frontend/         # React 18 UI components, styles, in-browser compiler, Jest tests
├── backend/          # Copilot Director, Coordinator, Supervisor, TaskPlanner, SSE stream
├── agent-platform/   # MCP registry, domain skills, evaluation rubrics, provider matrix
├── architecture/     # Complete system architecture, execution plan, and API contracts
└── docs/             # Developer contributor guide and troubleshooting manuals
```

---

## 🚦 Quick Start

### 1. Start AI Dost Backend
```powershell
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
node server.js
# Runs on: http://localhost:5000
```

### 2. Start Frontend
```powershell
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm run dev
# Runs on: http://localhost:3000
```

### 3. Open Forge Studio
Navigate to `http://localhost:3000` to interact with Forge Studio in the AI-Dost interface!
