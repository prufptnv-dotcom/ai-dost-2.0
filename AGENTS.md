# AI-Dost v2.0 - Agent Operations Guide

## 🚀 Quick Start

```powershell
# 1. Start Backend Server
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
node server.js
# Server runs on: http://localhost:5000

# 2. Start Frontend (Next.js 16 + Turbopack)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm run dev
# Frontend runs on: http://localhost:3000 (verified — NOT 3001)
# /api/* rewrites proxy to backend :5000 (chat, agent, sandbox, figma, deploy, document, eval, ...)

# 3. Start Python AI Engine (LlamaIndex RAG, optional)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\ai-engine"
start_ai_engine.bat
# AI Engine runs on: http://127.0.0.1:8001
# Node backend auto-falls back if engine is down
```

## 📋 Setup Checklist

### Free API Configuration
1. **Gemini API Key** (Required):
   - Get key from: https://makersuite.google.com/app
   - Add to: `.env` file as `GEMINI_API_KEY=your_key_here`
   - Free tier: 1500 requests/day

2. **Ollama Local Model** (Optional, 16GB+ RAM recommended):
   - Install: https://ollama.com
   - Pull model: `ollama pull qwen2.5-coder:7b`
   - Start: `ollama serve`
   - Configure: `.env` `OLLAMA_MODEL=qwen2.5-coder:7b`

3. **Tavily Search** (Optional, for agent research):
   - Get key from: https://tavily.com
   - Add to `.env`: `TAVILY_API_KEY=your_key_here`
   - Free tier: 1000 searches/month
   - **Required for**: `/research` Telegram command, web search with sources

4. **Cerebras Inference** (Optional, was free 1M tokens/day — 2026 me card verify required):
   - Get key from: https://cloud.cerebras.ai → API Keys
   - Add to `.env`: `CEREBRAS_API_KEY=your_key_here`
   - Note: Free tier ab card verification mangta hai ($5 free credits, no charge unless purchased)
   - Models: `gpt-oss-120b`, `zai-glm-4.7` (llama3.1-8b/llama-3.3-70b deprecate ho chuke)
   - Wired in: chat cascade + crew (`model=cerebras`) — ready, key activate hote hi chalega

5. **Edge TTS (FREE unlimited voice, no key)**:
   - AI replies sunne ke liye — ChatView me Volume2 button
   - Backend: `POST /api/agent/ai/tts` → ai-engine `/ai/tts` (edge-tts, venv me installed)
   - Hindi voice: `hi-IN-SwaraNeural`, English: `en-IN-PrabhatNeural`

6. **OpenRouter free models** (2026 — purane free models hat chuke):
   - Verified working: `openai/gpt-oss-20b:free` (primary)
   - Fallbacks: `cohere/north-mini-code:free`, `z-ai/glm-5.2:free`, `google/gemma-4-31b-it:free`, `liquid/lfm-2.5-2.6b:free`
   - Free models flaky hote hain (temporary 429/503/empty) — service auto-fallback karta hai

7. **Telegram Bot** (100% free, phone se AI-Dost control):
   - Token: @BotFather → `/newbot` → `TELEGRAM_BOT_TOKEN` in `.env`
   - Optional: `TELEGRAM_ALLOWED_IDS=123,456` (sirf in chat IDs ko allow karo; khali = sab)
   - Long polling (no webhook) — local dev me bhi chalta hai, koi port nahi chahiye
   - Commands: `/chat <msg>`, `/crew <task>`, `/tts <text>`, `/image <desc>`, `/status`, `/help` (plain text = chat)
   - **New commands**: `/doc <pdf|docx|pptx|csv|xlsx> <topic>`, `/research <query>`, `/correct <correction>`
   - Code: `backend/services/telegramBot.js` — native fetch (koi dependency nahi)
   - Server start pe auto-enable hoga agar token set hai

8. **Chat Image Generation**:
   - User: "image banao: ..." → `POST /api/image/generate` (Pollinations, free no key, 30-60s render)
   - AI reply me `[GENERATE_IMAGE: prompt]` tag aaye → ChatView auto-convert karke Pollinations URL se image card dikhata hai

9. **Document Engine (MS Office via chat)**:
   - `POST /api/document/generate` `{type: docx|pptx|csv|pdf|xlsx, topic, title}` → files `frontend/public/downloads/` me save, `/downloads/` se serve
   - Flow: LLM (cascade, 2 attempts) content → build file (docx / pptxgenjs v4 / CSV with BOM / pdf via python / xlsx via openpyxl) → download URL return
   - **Keyword matching (not intent-pairs)**: input me format keyword aaya → wahi file. `pdf`→PDF, `excel|xlsx`→XLSX, `csv|spreadsheet|sheet`→CSV, `ppt|presentation|slides`→PPTX, `doc|word|report|document`→DOCX. Specific format (pdf/csv/ppt/xlsx) hamesha generic (report/document) pe jeeta — "report pdf me chahiye" → pdf. Koi action word (banao) zaroori nahi
   - **Template fallback**: saare AI providers fail ho to 500 NAHI — `templateContent(type, topic)` se file ban jaati hai
   - Chat intents: "bihar research karo doc banao" → docx, "15 august presentation banao" → pptx, "shaheed jawan list csv/excel me" → csv, "sales data xlsx me" → xlsx
   - Code: `backend/routes/documents.js`; ChatView `DOC_KEYWORDS` (line ~38)
   - pptxgenjs v4 API: `writeFile({ fileName })` — capital N! (`filename` silently ignored, `nodebuffer` outputType unsupported)
   - PDF via existing `/api/pdf/generate` (python pdfGenerator.py), Noto Hindi font
   - XLSX via ai-engine `/ai/xlsx/generate` (openpyxl, styled headers, smart columns)
   - Files git-ignored (generated)

### Environment Files
- `.env.example` created with all required variables
- Copy `.env.example` → `.env` and fill in your keys
- Restart server after changing `.env`

## 🎯 Feature Overview

### 1. Gemini-Style Sidebar
- **Collapse/Expand**: Click sidebar arrow or press `Ctrl+Shift+S`
- **Icon-Only Mode**: 72px wide with essential icons
- **Full Mode**: 280px with text labels and spring animation
- **Persistence**: Remembers your preference via localStorage

### 2. Deep-Thinking Chat Animations
- **ThinkingIndicator**: Spinning pulse SVG with "Deep analysing..." text
- **ThinkingPulse**: Breathing animation during AI response generation
- **State Management**: `isThinking` flag shows/hides during chat send
- **Location**: AICompanion.jsx chat input area

### 3. Perplexity-Style Voice Assistant
- **Command Palette**: Press `Mod+C` (Windows) or `Cmd+C` (Mac)
- **Voice Input**: Click microphone icon or press `Ctrl+Shift+V`
- **Waveform Visualization**: Real-time audio level indicator
- **Command History**: Last 10 voice commands stored locally

### 4. Autonomous Agent Loop
- **Plan Mode**: `Ctrl+Shift+P` → opens planner interface
- **Execute Mode**: Agent runs tools (read, write, edit, git, terminal)
- **Self-Healing**: Error analysis and automatic fix suggestions
- **Project Generation**: `Ctrl+Shift+G` → generate from natural language prompt

### 5. VS Code-Like Code Editor
- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **Multi-Language Support**: 15+ languages (JS, Python, HTML/CSS, Java, Go, etc.)
- **LSP Diagnostics**: Real-time error detection (backend proxy required)
- **Git Panel**: `Ctrl+Shift+G` → opens GitControlModal with:
  - Create local commits (100% offline)
  - Browse commit history
  - Rollback to previous commits
  - No GitHub remote required

### 6. Multi-Model AI Cascade
- **Primary**: Google Gemini 1.5 Flash (free: 1500 req/day)
- **Fallback**: Groq, Gemini, NVIDIA, Together, DeepSeek, Mistral, HuggingFace, OpenRouter
- **Local Fallback**: Ollama `qwen2.5-coder:7b` (16GB+ RAM)
- **Order**: Groq → Gemini → NVIDIA → Together → DeepSeek → Mistral → HuggingFace → OpenRouter → Ollama

### 7. Resume Builder with Preview
- **Template Selection**: Professional, Creative, Tech, Academic
- **Live Preview**: Real-time preview as you edit
- **Download**: PDF generation with one click
- **Hinglish Support**: Responds in user's language (Hinglish/Hindi/English)

### 8. PWA / Mobile Install
- **Manifest**: `frontend/public/manifest.json` — name "AI-Dost", icons, shortcuts
- **Service Worker**: `frontend/public/sw.js` — offline shell caching, cache-first for static, network-first for API/navigation
- **Install Prompt**: Browser "Install AI-Dost" on mobile/desktop
- **Next.js Integration**: `@ducanh2912/next-pwa` — **currently force-disabled** in `frontend/next.config.mjs` (`disable: true`) to prevent cached crashes; PWA install/service-worker registration is therefore OFF until re-enabled

### 9. Agent Memory & Learning
- **Persistent Memory**: ai-engine `/ai/agent/learn` + `/ai/agent/memory/retrieve`
- **Auto-Learn**: Telegram chat handler injects retrieved memory + auto-saves user questions
- **Corrections**: `/correct <text>` saves user corrections for future context
- **Cross-Session**: Memory persists across restarts (SQLite in ai-engine)

### 10. Autonomous Full-Stack Generation (NEW v2.1)
- **One-Prompt Project Generation**: Single prompt → complete React + Express app (17 files)
- **Template Fallback**: Deterministic templates when AI providers fail (react-vite + express merge)
- **Auto-Detection**: Keywords like "full stack", "project generat", "create project" trigger generation
- **Auto-Tests**: Runs `npm test` automatically if test script exists in package.json

### 11. Sandbox-Based Preview & Visual Verification (NEW v2.1)
- **Isolated Docker Preview**: Creates sandbox container, copies project, installs deps, starts dev server
- **Auto-Screenshot**: Playwright captures full-page screenshot of running app
- **Vision Analysis**: Gemini 1.5 Flash analyzes screenshot for UI bugs (layout, missing elements, console errors)
- **Iterative Auto-Fix Loop**: LLM generates code fixes → applies via `apply_diff` → re-screenshots → re-analyzes (max 3 iterations)
- **Fix Reports**: Saves `vision-fix-report.json` with issues, suggestions, applied fixes

### 12. Multi-Framework Template Support
- **React + Vite** (default): Modern React with Vite bundler
- **Next.js App Router**: Full-stack React with App Router
- **Astro**: Static site builder with islands architecture
- **SvelteKit**: Full-stack Svelte framework
- **Auto-Detection**: Prompt keywords select framework (e.g., "next" → Next.js, "astro" → Astro)

### 13. Enhanced Agent Capabilities
- **MAX_STEPS**: 50 (was 14)
- **Provider Timeouts**: 30s per provider (was 12s)
- **Ollama Timeout**: 60s (was 20s)
- **Scaffold Total Timeout**: 30s hard limit
- **npm Install**: 180s timeout with completion wait

### 14. Devin-Style Chat Copilot Session (2026-09-30)
- **Gate Approval UX**: chat run par REQUIRE_EXPLICIT_APPROVAL → overlay me amber **Approve/Reject banner** (capability chips + resume token); pause ke dauran run zinda rehta hai, "ended unexpectedly" nahi
- **Live session panel** (`TaskActivityOverlay`): plan checklist, files-changed (row click → **per-file unified diff** NEW/MODIFIED badges, +N/-N stats, `lib/lineDiff` LCS), Vision-QA screenshot, activity stream, completion summary card
- **Plan in chat bubble**: `useChatStream` agent-marker branch live `agentPlan` attach karta hai (bridge `marker.agentPlan` = early events + `ai_dost_task_event` listener = live updates); `ChatMessageBubble` `data-testid="bubble-plan"` render karta hai (done/active/pending states)
- **Single reply**: agent marker `kind:'agent'` REST cascade block karta hai — bubble me run ka done text aata hai, duplicate "provider busy" bubble nahi (bug #13)
- **Diff data**: backend `generate_project_from_prompt` cleanup se pehle DB snapshot leta hai → `file_written` me `previous`/`isNew` (prev >120KB → new treat); overlay content 200KB cap
- Regressions: `frontend/tests/{lineDiff,chatAgentFallback,taskRuntime,taskActivityOverlay}.test.js(x)`; journey `phase1-journey-v2.js` asserts bubble-plan + file-diff + 0 dup POSTs

## ⌃ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Toggle sidebar collapse/expand |
| `Ctrl+Shift+P` | Open agent planner mode (Chat view) / Command Palette (CopilotIDE) |
| `Ctrl+P` | CopilotIDE: Quick Open fuzzy file picker |
| `Ctrl+Shift+F` | CopilotIDE: Find in Files overlay |
| `Ctrl+Shift+G` | Open Git control panel |
| `Mod+C` | Open voice command palette |
| `Ctrl+Shift+V` | Toggle voice input |
| `F1` | Open help/cheat sheet |
| `Ctrl+Enter` | Send AI chat message |
| `Ctrl+I` | Open inline AI edit panel |
| `Mod+Shift+P` | Toggle dark/light theme |

## 🤖 Telegram Bot Commands (v2.0)

| Command | Description | Example |
|---------|-------------|---------|
| `/chat <msg>` | General AI chat | `/chat hello` |
| `/doc <type> <topic>` | Generate document (pdf, docx, pptx, csv, xlsx) | `/doc pdf bihar report` |
| `/research <query>` | Web search with sources (needs Tavily) | `/research latest AI news` |
| `/correct <text>` | Teach correction for memory | `/correct Bihar ki rajdhani Patna hai` |
| `/tts <text>` | Text-to-speech (Edge TTS) | `/tts namaste` |
| `/image <desc>` | Generate image (Pollinations) | `/image sunset over bihar` |
| `/status` | Server health + quota status | `/status` |
| `/help` | Show all commands | `/help` |
| Plain text | Treated as `/chat` | `hello` |

## 🔌 Phase-1..4 API Surface (backend :5000)

- **Sandbox (Docker)**: `POST /api/sandbox/create` `{projectId, options.ports[]}` → container + `/workspace` volume; `GET /api/sandbox/:id`; `POST /:id/exec`; `GET|POST /:id/files/{read,write,list}`; `POST /:id/dev/{detect,start,stop,build}`; `GET /:id/dev/status`; `POST /:id/ports/expose`; `DELETE /:id`; `GET /project/:projectId`. Errors: `400` invalid path (traversal blocked), `404` unknown sandbox, `503` Docker down. WS: `/api/sandbox/ws` (create/exec/write/read/list/dev:* /destroy messages). Max 10 containers; idle cleanup 30min.
- **Planner**: `POST /api/agent/plan` `{userPrompt}` → `{plan}` (400 if empty); `POST /api/agent/run` (SSE) — agent tools include `plan_project`, `execute_plan`, `list_templates` (see `backend/services/plannerService.js` — react-vite/nextjs/astro/sveltekit templates). `GET /api/agent/tasks` → `{tasks:[]}` (Kanban state is client-side).
- **Figma MCP**: `GET /api/figma/health`; `GET /file/:fileKey`; `GET /components`; `GET /design-to-code?fileKey=&nodeId=`; `GET /export?fileKey=&nodeId=&format=`. No key → `503 FIGMA_NO_KEY`.
- **Eval harness**: `GET /api/eval/status` (5 scenarios); `POST /api/eval` `{scenario|all, verbose}` → per-scenario score/feedback. Runs real agent via `/api/agent/run` (LLM-dependent pass rates).
- **Deploy**: `GET /api/deploy/targets` → vercel/netlify/cloudflare/static; `POST /api/deploy`; `POST /api/deploy/validate`.
- **Docs**: `POST /api/document/generate` (docx/pptx/csv/pdf/xlsx) — files in `frontend/public/downloads/`.
- **Travel & Local Business (Category 14)**: `GET /api/travel/domains` (10 travel domains); `POST /api/travel/generate` `{domain, location, preferences, budget, days}`; `POST /api/travel/budget-calculator` `{destination, days, travelers, tier}`; `POST /api/travel/packing-checklist` `{destination, duration, weather, activities}`. Full UI in `TravelAssistantView.jsx`, chat intent matcher #17.
- **Language & Translation Hub (Category 15)**: `GET /api/language/capabilities` (9 languages, 7 modes); `POST /api/language/process` `{text, mode, sourceLanguage, targetLanguage, context}`; `POST /api/language/grammar` `{text}`; `POST /api/language/vocab` `{word, targetAudience}`. Full UI in `LanguageHubView.jsx`, chat intent matcher #18.
- **Problem Solving & Decision Support (Category 16)**: `GET /api/decision/domains` (10 decision domains); `POST /api/decision/analyze` `{domain, options, primaryGoal, budget, constraints, userContext}`; `POST /api/decision/rice` `{features: [{name, reach, impact, confidence, effort}]}`. Full UI in `DecisionSupportView.jsx`, chat intent matcher #19.
- **Security & Cybersecurity Hub (Category 17)**: `GET /api/security/domains` (12 security domains); `POST /api/security/audit` `{code, language, domain, context}`; `POST /api/security/headers` `{framework}`; `POST /api/security/threat-model` `{systemDescription, components}`. Full UI in `SecurityHubView.jsx`, chat intent matcher #20.
- **50-Domain Master Capability Catalog & Hub**: `GET /api/catalog/capabilities` (all 50 domains with metadata & sample prompts); `GET /api/catalog/clusters` (6 logical clusters); `GET /api/catalog/capabilities/:idOrSlug`; `POST /api/catalog/detect` `{message}`. Full UI in `MasterCapabilitiesView.jsx`, chat intent matcher #21 (`masterCapabilityCatalog.js`).
- Frontend proxies all of the above via rewrites in `frontend/next.config.mjs` (keep in sync when adding new `/api/*` routes!).

## 🐛 Troubleshooting

### Common Issues

1. **"Gemini API Key not found"**
   - Solution: Add `GEMINI_API_KEY` to `.env` file
   - Get free key from Google AI Studio

2. **"Ollama not available"**
   - Solution: Install Ollama and start `ollama serve`
   - Requires 16GB+ RAM for 7b parameter models

3. **"Rate limited - try again later"**
   - Solution: Wait 60 seconds (free tier limits)
   - System automatically tries next model in cascade

4. **Git operations not working**
   - Solution: Ensure Node.js has file system write permissions
   - Git uses local `.git` repository - no remote needed

5. **Voice not working in browser**
   - Solution: Grant microphone permission when prompted
   - Use Chrome/Edge for best Gemini Live API support

### Debug Mode
- Set `NODE_ENV=development` in `.env` for detailed logs
- Check browser console for API error messages
- Circuit breaker state: `http://localhost:5000/api/circuit-breaker`

## 📁 Project Structure

```
ai-dost version 2.o/
├── ai-engine/                   # Python AI Engine (FastAPI + LlamaIndex, optional)
│   ├── main.py                  # RAG endpoints (/health, /ai/rag/query, /ai/rag/index, /ai/xlsx/generate, /ai/web/search)
│   ├── requirements.txt         # fastapi, uvicorn, llama-index, openpyxl, tavily-python
│   └── start_ai_engine.bat      # venv setup + uvicorn starter
├── backend/                    # Node.js + Express + SQLite
│   ├── server.js               # Main server entry point
│   ├── routes/                 # API routes (chat, agent, git, documents, etc.)
│   ├── services/               # AI services (Gemini, Groq, Ollama, pythonEngine bridge)
│   ├── agent/                  # Modular agent orchestrator
│   ├── models/                 # Data models (Chat, Project, Resume)
│   └── tests/                  # Jest test suites
├── frontend/                   # Next.js 14 + React 19
│   ├── components/             # UI components (Sidebar, CodeEditor, etc.)
│   ├── contexts/               # React context (Toast, Socket)
│   ├── services/               # API client configurations
│   └── app/                    # Next.js app router pages
├── .env.example                # Environment variable template
├── AGENTS.md                   # This file - Agent operations guide
└── package.json                # Dependencies (root level)
```

## 🧪 Running Tests

```powershell
# Frontend: unit + component (Jest 30 + RTL, jsdom, 0 LLM calls)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm test                    # 218 tests / 35 suites
npm test -- --coverage      # coverage thresholds enforced (statements 18 / branches 15 / functions 14 / lines 19)

# Frontend: real-browser VisualHealer suite (Playwright + Chromium, file:// fixtures)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npx playwright test         # 13 tests — real geometry, computed styles, MutationObserver, iframe, responsive
# NOTE: tests/browser/* is Playwright-only; Jest ignores it via testPathIgnorePatterns.

# Backend: unit + integration (node:test, 0 LLM calls, ephemeral port)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
npm run test:unit           # 104 tests / 13 suites (unit + project/auth/settings/cache)
npm run test:integration    # 53 tests (real Express app on port 0)
npm run test:all            # everything: unit(104) + integration(53) + security(14) + mcp(5) + api(12) + chat(13)
node --test tests/unit.test.js tests/integration.test.js

# E2E smoke (Playwright, needs both servers on :3000 + :5000; config reuses them)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
npx playwright test         # 16 flows — pages, sidebar nav, chat send, Ctrl+K, voice, agent, docs

# ESLint check (0 errors / 0 warnings expected)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npm run lint

# CI: .github/workflows/ci.yml runs all of the above (frontend lint+test+cov, backend node:test, E2E)
```

### Test notes
- `backend/tests/unit.test.js` — agent `parseLLMAction`, RAG search, CircuitBreaker/RateLimiter/RobustApiClient, `utils/errors`, sandbox path-traversal guard. Zero network.
- `backend/tests/integration.test.js` — boots real Express app on port 0 (no listener, no Telegram): health, error envelopes (BAD_JSON/404), chat validation, chat history save/load round-trip, agent plan/tasks, eval status + bad ID, document validation, figma 503, deploy targets, sandbox 404s, root redirect. Zero LLM.
- `backend/tests/e2e/smoke.spec.js` + `backend/playwright.config.js` — UI-deterministic; LLM replies asserted softly so free-tier rate limits don't flake CI.
- `frontend/tests/` — 35 suites / 218 tests total: KanbanBoard (add-task + TDZ crash regression), ProjectsView (api mocked via jest.mock), AICompanion, chatContent (internal-tag + image-command stripping), copilotIde, SmartChatHeader bridge, agent/task timeline+planner+runtime, taskRuntime/taskActivityOverlay (chat approval gate + completion summary + per-file diff view), chatAgentFallback (agent marker vs REST cascade + live plan attach), lineDiff (unified LCS diff), universal intent, accessibility audit, public website smoke, design system (live primitives), chatStreamStop (SSE stream abort/meta regression), etc.
- `jest.setup.js` polyfills TextEncoder/TextDecoder/Streams (jsdom lacks them).
- **Dead-code purge (2026-09-30)**: 41 unreferenced frontend modules + their 10 orphaned test suites were deleted (BFS import-graph verified from `pages/` entry points; live shell = `layout/AppShell` + `layout/CommandRail`, live chat = `views/ChatView`). Removed: legacy `Sidebar`/`TopBar`, old chat stack (`ActionSpine|ActionTimeline|ChatComposer|ChatExperienceLayerV4|ChatProcessingState|ComposerDock|MessageStream|QuickActionGrid|SessionInspector|SmartChatMessage|SmartComposer|TaskServerCancelBridge|ThinkingRail`), `HistoryModal|ProjectCard|ResumeBuilder|SettingsModal|TerminalModal`, `ui/{BrandLogo,ConfirmDialog,Input,Panel,ProjectSwitcher}`, `layout/{ContextInspector,SplitPane}`, `views/{AutonomousCopilotDirector,AutonomousCopilotWorkspace,ChatPromptBox,Header,TemplateHubModal}`, `sandbox/*`, `editor/*`, `CopilotWorkspace`, `agent/AgentDashboard`, `ide/CursorComposerHud`, `hooks/useWebContainer`, `lib/clientVisualHeuristics`, `services/FigmaMCPClient`, `public/audio-processor`. Also purged one-off scripts: frontend root `extract_*|refactor_*|test_overlay*`, `scripts/{e2e_full_project_test,run_1st_2nd_3rd_test,run_ui_test,verify_ui_live,visual_healer_test}`, `pages/dashboard.jsx.bak`, lighthouse report JSONs, backend root `copilottest*|debug_p1*|fix_*|patch*|test_*|verify_*|cascade_check|rag_run_check|aiServices|refactor*|chaos_*|inject_rules|extractChatLogic|broken_script|scratch_eval|news.txt`, `backend/sandbox_test_app/`, `backend/services/{refactorIntents,transformIntents}`, root `apply_patch|audit_codebase|fix_ollama*|fix_*|patch_*|test_*|notes.md|vs_BuildTools.exe`, ai-engine `{clean_main,fix,inspect_chroma,dummy_mcp_server}.py`. Kept (live): `scripts/apply-next-xff-patch.js` (postinstall), `public/sw.js` (registered in `_app.js`), `ecosystem.config.js`, `logger.js`, `projectStore.js`, `temp_test_workspace` (test fixture), `calculator_live_preview.html` (preview-server fixture).
- `eslint.config.mjs` ignores `coverage/`, `test-results/`, `playwright-report/`, `downloads/`.
- npm audit residual (non-exploitable here): backend 2×high via pptxgenjs→image-size (only if user-supplied images parsed — none in doc flow); frontend 1×high serialize-javascript via workbox-build (build-time only) + moderates via monaco's internal dompurify 3.3.1 (sanitizes only monaco's own markup; root dompurify is fixed 3.4.13). `npm audit fix` safe path already applied.

### Bugs the test suites caught (all fixed)
1. `GET /` redirected to dead port 3001 → now 3000 (or `FRONTEND_URL`).
2. `/api/chat/history` + `/api/chat/save` only existed under `/api/v1` — frontend called `/api/chat/*` and got 404 (HistoryView broken). Now registered under both.
3. `server.js` handle leaks — sandbox cleanup + WS heartbeat `setInterval`s kept Node alive after shutdown → `.unref()`.
4. `KanbanBoard.jsx` — undefined `draggedTask` + `addNewTask` declared after `return` (TDZ crash on Enter) → fixed + regression test.
5. `Sidebar.jsx` — only 5 of 10 nav items rendered; Projects/Images/History/Settings/MCP unreachable → fixed back then; legacy `Sidebar` since deleted (2026-09-30) — live nav is `layout/CommandRail`.
6. KanbanBoard "Add" buttons: `Add`/`+` buttons now call addNewTask properly (was dead code).
7. Socket.IO WebSocket dead — `ws@>=8.18` `WebSocket.Server({ server, path })` aborts NON-matching upgrades with `abortHandshake(400)`, corrupting sockets socket.io already upgraded (101) → sandbox wss switched to `noServer: true` + manual path check (`sandbox/wsServer.js`). Symptom: browser `Invalid frame header` on `ws://:5000/socket.io/`, terminal falls back to REST.
8. Agent (copilot) one-prompt full-stack generation broken — 4 bugs in `backend/routes/agent.js`, all fixed + regression tests (`parseLLMAction` suite):
   - `fileEvents is not defined` crash in `generate_project_from_prompt` (dead line) → removed.
   - `parseLLMAction` `normalizedParams` dropped `prompt`/`targetDir` keys → now keeps them (+ sandbox keys: `projectId|sandboxId|filePath|dirPath|customCommand|containerPort|options`; snake_case variants normalized).
   - Relative `targetDir` resolved against backend cwd (files + `node_modules` landed in `backend/todo-app/`) → now `path.isAbsolute ? requestedDir : safeJoin(projectPath, requestedDir)` (workspace `%TEMP%\agent-ws-default\<project>`).
   - Scaffold LLM hard-wired to Gemini (quota 429) and accepted first non-error response even if garbage → `callScaffoldLLM` mini-cascade (Groq→Gemini→Cerebras→NVIDIA→Together→DeepSeek→Mistral→HuggingFace→OpenRouter→Ollama) with strict `{files:[...]}` JSON validation — invalid JSON skips to next provider. Prompt shortened to reduce free-tier model garbage.
   - Verified E2E: 15-file React+Vite+Express todo app generated + `npm install` + agent continues with `list_directory` self-check. Note: Docker not running → `sandbox_create` fails with 503 (environment, not code).
9. Chat refactor leftovers (caught by `eslint no-undef`, fixed 2026-09-30): `routes/chat.js` used `ReasoningStreamFilter` 4× without importing it (class lives in `utils/streamUtils.js`) → Ollama stream path would `ReferenceError`; `controllers/chatController.js` assigned `usedModel` without declaration → now `const`.
10. Stop generation (2026-09-30, R1/R2 chat parity): `useChatStream` ab `signal` leta hai + `meta` attach karta hai (`{provider, totalMs, ttfbMs, stopped}` → bubble chip "groq … · 1.3s · 1st token 1.1s"); Esc/Stop button → AbortController. **Gotcha**: `TaskRuntimeBridge.patchedFetch` (window.fetch monkey-patch) apna controller banake caller ka `init.signal` drop karta tha → caller abort network tak nahi pahunchta tha; fixed by forwarding callerSignal → bridge controller (`TaskRuntimeBridge.jsx`). Regression: `frontend/tests/chatStreamStop.test.js`.
11. Copilot/sandbox E2E (2026-09-30, Docker gate→approve→scaffold→preview pass): 4 sandbox bugs found+fixed — (a) vite `--host 0.0.0.0` meta-runners (concurrently/npm: aliases) me swallow ho jata tha → vite sirf `::1` pe bind karta tha, host preview timeout; fix: `ensureViteHostScripts` package.json dev-scripts normalize karta hai (`devServerManager._applyHostBinding`) + Docker mode me vite framework ke liye `PORT` env drop (api `server.js` PORT=5173 pe bind karke vite se takrata tha). (b) `PidsLimit: 100` bahut kam tha — vite/esbuild/node thread pools cgroup pids count karte hain → runc exec `Resource temporarily unavailable`; fix: 512. (c) Agent scaffold `npm install --ignore-scripts` (supply-chain P0) se native addons (better-sqlite3) BUILT NAHI hote the → api crash "Could not locate the bindings file" + devServerManager ka plain `npm install` no-op tha (scripts dobara run nahi karta); fix: `npm install && npm rebuild`. (d) Docker mode me dev-server child output exec end hone pe hi milta tha (api crash invisible); fix: `SandboxManager.exec({onData})` live-tail → dev logs. Regression: `backend/tests/devServerHostBinding.test.js`. E2E flow: `POST /api/agent/run` (SSE) → `gate.approval_token` → dobara run with `approvalToken` → 11 files → `POST /api/sandbox/create` + `dev/start` → READY → host preview 200 + API `/api/tasks` 200 + Playwright screenshot (0 console errors). Note: sandbox state in-memory hai — backend restart sandboxes orphan kar deta hai (container leak; cleanup manually ya aage restore-on-boot).
12. Devin-style chat copilot (2026-09-30): chat composer se ek prompt par gate approval (REQUIRE_EXPLICIT_APPROVAL) aane par overlay me amber **Approve/Reject banner**, live session panel (plan checklist, files-changed, Vision-QA screenshot, activity stream) aur scaffold ke baad **completion-summary card** dikhta hai — aur beech me "ended unexpectedly" NAHI. Fixes: (a) bridge `chatTaskPlan` key bhejta tha → request `chatAgentRouteBridge`/`ChatTaskGateway` intercept kar leta tha (jisme gate/approval support hi nahi) → renamed to `clientTaskPlan` (`taskCancellation.js:86` isi key pe fall-through karta hai); (b) `generate_project_from_prompt` doosri baar scratch workspace (`%TEMP%\agent-ws-default\*`) ko "existing project" samajh kar block karta tha → `isScratchWorkspace` bypass; scaffold failure pe fake success `done` jata tha → ab `toolResult.success:false` pe real `error` + `done '❌ Scaffold failed: …'`; (c) scaffold `.env.example` likhne par `pathSecurity` ka `/^\.env(?:\..+)?$/i` pattern poore run ko fail kar deta tha → `.env.example|.env.sample|.env.template` allowlist (placeholder templates only; real `.env*` still blocked) + write loop me per-file `safeJoin` skip (ek protected path poora scaffold nahi mar sakta); (d) stale test `allowOverwrite permits replacement` — flag P2 #59 me jaan se remove hua tha (LLM-controlled bypass) → test ab `WRITE_FORBIDDEN_ON_EXISTING` assert karta hai; `tests/codeDiffHardening.test.js` CI list me add (20/20). Gotcha: server restart ke bina backend edits live nahi hotin; Ollama down ho to cascade ~60s kharch karta hai (default model `qwen2.5-coder:7b` = `ollama cp qwen2.5:7b qwen2.5-coder:7b` se aliased). Regressions: `frontend/tests/taskRuntime.test.js` (gate/done/error/file/screenshot normalize), `frontend/tests/taskActivityOverlay.test.jsx` (approval → resume → summary), `backend/tests/codeDiffHardening.test.js`.
13. Duplicate chat reply after agent runs (2026-09-30): agent SSE me chat `chunk` events nahi hote the → `useChatStream` ka `finalReply` empty hota tha → REST fallback `POST /api/chat` fire → ~90s free-tier cascade → duplicate "AI provider temporarily busy" bubble. Fix: bridge agent-path par `window[BLOCK_FALLBACK_KEY]` pe `kind:'agent'` marker (done-promise) park karta hai; `emit` terminal event pe settle karta hai (done = full summary text, error = `⚠️`, cancel = `⛔`); `useChatStream` empty reply + agent marker → `marker.done` await karta hai (**approval pause cycle cover hota hai** — bubble me final run summary aata hai), stop pe AbortError → `⏹ Response stopped.`; REST fallback sirf genuine empty stream ke liye. Saath me `isChatFallbackRequest` ab `/api/v1/chat` (axios baseURL) match karta hai. Gotcha: chat bubble ke liye `streamChatResponse` run ke complete hone tak return Nahi karta — thinking indicator poore run + approval wait tak ON rehta hai (intended). Regression: `frontend/tests/chatAgentFallback.test.js` (5 tests). Live verify: journey me `dup /chat POSTs: 0` + bubble me "Project Generated".

### Document generation test (all 5 types)
```bash
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"pdf","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"docx","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"pptx","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"csv","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"xlsx","topic":"test"}'
```

### Travel & Local Business test (Category 14)
```bash
curl http://localhost:5000/api/travel/domains
curl -X POST http://localhost:5000/api/travel/generate -H "Content-Type: application/json" -d '{"domain":"restaurant-search","location":"Goa","preferences":"beachside seafood"}'
curl -X POST http://localhost:5000/api/travel/budget-calculator -H "Content-Type: application/json" -d '{"destination":"Manali","days":4,"travelers":2,"tier":"budget"}'
curl -X POST http://localhost:5000/api/travel/packing-checklist -H "Content-Type: application/json" -d '{"destination":"Ladakh","duration":"7 days","weather":"cold","activities":"biking"}'
```

### Language & Translation Hub test (Category 15)
```bash
curl http://localhost:5000/api/language/capabilities
curl -X POST http://localhost:5000/api/language/process -H "Content-Type: application/json" -d '{"text":"Namaste, how are you?","mode":"translate","targetLanguage":"hindi"}'
curl -X POST http://localhost:5000/api/language/grammar -H "Content-Type: application/json" -d '{"text":"She do not goes to office"}'
curl -X POST http://localhost:5000/api/language/vocab -H "Content-Type: application/json" -d '{"word":"Pragmatic"}'
```

### Problem Solving & Decision Support test (Category 16)
```bash
curl http://localhost:5000/api/decision/domains
curl -X POST http://localhost:5000/api/decision/analyze -H "Content-Type: application/json" -d '{"domain":"tech-stack","options":["Next.js","Vite+Express"],"primaryGoal":"Fast MVP"}'
curl -X POST http://localhost:5000/api/decision/rice -H "Content-Type: application/json" -d '{"features":[{"name":"Feature A","reach":500,"impact":3,"confidence":80,"effort":2}]}'
```

### Security & Cybersecurity Hub test (Category 17)
```bash
curl http://localhost:5000/api/security/domains
curl -X POST http://localhost:5000/api/security/headers -H "Content-Type: application/json" -d '{"framework":"express"}'
curl -X POST http://localhost:5000/api/security/threat-model -H "Content-Type: application/json" -d '{"systemDescription":"Fintech payments","components":["Next.js","Express","Postgres"]}'
curl -X POST http://localhost:5000/api/security/audit -H "Content-Type: application/json" -d '{"code":"const q = \"SELECT * FROM users WHERE id = \" + id;","domain":"sqli-prevention"}'
```

### 50-Domain Master Capability Catalog test
```bash
curl http://localhost:5000/api/catalog/capabilities
curl http://localhost:5000/api/catalog/clusters
curl http://localhost:5000/api/catalog/capabilities/9
curl -X POST http://localhost:5000/api/catalog/detect -H "Content-Type: application/json" -d '{"message":"Explain Hohmann transfer orbit in aerospace"}'
```

## 🚀 Deployment

### Docker Compose (local prod-like stack)
- Root `docker-compose.yml` = **3 services only**: `backend` (:5000, health-gated), `frontend` (:3000), `ai-engine` (:8001) + `ai_engine_data` volume. `docker compose up` from repo root.
- Redis/Mongo are **NOT** in the root compose — `memory-brain/docker-compose.yml` is a separate stack (bring up only if running the memory-brain service).
- Sandbox `docker.sock` mount is opt-in (commented out in compose; sandbox API returns 503 otherwise).

### Vercel (Frontend)
1. Connect repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy: `vercel --prod`

### Railway/Render (Backend)
1. Create new Node.js service
2. Set environment variables in service settings
3. Add Ollama dependency if using local models
4. Set port to process.env.PORT or 5000

### Production Considerations
- SQLite → PostgreSQL for multi-user support
- Add Redis for rate limiting and caching
- Implement API key rotation for free tier quotas
- Set up monitoring for API usage limits

## 💡 Tips & Best Practices

1. **Start with Gemini Flash** - Most reliable free option
2. **Use Ollama for code generation** - Better for technical tasks (16GB+ RAM)
3. **Git operations are local-only** - No GitHub push required, works offline
4. **Agent plan mode first** - Review agent's plan before execution
5. **Save frequently** - Agent can modify files, use git commit after major changes
6. **Language matters** - Agent responds better to clear, specific prompts
7. **Free tier awareness** - Gemini: 1500/day, Tavily: 1000/month
8. **Cache repeated queries** - Same prompt = same response (no extra quota)

## 🆘 Need Help?

- Check `backend/logs/` for server-side errors
- Frontend errors appear in browser dev console
- API quota status: `http://localhost:5000/api/quota-status`
- Feature requests: Issues on GitHub repository

---

**AI-Dost v2.0** - Your free, autonomous AI developer platform. 
Built with 100% free APIs and local Ollama fallback for privacy.