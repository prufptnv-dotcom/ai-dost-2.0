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

### 15. Devin-Style Copilot IDE UX (2026-09-30)
- **Plan card** (`ide/CopilotPlanCard.jsx`): header `PLAN · n/m` + progress bar + collapse (default open); rows = `TaskStepItem` checkbox checklist (square done/active/error markers, mono target + live log lines)
- **Live status strip** (`ide/CopilotStatusBar.jsx`): composer ke upar — spinner + emoji-stripped action label + `M:SS` elapsed timer (`copilotStatus` state pehle kabhi render nahi hoti thi); idle pe last status dot ke saath rehta hai
- **Muted message rows**: thought/tool/step = compact mono rows (`border-border-subtle`, koi neon/pulse nahi); user bubble = flat `bg-accent/15`; assistant = neutral avatar; tool labels emoji-stripped (`stripEmoji`)
- **Diff-aware file rows**: `file_written` par `contentsRef` (sync update — same-tick multiple events!) se prev content → `lib/lineDiff` stats → row me `NEW` badge ya `+N -N`; click → editor me file open (`selectFile`)
- **Composer**: pill box, icon-only chips (attach/terminal/db), circular send, `↵ send · ⇧↵ line` kbd hints, "Message Copilot…" placeholder
- **IdeHeader**: nowrap (no wrapping), icon-only right launchers (History/Save count chips), segmented Code/Split/Preview = single accent active style
- **Model picker** (header chip → dropdown, persists `localStorage ai_dost_copilot_model`): `auto|gemini|groq|ollama` → `preferredModel` in `POST /api/agent/run` body → backend `callLLM` cascade reorder (preferred provider first, failure still falls through — ollama pehle local try, phir cloud cascade). Notice event `thinking` stream pe aata hai ("⚡ Preferred model: …")
- **Row timestamps**: `setCopilotMessages` wrapper appended messages ko `ts` stamp karta hai (functional-updater form auto-detect) → thought/tool/step/file rows me `HH:MM` (fmtTs, module scope)
- **QA badge** (`PreviewPane` `qaStatus` prop, testid `qa-badge`): `director_verification` SUCCEEDED→`passed` / DELEGATING→`running` / else `failed`; naye run pe `idle` (badge hidden)
- **Footer meter** (`IdeFooter`): `step n/m` + running `M:SS` + `≈N tok · ₹0` (chars÷4 estimate) + preferred model label (Zepto `formatElapsed` reuse)
- **Markdown assistant replies** (`ide/CopilotMarkdown.jsx` NEW): assistant bubble + `AiStudioResponseCard` dono ab `renderCopilotMarkdown` (marked → DOMPurify → `wrapCodeBlocks`) use karte hain — `<pre>` ko `.cm-code` header (lang label sanitized `[a-z0-9+#_.-]`) + delegated copy button (`Copied!` 1200ms, clipboard me trailing-newline strip) ke saath wrap karta hai; `styles/markdown.css` pehle kabhi import nahi thi → `globals.css` me `@import './markdown.css'` add (`.md-prose pre/.cm-code*`)
- **Click-to-expand file diff**: file row ka main area (`file-row-main`) diff panel toggle karta hai (`NEW` rows editor me khulti hain), right chevron (`file-row-open`) hamesha `selectFile` → panel me unified diff (`lib/lineDiff`, `unified diff · path` header, 600-line cap, `−` del marker); `file_written` event ke `previous`/`next` contentsRef me store (120KB+ prev → `isNew`, cap 80K chars per side)
- **Collapsible thought rows**: long thought (>120 chars) title `Expand thought`/`Collapse thought` se toggle (default collapsed), chhoti thoughts always open
- **Preview console drawer** (`PreviewPane`): URL pill (`localhost:{hostPort}` / `preview://in-browser`) + toggle (testid `console-toggle`, `Terminal/ChevronUp` icons) se drawer — `previewLogs` (CONSOLE events, cap 80, clear button), level colors (log/info = mono, warn = amber, error = red) + `console-error-count`; telemetry `PreviewEngine.js` ke DONO paths me (static `PREVIEW_TELEMETRY_SCRIPT` + React-template inline script ~line 265) `console.*` wrap + resource-load errors → `report('CONSOLE', …)`
- Regressions: `frontend/tests/copilotSessionUi.test.jsx` (23 tests: checklist rows, plan card progress/toggle, status strip emoji/timer, IdeFooter meter, PreviewPane QA badge — PreviewPane needs `ToastProvider` wrapper); live verify via Playwright SSE route-intercept (synthetic run: plan 3/3, NEW → +2-1 rows, status 0:01, picker Auto→Gemini first, file-row `09:43 AM` ts, `QA passed` badge, footer `step 3/3 · ≈63 tok · ₹0 · Gemini first`, 0 pageErrors)

### 16. Font Awesome Icon Standard (2026-10-01)
- **Skill**: `npx skills add FortAwesome/fontawesome-agent-tools` → 4 skills repo `.agents/skills` me (`add-icon`, `fa-help`, `setup-fa`, `suggest-icon`); backend `skillRegistry` ab `~/.agents/skills` KE SAATH repo `.agents/skills` bhi scan karta hai → copilot `load_skill` se FA skills use kar sakta hai. Official docs (`docs.fontawesome.com/llms.txt` + React/Next.js page) se verify karke setup.
- **Site integration** (Path D, npm, free, no Kit): `@fortawesome/fontawesome-svg-core@7.3.1` + `free-solid/regular/brands-svg-icons@7.3.1` + `@fortawesome/react-fontawesome@3.5.0`; `_app.js` me CSS import + `config.autoAddCss = false` (Next.js me bina iske icons HUGE render hote hain); config `.font-awesome.md` (root) me documented.
- **Shared component** (`ui/AppIcon.jsx`): `<AppIcon name="search" size={15} />` — ~100 verified FA definitions (har naam installed v7 packages se node-verify kiya), unknown → `circle` fallback, `loader` auto-spin; naye code me `lucide-react` import NA karo (13 chrome files migrated: CommandRail/AppShell/ChatView-stack/CopilotIDE/IDEOverlays/PreviewPane/IdeHeader/IdeFooter/PublicNavbar + ChatView dead import removed; baaki ~90 files incremental)
- **Generated projects FA-only**: scaffold system prompt me hard ICON RULE (`lucide`/emoji-as-icons/hand-drawn `<svg>` FORBIDDEN) + `editPrompt` me same rule; golden scaffolds + 6 blueprints + orchestrator + plannerService templates ke deps `lucide-react` → 5 FA packages; template code `FontAwesomeIcon` + `fa*` imports (saare naam verify kiye); `size={N}` → `style={{ fontSize: N }}`; dynamic-icon patterns (`m.icon`/`tab.icon`) FA definitions store karte hain
- **Emoji favicon fix**: plannerService astro template `🚀`-text SVG → generic gradient-spark SVG (skill rule: FA SVG markup training-data se hand-draw NA karo)
- **Preview renders real FA**: `routes/preview.js` me FA 6.5.2 CSS (cdnjs) + `FontAwesomeIcon` stub (`icon.iconName` se `<i>`) + `Fa*` stubs (kebab + brand/solid split) + synthesized `fa*` value defs (imports strip hote hain)
- Verify: `node --check` 12 backend files, scaffold content script (9 golden cats + 6 blueprints FA-in/lucide-out + registry 34 skills), backend unit 104/104, frontend jest 271/271, eslint 0/0
- Gotcha: same-file parallel edits me race hota hai (stale report/lost update) — har file baad me grep se verify karo; `node --check` prompt-template backtick break pakadta hai (agent.js editPrompt me hua tha, fixed)

### 17. Devin-Style Copilot Upgrade (2026-10-04, multi-session scope)
- **Phase 1a Stop/Cancel**: `runTaskIdRef` + `handleStopRun` (Esc + stop button) → `lib/copilotStop.js` `cancelAgentRun` (`POST /api/agent/tasks/:id/cancel` + `POST /api/agent/run/:runId/cancel`); AbortController forwards to fetch. Test: `copilotStop.test.js` (11).
- **Phase 1b SSE events**: run stream events `start|error|terminal_output|self_heal|gate_*` + unknown-event catch-all render as rows. Test: `copilotSseEvents.test.js` (11).
- **Phase 1c Checkpoint/Rollback**: `POST /api/agent/checkpoint` (run start snapshot) + `POST /api/agent/rollback` `{checkpoint:{files:[{path,content}]}, projectId}` → `os.tmpdir()/agent-ws-<projectId>`; frontend stores `checkpointRef`, rollback button + confirm. Tests: `copilotCheckpoint.test.js` (9) + integration (60→62).
- **Phase 1d Ask/Plan/Code modes**: `agentMode` state (`localStorage ai_dost_copilot_mode`), mode-switch UI (`agent-mode-switch`), editable plan checklist, `body.plan` preset override for plan mode. Test: `copilotAgentModes.test.js` (13).
- **Phase 2a Permission levels**: `CapabilityGatekeeper.evaluateWithLevel(caps, ctx, level)` — 'ask' escalates non-BLOCK→`REQUIRE_EXPLICIT_APPROVAL` (mints token, skips when caps empty/canonical already escalated); 'turbo' downgrades approval→ALLOW (BLOCK never overridden); garbage→'auto'. `generateTaskPlan(userPrompt, options)` + `/plan` + ReAct `/run` pass `req.body.permissionLevel`. Frontend `permissionLevel` (`ai_dost_copilot_permissions`) + `permission-switch` radiogroup (Ask/Auto/Turbo) + run body `permissionLevel` + `approvalToken` resume; director ask-gate: probe → `gate_approval_required` (token) / `gate_blocked` / invalid-token `gate_approval_invalid` → frontend approval banner (`approval-banner`/`approve|reject-btn`), `approveRun(token)` re-runs with token, no duplicate user row. Tests: backend unit (gatekeeper 7 + director gate 5), `copilotPermissions.test.js`.
- **Phase 2b @file mentions**: `lib/copilotMentions.js` (`detectMention`/`parseMentionPaths` — `..` reject, cap 20) + dropdown (`file-mention-dropdown`, ↑↓/Tab/Enter/Esc) + run body `projectFiles` (mentioned-first) + `contextFiles` → director `directorRequest` prioritization (original `request` for gate/discovery). Tests: `copilotMentions.test.js` (7) + backend unit contextFiles (4).
- **Phase 2c /btw side chat**: `/btw <q>` prefix → `askSideChat` (user row `/btw …` → `POST /api/chat` → `kind:'sidechat'` indigo row `sidechat-row`) — run kabhi interrupt NAHI; Enter path `sideAsk` guard. Test: `copilotSideChat.test.js` (4).
- **Phase 2d Message retry**: saare 4 error sites `kind:'error'` (red `error-row` + ⚠️) + `msg-retry-btn` → `retryLastRun()` (`lastRunRef` modes `{mode:'code'|'ask'}`); guards running + no-lastRun. Test: `copilotRetry.test.js` (5).
- **Phase 3a Task queue + run history (real store)**: `AgentTaskDAO.listRecent(limit, projectId)` (`created_at DESC, rowid DESC` — second-granularity ties deterministic) + `services/runHistory.js` (`STATUS_TO_COLUMN` PENDING/QUEUED→planned, RUNNING/WAITING/VERIFYING→running, COMPLETED/SUCCEEDED→done, FAILED→review, CANCELLED→backlog; `mapTaskRow` latest-run-wins `{runStatus, attempt, runCount, error, description}` + corrupt-JSON fallbacks; `listRunHistory({db, projectId, limit})` lazy DAOs) + `GET /api/agent/tasks` ab real data return karta hai (`{success, tasks}`, `?projectId`/`?limit` 1–200 default 50, 500 envelope `tasks:[]`). `KanbanBoard` (LIVE via AgentView) ko real tasks milte hain (empty DB → MOCK fallback). Tests: unit `runHistory` describe (4) + existing integration `GET /tasks` asserts shape.
- **Phase 3b Watch mode (file watcher + live event push)**: workspace = **SQLite `workspace_files`** (fs.watch nahi!) — `projectStore.js` EventEmitter bus (`onWorkspaceChange(listener)` → unsubscribe fn; `notifyWorkspaceChange` alias) + `emitChange` on save/delete success; `server.js` local `saveProjectFile` + rename/folder-delete/file-delete routes emit too; `GET /api/agent/watch/:projectId` SSE (`watch_started` + `file_changed {path, action, at}` frames, `: ping` 25s keepalive, teardown on close/aborted, blank projectId → 400). CopilotIDE: `watching` state (`ai_dost_copilot_watch`), `watch-toggle` (eye icon, aria-pressed, emerald active) + EventSource effect (mid-run suppress — run stream already streams `file_changed` rows; debounced 400ms `loadWorkspaceFiles()` refresh; `kind:'thought'` row `↻ watch · <action>: <path>`; cleanup es.close + debounce clear). Tests: `copilotWatch.test.js` (8, mutation-verified), backend unit bus (5), integration SSE streaming (2). Existing mid-run push: `routes/agent.js` `type:'file_changed'` (:2279/:2830) → frontend file rows (same branch as `file_written`).
- Gates: backend unit **135/135** (22 suites), integration **62/62**, frontend jest **52 suites / 412 tests**, eslint **0/0**, `node --check` on all edited backend files.

### 18. Self-Learning Memory — durable notes (2026-10-04)
- **Goal**: user jo bhi project banaye uske lessons save rahein — **project DELETE karne ke baad bhi** (accuracy ↑, speed unchanged, ₹0, zero extra LLM calls).
- **Store**: `copilot_notes` table (migration `010_copilot_memory`, registered in `db/index.js`) — user_id-scoped, **NO foreign key to projects** (delete-proof), `tags` JSON + `success_count`; dedupe = exact content → success_count++ + updated_at bump.
- **DAO/Service**: `db/dao/CopilotNoteDAO.js` (create/listByUser/listVisible/remove/clear/count) + `services/copilotMemory.js` — `learnNotes` (batch cap 10, content ≤500, tags ≤8); `retrieveNotes` pure-JS rank = prompt-token-overlap×2 + sameProject 1.5 + min(success_count,5)×0.3 + 30d recency decay (sirf overlap OR same-project notes — noise exclude); `formatNotes` ≤700 chars; `extractRunNotes` deterministic (success → lesson + files count; error → fix + message; self-heal triggers ≤3; stack tags react/vite/express/...).
- **API** (`routes/copilotMemory.js`, mounted `['/api/copilot/memory','/api/v1/copilot/memory']`): `POST /learn`, `GET /list?q&projectId&limit`, `GET /retrieve?prompt&projectId`, `GET /count`, `DELETE /clear` (body projectScope optional), `DELETE /:id` (404 unknown). Frontend proxy = existing `/api/copilot/:path*` rewrite (catch-all `/:path*` bhi hai).
- **Auto-learn (backend)**: `/api/agent/run` ke `send` wrapper me terminal hook — `done`→success note (filesTouched count from file_written/file_changed), `error`→failure note (pehla terminal event wins via learnDone guard), `self_heal`→naya SSE field `errorHint` (errorContext 200 chars; frontend unknown fields ignore karta hai). `learnNotes(...).catch(()=>{})` fire-and-forget — memory failure run kabhi break nahi karti.
- **Injection**: ReAct loop ke **first message** me `lessonsContext` (`=== LESSONS FROM YOUR EARLIER RUNS (user-level memory — apply when relevant) ===` + top-5 formatted lines) — messages init se pehle SYNC retrieve (node:sqlite, <5ms); zero notes → empty block (no prompt bloat).
- **Frontend** (`CopilotIDE`): toolbar `data-testid="memory-btn"` (brain icon, `aria-expanded`, count badge `memoryCount>0`) → modal `data-testid="memory-panel"` — rows `memory-note-row` (kind badge lesson=emerald/fix=amber), `memory-note-delete`, `memory-clear-btn`, "Notes stay even if you delete the project." + durability footer; mount-effect me count fetch, open pe `loadMemoryNotes()` (list?limit=40).
- **Scope note**: sirf CopilotIDE ReAct path — chat-composer director bridge me injection ABHI PENDING; ai-engine ChromaDB/vector sync optional (SQL keyword rank se kaam chal raha hai).
- Tests: backend unit `copilotMemory (self-learning notes)` (5: dedupe+batch-cap, ranking+noise-exclusion+same-project, **project-delete survival**, extractRunNotes, formatNotes cap) → **140/140 (23 suites)**; integration (+3: learn→list→dedupe→delete→404→clear, survive project DELETE via real API, retrieve ranked formatted) → **65/65**; frontend `copilotMemory.test.js` (6 — state/loaders, count effect, button/panel UI, backend contract cross-check incl. `no REFERENCES projects` scan; mutation-verified: injection marker mutate → 1 fail → restore → green) → **53 suites / 418 tests**, eslint 0/0.
- **Future (RTX 4050, budget>0)**: `copilot_notes` = ready training corpus — QLoRA fine-tune 7–8B local model on {prompt→plan/outcome} pairs; deploy: SQLite file = plain volume mount (docker-compose already ships backend+sqlite, koi extra service nahi).

### 19. P0 — Runtime Foundation (2026-10-07) *"the no-more-lying layer"*

**Problem P0 fixes:** the agent reported *"Headless Browser Screenshot QA: Passed — UI rendered with 0 console errors"* for a project it had **never installed, never built, and never executed**. It screenshotted a hand-assembled stub page containing only `App.jsx` with hardcoded `IconStub` / fake `API` objects, while every other generated file was discarded.

**New module** `backend/services/runtimeBridge.js` — nothing in it throws; every fn returns `{ok, evidence}` so the SSE stream can never be wedged:
- `installDependencies(dir)` — **awaited** npm install + `npm rebuild`, real exit codes. Skips in ~5ms when `package.json` declares no deps. `--ignore-scripts` is kept (LLM-authored package.json is untrusted) and `npm rebuild` restores native addons — same trade-off `devServerManager` documents.
- `runBuild(dir)` / `runTests(dir)` — real `npm run build` / `npm test` exit code + stderr tail.
- `serveStatic(root)` — contained static server (SPA fallback, rejects path traversal) for the built output.
- `captureRealApp(url)` — headless Chromium: screenshot + **every** console error + **every** uncaught page error + whether `#root` actually rendered.
- `startRealDevServer(dir, {projectId})` — real `devServerManager` dev server; used when there is no build output (a dev-mode `index.html` references raw `.jsx` that no static server can transpile).
- `verifyBuild(dir, opts)` — composite; `describeVerification()` renders it.
- **Honesty contract**: verdict is `pass` only when `rootRendered && pageErrors.length === 0`. An unverifiable run is reported **UNVERIFIED** — never as pass, never as fail.

**`spawn EINVAL` (CVE-2024-27980) — silently broke npm everywhere on Windows.** Node ≥18.20.2/20.12.2/22 refuses to spawn a `.cmd` with `shell:false`. Every host-side `npm install` was failing with `spawn EINVAL`, the `error` handler swallowed it, and install "succeeded". Fixed via `resolveInvocation()` in `runtimeBridge` and applied to `devServerManager` (2 sites) + `agent/orchestrator.js`. Two rules inside it:
- only **real `.exe`** binaries spawn directly with `shell:false` (keeps `C:\Program Files\…\node.exe` working);
- **only `.cmd`/`.bat`** route through `cmd.exe /d /s /c` (they genuinely need a shell). Routing an `.exe` through cmd breaks spaced paths — `/s` strips the outer quotes and the bare path falls apart (`'C:\Program' is not recognized`).
- `assertLiteralArgs()` rejects any arg containing `;&|<>`$()\n\r"^%!` so the command line cannot be restructured.

**Vite space-path build killer.** Vite's `html-inline-proxy` plugin turns an inline `<style>` into a module id derived from the HTML's absolute path. On a path containing a space (this machine: `C:\Users\vikash kumar\…`) it cannot resolve and **every** build dies with `[vite:html-inline-proxy] Could not load …?html-proxy&inline-css`. Proven: the identical project builds clean in a space-free dir and fails in a space-containing one, purely because of that `<style>` block. Fix: `normalizeInlineHtmlStyles()` in `routes/agent.js` relocates inline styles into the stylesheet — applies to LLM-authored *and* golden `index.html`.

**Scaffold coherence.** An LLM-authored `package.json` is routinely incoherent with the tree beside it (`react-scripts` next to a golden `vite.config.js`, a `client` script for a directory that doesn't exist, no `build` at all) → produced `'vite' is not recognized` builds. Now the **golden `package.json` is authoritative for `scripts`** and guarantees the toolchain, while LLM extras (deps, name, description, version) are merged on top; an unparseable LLM `package.json` falls back to the golden one.

**Wired into** `routes/agent.js` `generate_project_from_prompt`: install → build → real browser check → `verified` / `verification` / `install` on the tool result. `success:true` still means "files written" (unchanged contract); whether the code *works* is the separate `verified` flag.

**Verified live** (`/api/agent/run`, `projectId=p0-final-01`): `npm install` exit 0 (97.7s) → `npm run build` **exit 0** (8.6s) → real output served → HTTP 200, 0 page errors, 22KB screenshot of the actual Pomodoro UI. Failures are now reported with the compiler's own words (verbatim Vite/esbuild output in a `<details>` block).

- Tests: `backend/tests/runtimeFoundation.test.js` (14 — spawn/EINVAL + injection guard, real exit codes, install skip logic, failed-build short-circuit, UNVERIFIED contract, real screenshot e2e, "0 console errors" never emitted, static-server traversal) → backend unit **162/162 (30 suites)**; frontend unchanged 54 suites / 425 tests; eslint 0/0. Known pre-existing: integration `DELETE /api/v1/memory/project` expects 403/404 but gets 200 (memory route untouched by P0).
- **Remaining P0 gap**: install (≈2 min) and build run *before* the ReAct loop resumes, so the loop still cannot repair a failed build — that is **P1** (verification-driven repair, `agent.js:2992` re-runs the failed command after a patch).

### 20. P1 — Deterministic verification + repair loop (2026-10-07) *"generate → verify → observe → repair"*

P0 could *report* a failure. Replit / Bolt / Devin *fix* it. P1 closes the loop.

**New module** `backend/services/projectRepair.js` — pure orchestrator, **no LLM import** (`callLLM` is injected by `routes/agent.js`, so there is no import cycle and one provider cascade stays authoritative):
- `requestRepair({dir, evidence, summary, intent, callLLM, attempt})` — shows the model the **verbatim** compiler/runtime output plus the files the error actually implicates (error text is mined for `*.jsx|css|html` filenames to rank the prompt). Response contract is pinned to `{"files":[{path,content}]}`; `parseFilePayload` salvages fenced/prose-wrapped JSON and rejects junk.
- `diffAgainstDisk()` — a "repair" that returns byte-identical files is **not a repair**; those are dropped so the loop stops instead of re-asking a model that already failed.
- `hasActionableFailure()` — **UNVERIFIED is not a failure.** No build script, no `index.html`, missing playwright ⇒ *no* LLM call. Only a real build/runtime error enters the loop.
- `repairUntilVerified({dir, verify, repair, maxAttempts})` — bounded (default 3, clamped 0–5 via `parameters.maxRepairAttempts`); **re-runs the real build + real browser check after every attempt**. The model's claim that it fixed something is never trusted.

**Per-file real parsing** — `runtimeBridge.verifySourceFile(dir, relPath, content)` / `verifySources()`. Loads the **project's own esbuild** (vite's dependency, so the verdict matches the build that will actually run) and falls back to the backend's `acorn`, then to structural balance — and labels that last case `strength: 'weak'` with a `note`, so a bracket check can never be mistaken for a compile.

**ReAct loop fixes** (`routes/agent.js`):
- **Self-heal is pinned to the failing command.** `selfHealState = {command, signature}`; a genuinely *different* failure earns a fresh budget, and the budget only clears when the **same** `run_terminal` command succeeds. Previously *any* successful step (e.g. a `write_file`) zeroed the counter, so "3 attempts" was never a bound.
- **The failed command is re-run after the patch.** The prompt now says *"apply the fix, then run the EXACT same command"* and the observation carries the real exit code.
- **Exhaustion is announced.** On the 3rd identical failure the stream emits `self_heal {exhausted:true}` and the model is told to stop retrying and report honestly.
- **A failed run can no longer report success.** `runStats {steps, failedSteps, lastError}` replaces the old `steps.length > 0` gate; an exhausted budget or any failed step now emits `error` + `done {completed:false}` instead of `"🎉 completed successfully"`.

**Cascade junk fix.** `isErrorResp` accepted any response of ≤5 chars as success, letting `null` / `{}` / `[DONE]` halt the cascade and become the "generated" scaffold. It now requires an actual payload first, and the provider-failure substring checks run against *that* response — so a legitimate `write_file` whose code contains the words "API error" / "Rate limit" is no longer silently discarded.

**Wired into** `generate_project_from_prompt`: P0 verify → repair loop (emits `agent_status agent:'Self-Heal'` + `file_written` per attempt) → report gains a **Repair Attempts (n/3)** section and a `repair: {attempts, repairs[]}` field alongside `verified`. Opt out with `repairEnabled: false`.

**Proven with real builds** (`temp_ui_audit/prove_p1_repair_loop.js`): a genuinely broken project → `❌ exit 1 · src/App.jsx:1: ERROR: Unexpected token '}'` → rewrite → `✅ exit 0` → `HTTP 200, 0 page errors, rootSample "P1 REPAIRED"`, real PNG. Live route run (`p1-final-01`): install exit 0 → build exit 0 → **"Repair Attempts (0/3): No repair was needed"** (a passing build costs zero LLM calls).

- Tests: `backend/tests/verificationRepair.test.js` (20 — payload salvage/junk rejection, actionable-vs-unverified, no-op-diff, loop exit conditions + budget + re-verify count, verbatim-error-in-prompt, weak-label honesty) → backend unit **182/182 (36 suites)**; integration 64/65 (same pre-existing memory-route failure); frontend unchanged 54 suites / 425 tests; eslint 0/0.

### 21. P2 — Real codebase context: BM25 retrieval + code map (2026-10-07)

Devin's edge over everyone else is not the model — it is that the model can **see the repository**. Before P2 the `/api/agent/run` path built its "semantic search" by counting substring occurrences:

```js
score += (text.match(new RegExp(`\\b${word}\\b`,'g')) || []).length * 3;   // routes/agent.js:184
```

which cannot rank by rarity, cannot match `useTimer` when asked about "timer", and has **zero** structural awareness. (That scorer also had a latent bug: `wordRegex.test()` on a `/g/` regex is stateful via `lastIndex`, so its "partial match" branch was unreliable.)

**New module** `backend/services/codeContext.js` — dependency-free, synchronous, no model call:
- **`tokenize()`** — code-aware. Splits `camelCase` / `PascalCase` / `SCREAMING_CASE` / `snake_case`, drops stopwords, and also indexes the full identifier so `"timer"` finds `useTimer`. `tokenizePath()` indexes path segments (path tokens weighted ×2 so a filename helps ranking without swamping the code).
- **`buildIndex()` / `search()` — real BM25** (`k1=1.5`, `b=0.75`, standard defaults). Fixes both failures of raw term frequency: **tf saturation** (30 hits ≠ 30× more relevant) and **IDF** (a term in every file is worthless; a term in one file is a signal). Chunks are 40-line overlapping windows that keep `startLine`/`endLine`, so the model knows exactly where a snippet came from. Hits are **collapsed to one per file** (best + at most one close runner-up recorded as `extraChunks`) so three near-identical windows cannot eat the budget.
- **`buildGraph()`** — import/dependency edges with **extensionless resolution** (`./useTimer` → `src/hooks/useTimer.js`, plus `/index.*`). Answers *"what else breaks if I change this file?"*, which substring counting never could. Bare package imports are correctly ignored (nothing in-repo to resolve).
- **`extractSymbols()` / `describeFile()`** — regex symbol + **Express route** extraction (`GET /api/items`). Feeds the model navigation hints instead of making it re-read everything.
- **`retrieveContext()`** — assembles `=== RELEVANT CODE (BM25 retrieval, N chunks) ===` with per-hit `[matched: …]` terms, plus a `=== CODE MAP (symbols + what imports what — read these before editing) ===` section. Returns `{block, empty, hits, stats}` so a caller can tell *"found relevant code"* from *"found nothing"* — a block that merely looks like context is exactly how the old scorer misled the model. **When nothing matches it returns an empty block rather than padding with irrelevant files.**

**P2.1 — the hydration gap.** `projectFiles` came straight off `req.body`, so it was only as complete as the caller happened to send — which is why retrieval silently degraded to "no relevant code" for any caller that omitted it. Now, when the body has none: hydrate from the **SQLite workspace store** first, then from disk via `readWorkspaceFiles()` (bounded: ≤120 files, ≤120KB each, ≤900KB total, 6 levels, skips `node_modules`/`.git`/`dist`/… — this runs on the request path before the first token is emitted, so an unbounded read would stall the SSE stream).

**Wired into** `/api/agent/run`: emits a new SSE event **`code_context` (`{hits, stats}`)** so the UI can show *why* those files were chosen. Server log: `BM25 retrieval: N hit(s) across M chunks (T terms, ~K tokens, Xms)`.

**Measured head-to-head** (`temp_ui_audit/prove_p2_retrieval.js`, old scorer reproduced verbatim vs BM25, realistic repo): **top-1 accuracy 3/5 → 4/5**. The decisive case is `setInterval countdown timer`: the old scorer ranked the **consumer** (`components/Timer.jsx`) first; BM25 ranks the **definition** (`hooks/useTimer.js`) first — knowing *where it is defined* vs merely *that it is used*. Both correctly return **nothing** for a query absent from the repo (no hallucination). Live run (`p1-final-01`, client sent **no** `projectFiles`): `code_context: 6 hit(s)`, 10 files / 14 chunks / 320 terms indexed, 1255 tokens, **12ms**, top hit `src/App.jsx`.

- Tests: `backend/tests/codeContextRetrieval.test.js` (28 — camel/snake tokenization, line provenance, BM25 ranking + IDF + determinism + per-file collapse, junk-file skipping, extensionless import resolution, symbol/route extraction, budget monotonicity, "empty is honest", degenerate-input safety) → backend unit **210/210 (42 suites)**; integration 64/65 (same pre-existing memory-route failure); frontend unchanged 54 suites / 425 tests; eslint 0/0.
- **Known remaining gap (P3)**: the `step === 0` greenfield **and** existing-project short-circuits (`routes/agent.js` `isGreenfieldScaffold` / `hasExistingFiles && !isExplicitNewProject`) still `return` immediately after scaffolding — so the ReAct loop (and therefore the P1 repair loop) never runs on those prompts. A modification request is rewritten by one `callScaffoldLLM` full-rewrite pass and reports `done` with **no verification at all** — visible in the live P2 run (`install events: false, verification verdict: false`). P0/P1 evidence exists only on the greenfield scaffold path.

### 22. P3 — True ReAct loop (2026-10-07) *"modifications get the same proof as scaffolds"*

The P2 documentation ended with the gap that this phase closes: **verification evidence existed only on the greenfield scaffold path.** Both step-0 short-circuits hard-returned, so the ReAct loop (and with it P0/P1 verification + repair) never ran on the two most common prompt types.

**P3.1 — Greenfield: return only when verified.** `if (toolResult.verified)` is now the gate. An unverified scaffold **falls through into the ReAct loop** with the real failure evidence in the observation, so the model repairs it with tools. `plan.tasks.forEach(completed)` lives strictly inside the verified branch.

**P3.2 — Existing-project one-shot rewrite: deleted.** The old path dumped **every file** into one prompt, asked for complete rewrites, wrote them to disk (bypassing the `write_file` guard that refuses overwrites of existing files), and reported `done` with **zero** verification. Replaced by a normal ReAct turn with explicit ground rules (`read_file` the exact file first, `apply_diff` verbatim search/replace only, change only what was asked, prove with `npm run build`). Every edit now goes through `deterministicCodeGuard` + path security — and the evidence gate runs before completion.

**P3.3 — Evidence gate before `done`.** `verifyRunOutcome()` in `routes/agent.js` runs `runtimeBridge.verifyBuild` (+ the P1 repair loop) whenever a run touched code files. Wired into the `FINAL_ANSWER` branch AND the loop-exhaustion path. Skips honestly when nothing changed; **reuses** the scaffold's fresh verification instead of paying ~10s for a duplicate build + Chromium launch (`alreadyVerified` + `initialVerification` plumbing). Emits a structured `verification` SSE event + `verified` flag on `done`.

**P3.4 — Real budget.** `MAX_STEPS` now comes from `req.body.maxSteps` (clamped 1–100) instead of a magic 50; `maxRepairAttempts` clamped 0–5; both advertised in `run_started { budget, context }` so the UI meter is honest.

**P3.5 — Provider errors are never an answer.** Two-tier failure: (a) every provider service resolves an error **string** instead of throwing, so a dead key looks like a short answer — `callLLM`'s own `isErrorResp` list missed `Invalid API Key` / `Service Error`; (b) `parseLLMAction`'s raw-text fallback then turned that string into `FINAL_ANSWER`, so a run "completed" with `Mistral Service Error: {"detail":"Invalid API Key"}` as its result. Now a single shared `isProviderErrorResponse()` (substring + structured-envelope detection) is used by both `callLLM` and `parseLLMAction`; the loop retries the cascade twice on `__PROVIDER_ERROR__` and then aborts with the real reason, instead of a fake success. Live bug that motivated this: a run ended with `GROQ_RATE_LIMITED` / Mistral `Invalid API Key` as the "answer".

**package.json repair → forced re-install.** When a repair rewrites `package.json`, the next build would run against a stale `node_modules` and fail with `'vite' is not recognized` forever — and the model's workaround was to rewrite the build script as `npm install && vite build`, hiding the harness bug inside the project. Now `projectRepair.manifestChanged(written)` forces `runtimeBridge.installDependencies(dir)` before the next build.

- Tests: `backend/tests/reactLoopStructure.test.js` (17 — static audits of every P3 invariant: one-shot rewrite is gone, greenfield gates on verified, provider-error ordering in parseLLMAction, honest abort, FINAL_ANSWER + exhaustion evidence gates, changed-file tracking, clamped budget, manifest re-install wiring) + `verificationRepair.test.js` +5 (manifestChanged, initialVerification skip + still-reverify-after-repair) → backend unit **234/234 (49 suites)**; integration 64/65 (same pre-existing memory-route failure); frontend unchanged 54 suites / 425 tests; eslint 0/0.
- **Live proof**: modification prompt on an existing project now produces `Verify: building the project…` → `❌ npm run build FAILED (exit 1)` → 3 repair attempts with real re-verification → honest `⚠️ Not verified` report with verbatim compiler output. Greenfield dedup: the final `Self-Heal … build passed` duplicate verify is gone.
- **Known remaining gap (P4 — speed)**: fresh `npm install` took 218s in the live run. Persistent node_modules / dependency caching is the next target; without it every run pays minutes before a token of code changes.

### 23. P4 — Speed & Feedback: persistent deps + shared cache (2026-10-07) *"the 218s problem"*

Live measurement exposed the real cost: a fresh `npm install` for the golden scaffold's standard Vite + React + Express dep set took **218s on this machine**, paid on EVERY run. Two root causes, both fixed.

**P4.1 — Persistent node_modules (the dominant win).** The regeneration cleanup deleted every non-dotfile in the workspace — including `node_modules`. So a regenerate prompt paid a full reinstall. Now `node_modules` survives regeneration; the next install becomes `npm rebuild` only. **Measured: ~218s → ~4s (54x).**

**P4.2 — Shared signature-keyed dependency cache (cross-project win).** `%TEMP%\aidost-deps-cache\<sha256-16>` stores a node_modules snapshot per dependency set. Key correctness rules: written **only after** a real install exited 0, read **only through** the `.ready` marker (a partial copy is never served), guarded by a `.lock` marker so concurrent installs never interleave. Override root with `AIDOST_DEPS_CACHE`.

**P4.3 — The copy is the honest bottleneck.** `fs.cpSync` measured **146s** on 52,210 files — nearly as expensive as installing. `robocopy /E /MT:16` does it in **38s** (4x). `copyTreeFast()` uses robocopy on Windows (exit codes 0–7 = success, 8+ = error), falls back to `fs.cpSync` elsewhere. **Never ship a cache whose copy costs more than the install it replaces** — the cpSync-first version of this cache was exactly that.

**P4.4 — Superset seeding (exact-match is the usual miss).** An LLM almost always adds one extra package, which changed the exact signature → miss. Each cache entry now stores `manifest.json`, and `findCacheCandidate()` finds a cached set covering ≥60% of the needed packages (highest coverage wins, fewest extras breaks ties). Seed from it, then `npm install` reconciles only the delta. **Measured: 88% coverage → 78s vs 218s (3x).**

Final hierarchy on this machine:

| Path | Time | vs cold 218s |
|---|---|---|
| Same project regenerate (node_modules preserved) | **~4s** | **54x** |
| New project, deps ⊆ cached set (superset) | **~78s** | **3x** |
| New project, exact cached set | **~53s** | **4x** |
| New project, brand-new dep set | ~218s | 1x |

- New APIs in `runtimeBridge`: `dependencySignature`, `depsCacheRoot`, `depsCacheDirFor`, `copyTreeFast`, `seedFromDependencyCache` (async), `recordDependencyCache`, `findCacheCandidate`, `manifestFor`.
- Tests: `backend/tests/dependencyCache.test.js` (16 — signature determinism/order-freedom/version-sensitivity, `.ready`-only serving, no-throw on corrupt cache, copy engine reporting, superset candidate selection + coverage floor + junk safety, regeneration preserves node_modules, rebuild-only short-circuit) → backend unit **250/250 (54 suites)**; integration 64/65 (same pre-existing memory-route failure); frontend unchanged 54 suites / 425 tests; eslint 0/0.
- **Honest note**: cache-hit still costs ~40–60s (copy + rebuild) — real, but not Bolt's WebContainer instant. The next frontier is a persistent dev server + HMR so a run starts an already-running app instead of booting one (needs long-lived processes + port management; deliberately not hacked into the scaffold path because a leaked dev server is worse than a slow install).

### 24. P5 — Live preview + self-learning fix memory (2026-10-07) *"the app must actually run, and get smarter every time it doesn't"*

**P5.1 — Live preview.** After a run's verification passes, `ensureLivePreview()` (`routes/agent.js`) starts a real dev server through `devServerManager` and emits SSE `dev_server {state, url, reused, hostPort}` — the DONE message carries a **Live Preview URL**. `ensureLivePreview` **reuses a READY server** for the same project (no duplicate spawns), takes `dir: workspacePath` (the old out-of-scope `targetDir` ReferenceError landed in the loop's catch → run "failed" *after* passing verification) and is wrapped in try/catch — a preview problem never fails an already-verified run. Greenfield scope fixed too: `isGreenfieldScaffold = isExplicitNewProject || (!hasExistingFiles && !isExistingProjectModification)` so an explicit "create a new app" greenfields even when the workspace already has files (before this it fell to the bare loop → no verification, no preview).

The preview is served through the existing `GET /api/preview/:projectId/*` proxy, which needed three real fixes before a browser could actually render anything:

1. **8.3 short-path mismatch (blank preview, raw JSX shipped).** Spawn cwd was `%TEMP%\agent-ws-…` in its **8.3 form** (`VIKASH~1`) while vite resolves module ids through `fs.realpathSync.native` (long form `vikash kumar`) → vite's `fs.allow` rejected every module. Fix: dev server spawns from `fs.realpathSync.native(rawWsDir)` (`sandbox/devServerManager.js`). Same trap exists on this machine because `TEMP` is short while `USERPROFILE`/`homedir` are long — `fs.realpathSync` does NOT expand 8.3, `fs.realpathSync.native` DOES.
2. **CORS on same-origin module fetches.** Chromium sends `Origin` even on same-origin module-script fetches; `security-hardening.js` only allow-listed :3000 → every proxied sub-module 500'd `CORS origin is not allowed`. Fix: `selfOrigins()` unions `http://localhost:${PORT||5000}` into the allowlist.
3. **URL rewriting — regex was the wrong tool for JS.** The proxy must prefix root-absolute URLs with `/api/preview/<id>/` (vite `base` was rejected: it changes semantics for every caller — sandbox, npm fallback, static — while the request-time prefix adapts). HTML/CSS keep the regex `rewriteProxiedUrls` (string-literal-only + CSS `url()`; a `(quote-or-paren)/` rule had corrupted `.render(/* @__PURE__ */ …)` comments). **JS now goes through `rewriteJsModule` — an acorn AST pass.** Regex-rewriting arbitrary JS is a losing game; each of these looked like a root-absolute string opener and each corrupted a *real* served bundle → `Invalid regular expression flags` → blank preview:
   - `/"` — a quote **inside a regex body** (`replace(/"/g, "&quot;")`),
   - `)"/g` — a regex **closer followed by flags** (`…+)"​/g, {`),
   - `(/*` — a comment after a call paren.
   The AST walk rewrites only genuine string literals and expression-less template literals (back-to-front ranges; `inner` INCLUDES the leading slash — the regex path's capture did not, which produced a `//` double-slash bug caught by the first test run). Unparseable input is served **UNREWRITTEN** (a loud failure beats a silent corruption), with module→script parse fallback; `/api/*` + `/socket.io/*` are never prefixed; `accept-encoding` deleted (buffered body); 8MB cap with unrewritten fallback.

**P5.2 — Fix memory.** `services/fixMemory.js`: `errorSignature()` normalizes (durations → extension-bearing paths → mixed-alnum hash-before-extension → line:col → bare ≥2-digit numbers), `learnFix` records only **successful** repairs (`kind:'fix'` in the delete-proof `copilot_notes` table), and `retrieveFix`/`formatFix` inject known fixes into the repair prompt **before** `requestRepair` spends an LLM call — same error as yesterday costs zero tokens today.

**Live proofs** (`temp_ui_audit/e2e_p0_run.js`, `check_live_preview.js`, `scan_proxy_deep.js`): run `p5-live` (48.5s) and fresh `p5-live-2` (97s) — `verification verdict: true` → `dev_server READY` → proxied preview **HTTP 200, `#root children: 1`** with the full app UI text, **0 page errors, 0 failed requests**, deep module scan 0 parse failures.

- **HMR WebSocket — FIXED (2026-10-07; ye section ka last honest gap tha)**: vite ka pehla ws attempt `ws://host/?token=X` hota hai — na project path, na Referer (WS handshake me aata hi nahi) → backend catch-all socket destroy karta tha → console error → vite ka direct-fallback (`ws://localhost:<hostPort>`) se HMR chal raha tha (double attempt + noise). Fix: proxy `/@vite/client` serve karte waqt `wsToken` literal nikal ke `devServerManager.registerHmrToken(projectId, token)`; `server.js` upgrade handler `?token=` se project resolve karke existing TCP forwarder se pipe karta hai → **first attempt pe hi 101**. Forward me vite ke saare gates satisfy hote hain (`Sec-WebSocket-Protocol: vite-hmr`, `pathname === base`, `hasValidToken`, `isHostAllowed` — Host rewrite `127.0.0.1:<port>` pehle se tha). Proof: `temp_ui_audit/probe_hmr_ws_open.js` → `OPEN (backend-proxied HMR works)`; `check_live_preview` → **0 console errors** (pehle 1). Token map self-heals (har full page load `/@vite/client` dobara register karta hai).
- Tests: `backend/tests/persistentRuntimeLearning.test.js` → **34** (fix-memory learn/retrieve/signature + wiring audits + preview rewrite regex-safety + **AST rewrite regressions** for the three corruption patterns + CORS `selfOrigins` + 8.3-path + **HMR upgrade routing**: token round-trip + proxy-register/server-resolve wiring) → backend unit **284/284 (61 suites)**; integration 64/65 (same pre-existing memory-route failure); frontend 54 suites / 425 tests; eslint 0/0. Proxies: `devServerProxy.test.js` 10/10.
- Gotcha: backend must be **restarted** after edits to `routes/agent.js` / `routes/preview.js` / `security-hardening.js` (boot ≈30s).

## 25. P6 — Instant in-browser run (WebContainer) (2026-10-08)

Bolt/Replit-style "preview without install", honestly gated on StackBlitz's engine.

- **Wrapper**: `backend/routes/instant.js` — `GET /instant/:id` serves a standalone shell with `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (crossOriginIsolated=true), loads the app in an iframe + postMessage bridge (phase events → `instant-chip` in PreviewPane).
- **Engine**: `@webcontainer/api@1.6.4` vendored same-origin at `/wc/*`, boots WITHOUT an API key (`DEFAULT_EDITOR_ORIGIN = 'https://stackblitz.com'`). Files API `/instant/:id/files/*` pushes the project in.
- **Outage honesty (2026-10-08)**: StackBlitz `/headless` engine endpoint returned a genuine 404 (their site root still 200 — their outage, not ours). Instead of hanging: `GET /api/instant/engine-status` (5s timeout, 30s cache) + wrapper preflight + 45s boot-handshake `Promise.race` → truthful error card ("engine unreachable — switch Mode to Proxy"). Recovers with zero code changes when they fix it.
- **PreviewPane**: mode cycle `auto→live→instant→mock`; `INSTANT_BASE = NEXT_PUBLIC_BACKEND_URL || http://localhost:5000` — wrapper loaded from the backend DIRECT (Next rewrites aren't trusted to forward COOP/COEP headers).
- Tests: 4 P6 integration + 1 engine-status + `previewInstant.test.jsx` 6.

## 26. P7 — Durable dev servers + share URL (2026-10-08)

- `services/shareTunnel.js`: cloudflared quick tunnel (primary) + serveo fallback → public https URL for a running dev server; `routes/share.js` + `ide/ShareButton.jsx` (create/status/cancel + copy).
- **Security**: scoped proxy strips tunnel identity headers (XFF/Origin/Referer/cf-*) before proxying; path allowlist + timing-safe share-key gate stay the boundary (share403 fix).
- `devServerManager` persists READY server PIDs + ports; `server.js` restores them on boot (always-on feel).
- **Gotcha**: share records live in memory → re-share after a backend restart.
- Tests: `shareTunnel.test.js` + `shareButton.test.jsx` 6/6.

## 27. P8 — Yjs multiplayer + agent-as-participant (2026-10-08)

Two humans + the agent in the same editor, live.

**Backend**
- `services/collabDoc.js` — y-websocket wire protocol **hand-rolled** (y-websocket v3's exports map hides `bin/utils`): MESSAGE_SYNC + MESSAGE_AWARENESS via `y-protocols`/`lib0`. One Y.Text per file, key `file:<relativePath>`.
- Route: `server.js` upgrade chain claims `/yws/:projectId` FIRST (`socket.__upgradeHandled = true` before preview/HMR guessing — otherwise the catch-all destroys the socket).
- Persistence: debounced 1s snapshot → `collab_docs` BLOB (migration `012`); immediate flush when the last connection leaves; corrupt state ignored on load.
- **Agent as participant**: `routes/agent.js` `send()` hook — every `file_written`/`file_changed` (events carry full `content`) → `collabDoc.applyFile()` → shared doc + server awareness `{name:'AI-Dost Agent', color:'#6366f1', agent:true, editing:<file>}` auto-cleared 20s after the last write. Connected humans see agent edits live AND in the presence strip.
- **Gotcha**: a WS close arriving after `_resetForTests()`/shutdown tried to persist on a closed DB — guard `rooms.get(projectId) !== room` before touching storage.

**Frontend**
- `lib/collabClient.js`: singleton `getCollab` per project (WebsocketProvider → `ws://…/yws/<id>`), `bindCurrentModel`, `subscribeParticipants`, `destroySession`. Browser-guarded (`typeof window`) — SSR must never construct a socket.
- **First-touch rule** `syncInitialDecision(ytext, model)`: doc empty → seed from model; doc has text → `model.setValue(doc)`; same → noop. Runs BEFORE `new MonacoBinding(...)` — y-monaco does NOT reconcile on construction; a diverged start corrupts silently later.
- MonacoBinding's third arg is a **Set**: `new Set([editor])`.
- CopilotIDE: rebind effect `[projectId, activePath]` (single Monaco model — there is NO `path` prop — so a file switch = rebind the same model) + a mount-time bind (covers editor remounts) + presence strip `data-testid="collab-presence"` with **signature dedupe** (awareness `change` fires on every remote cursor move — setState only when name/agent/editing identity changes, or a 4000-line component re-renders per keystroke).
- Known limits: files changed on disk by paths that emit neither `file_written` nor the save route never reach the doc (doc wins at the next bind); rooms accumulate per visited project (no idle eviction — fine at personal scale).
- Tests: `collabDoc.test.js` 10 (mirroring, broadcast frames, agent presence, restart round-trip) + integration 2 (**real sockets**: step-1 handshake, client→server update, agent→client push) + `collabClient.test.js` 18 (pure helpers, wiring audits, backend contract cross-check — yjs/y-websocket/y-monaco mocked, zero sockets).

## 28. P9 — Background runs + browser/git/PR tools (2026-10-08)

**Background runs (outlive the socket/refresh)**
- Storage: `copilot_runs` / `copilot_run_events` (migration `011_task_events`) — **NOT `agent_runs`**: migration 002 owns that name with a different schema and `CREATE TABLE IF NOT EXISTS` silently skips → "no such column: project_id" explosion. (Same session: `git checkout HEAD --` to restore files — `git show > file` writes UTF-16 on this box.)
- Run identity minted at request entry (before any await) — the `send()` closure and the disconnect handler share it.
- `background:true` → `detached=true`: `isAborted` never set, every event `backgroundRuns.record()` BEFORE the abort check, ReAct keeps stepping. `done` is terminal (`completed:false` → `failed`), first-finish-wins (idempotent), Telegram notify only when `background && detached && firstFinish`. `markInterrupted()` flips stale `running` rows after a restart.
- Replay: `GET /api/agent/runs/:id` + `GET /api/agent/runs/:id/events` SSE (history then live tail, `?after=` cursor, keepalive 4s, 60min cap).
- Frontend `lib/backgroundRun.js`: toggle persisted (`ai_dost_copilot_background`), save on `run_started`, clear ONLY on a live `done`, auto-reattach on mount (status probe → replay/tail via pure `eventToActions`).
- Stop semantics: aborting the fetch on a background run = detach (keeps running); a real cancel goes through `taskCancellation.js`.

**Tools (`executeTool` switch in `routes/agent.js`, prompt entries 21–29)**
- `services/browserTool.js` — persistent headless Chromium: `browser_navigate/snapshot/click/type/screenshot/close`. SSRF policy (pure, unit-tested): http(s) only, no URL credentials, **loopback on any port allowed** (preview verification is the point), literal private/link-local/metadata IPs blocked, public hostnames DNS-gated (every resolved address must be loopback-or-public). 10min idle auto-close. Snapshot = URL/title/text + up to 40 interactive elements with selector hints + recent console errors.
- `services/repoTools.js` — `git_commit` / `git_push` / `create_pr`: `execFileSync` with arg arrays (no shell strings), `GIT_TERMINAL_PROMPT=0` (never hang a run on a password), identity fallback `-c user.name=AI-Dost -c user.email=aidost@local` scoped per commit. **Honest tiers**: no remote → `pushed:false` + the exact next command; no `gh` CLI → branch pushed + a ready-made GitHub compare URL; never a fake success.
- **`parseLLMAction` normalizedParams is a WHITELIST** — unknown parameter keys are dropped silently. New tools needed `selector, value, message, title, body, branch, base` added (`url` already existed). The unknown-tool error string lists the new actions too.
- **Observation hygiene**: base64 screenshots go to the UI as a `screenshot` event and are REPLACED in the model observation with `[image NKB sent to UI]` — one 500KB PNG would blow the context window (this also fixed `take_screenshot`'s pre-existing flood).
- Tests: `backgroundRuns.test.js` 5 + `p9Tools.test.js` 11 (SSRF matrix, real git tiers in a temp repo, compareUrl) + integration (status/replay/cursor); frontend `backgroundRun.test.js` 17 (+ stale `copilotRetry` reattach count 4→5).

## 29. P10.1 — OpenCode free gateway + restored MoE failover (2026-10-08)

**Goal**: model-quality layer — "sabhi model se banaega" bina kisi API key ke.

- **New service** `backend/services/opencodeService.js` — backend LLM calls ko locally installed OpenCode ke headless server se route karta hai → **OpenCode platform gateway (9 free models, cost 0, no key)**. Verified live: cold 30.2s (spawn+uncached), **warm 4.5s**.
- **API contract (V1, empirically cracked)**: `GET /session` = health probe · `POST /session {directory}` (top-level `location.directory` IGNORED hota hai) → `POST /session/:id/message {parts:[{type:'text',text}], model:{providerID,modelID}, agent:'build', mode:'primary'}` → 200 `{info, parts[]}` — reply = `parts.filter(type==='text').map(text).join('')`. Basic auth `opencode:<password>`. Failures: model missing → `ProviderNoProvidersError: No providers are available` (500); parts missing → `Missing key ["parts"]` (400).
- **Rejected path**: CLI `opencode run` — cold 23–35s (title auto-gen + boot) aur `--attach` streams `step_start` ke baad marte hain (V1 CLI bug: only `step_start`, no text, client exits). `--format json` CLI ka full form bhi yahi.
- **Server lifecycle**: state file `%TEMP%/aidost-opencode-state.json` `{baseUrl,password,pid}` → backend restarts ke baad bhi SAME warm server reuse (orphan pid + `unref`). Random password per boot, `127.0.0.1` only, cwd = **scratch `%TEMP%\aidost-opencode-gen`** (sessions also run there — build agent external-directory permission `ask` → non-interactive DENIED → AI-Dost repo ko kabhi edit nahi kar sakta). Health-poll fail → fresh spawn; spawn crash → `serverPromise` reset → next call retry (self-heal). Best-effort `DELETE /session/:id` (TUI list saaf).
- **Wiring (4 cascade points)**:
  1. `routes/agent.js` `callLLM` providers[] **position 3** (groq → gemini → **opencode** → nvidia…) — keyless/rate-limited install pe strong model jaldi; `preferredModel:'opencode'` generic rotate se front aata hai.
  2. `routes/agent.js` `callScaffoldLLM` **last-resort** (filter ke baad push — `hasKey` skip na kare) + **per-provider `timeoutMs`** (opencode 50s/45s; fast providers ka 12s slot untouched) — loop ab `provider.timeoutMs || 12000`.
  3. `services/llmCascade.js` cascade tail (collaboration/MoE/self-heal helper).
  4. `services/llmCascadeService.js` **forced tier** `model==='opencode'` → sync reply ek chunk me (auto mode me OFF — auto pe sync-fallback chain se aata hai).
- **BUG FIXED — MoE failover was dead**: `moeRouterService` hamesha `require('./llmCascade').executeCascadingFailover` use karta tha jo **export hi nahi tha** → har `auto-cascade` route + har expert-failure fallback me `TypeError: executeCascadingFailover is not a function` (general chat ka failover silently mara hua tha). Restored: string-returning sequential cascade (MoE contract = string, `.match()` call karta hai; chat.js ka local `{response,winner}` variant alag hai, untouched) — **keyless providers skip BEFORE network** (`hasKey` env/custom pre-skip) → keyless install seedha **OpenCode → Ollama → honest "providers unavailable"** message.
- **Pickers**: CopilotIDE (`ai_dost_copilot_model`), ChatView, useChatView, SettingsView me "OpenCode (free gateway)" option.
- **Env** (`.env.example`): `OPENCODE_ENABLED` (false = off) · `OPENCODE_BIN` (PATH override; P0 rule — real `.exe` directly, `.cmd` → cmd.exe + literal-args guard) · `OPENCODE_PORT=4789` · `OPENCODE_MODEL=opencode/mimo-v2.6-flash-free` · `OPENCODE_TIMEOUT_MS=60000`.
- Tests: `backend/tests/opencodeCascade.test.js` → **14** (parseModel/formatHistory/assertSafeArgs/enable-flag · chat() full contract vs **mock HTTP server** — state-file reuse se binary/spawn ZERO dependency, session dir = scratch assert · HTTP-500 + empty-reply + timeout · executeCascadingFailover export + STRING contract + OpenCode-wins keyless + honest degradation · agent.js static audits: position-3 + scaffold timeout + single require) → backend unit **343/343 (74 suites)**; integration 73/1 (same pre-existing memory-route failure); frontend 58 suites / 472 tests; eslint 0/0.
- Gotchas: `test:unit` = **explicit file list** (naya test file wahan add karo warna gate chalta hi nahi) · `where opencode` → `opencode.cmd` (spawn EINVAL trap — APPDATA `.exe` candidate pehle) · `routes/agent.js` edit ke baad backend **restart** zaroori.

## 30. P10.2 — OpenRouter "sabhi model" live sweep (2026-10-08)

**User ka asli ask ye tha** (P10.1 me "opencode" wording confusion thi): OpenRouter ke **saare models check karo → add karo → backend restart**. Reproducible probe: `temp_ui_audit/check_openrouter_models.js` (key tier + har free model live-ping, 2 rounds).

- **Key ground truth**: `GET /api/v1/key` → `is_free_tier=true, limit=none` → **sirf free models chalte hain**. OpenRouter pe 468 models me **20 free** (usme 2 Lyria = music API, chat nahi) → **16 chat-able universe**.
- **Catalog = exactly wahi 16** (`services/openrouterService.js` FREE_MODELS):
  - **ADD (1)**: `ling_3_1_flash` → `inclusionai/ling-3.1-flash` (live-free list me naya tha; provider kabhi-kabhi "Provider returned error" deta hai — failover cover karta hai).
  - **REMOVE (7 dead, live-verified)**: `qwen_38` ("unavailable for free — use paid slug"), `inkling`/`inkling_small` ("only available on agentic harnesses" — chat/completions reject), `nemotron_embed`/`nemotron_embed_vl`/`nemotron_rerank_vl`/`mercury_decide` (wrong API type — embed/rerank/decisions chat endpoint accept hi nahi karta).
  - ChatView picker se bhi wahi 7 entries hata di (warna picker raw key bhejta → resolve → 404); SettingsView/CopilotIDE me the hi nahi. Naya option: ChatView Reasoning group + SettingsView.
- **DEFAULT_FALLBACK_CASCADE = 10 live-verified general models**: super (295ms) → openrouter/free (380ms) → ultra (403ms) → lightning → dots → lfm → north-mini-code → nano-omni → sante → apodex. `content-safety` yahan se **hataya** — wo classifier model hai jo chat fallback me `"User Safety: safe"` jaisa junk reply deta hai (catalog me specialized option ki tarah raha).
- **Live ping verdict**: 10/23 first-round pass; `nano-omni` = transient rate-limit (retry me OK ✓); `laguna`×2 + `gemma`×2 + `ling-3.1` = 2/2 rounds "Provider returned error" (legit free + correct API — provider outage; catalog me rakhe, cascade me nahi); `qwen3.8`/inkling/embed/rerank/mercury = permanent rejects (upar REMOVE wale).
- Test: `openrouterService.test.js` — catalog threshold `>=20` → `>=16` (honest, comment sahit) + **naya hygiene test** (7 dead keys gone + `ling_3_1_flash` resolve + slug-shape regex + cascade me classifier nahi) → backend unit **344/344 (74 suites)**; integration 73/1 (pre-existing); frontend jest 58/472; eslint 0/0.
- Gotcha: `threeJsSimulator.js` me "tw**inkling**" grep se false-positive aata hai — us file ko chhoo mat.

## 31. P11 A1 — "Aurora" from-scratch copilot cockpit (2026-10-08)

**Ask**: P10 wada — Replit + Devin + Bolt hybrid "ultra" copilot **+ suru se NAYA UI/UX**. **Order decision (user ne pucha): PEHLE FRONTEND** — kyunki (1) P0–P9 me backend ka "Devin brain" + model layer (P10.1/P10.2) ready hai, missing sirf uska face hai; (2) SSE/REST contract stable hai → naya UI existing APIs pe immediate ban sakta hai; (3) UI banate waqt jo gaps dikhte hain backend ke wahi P12 slices honge (contract-first). Backend P12 = marathon runs, issue→fix→PR, evals 5→50 (A2-A5 ke baad).

- **New tree** `frontend/components/aurora/` — CopilotIDE ka 4658-line monolith **untouched**: `CopilotAurora.jsx` (root: rail │ spine+composer │ stage; props contract = `projectId/projectName/onToast` same as CopilotIDE), `AuroraRail.jsx` (plan checklist + Classic escape), `AgentStream.jsx` (run spine), `AuroraStage.jsx` (Preview/Files tabs), `Aurora.module.css` (structure only — saare color/radius/motion `styles/tokens.css` se, koi naya hex nahi).
- **Design**: type roles = Sora (project identity) / Inter (UI) / **JetBrains Mono = machine facts** (paths, exit codes, +N−N, timers — cockpit ki voice). **Signature = run spine**: har event ek vertical rail pe node — grey=think/read, indigo=write/fix, cyan=read, red=build fail, green=verified; last node live pulse + header green dot. Header = **instrument** (plan progress track `--gemini-gradient` + step n/m + ticking mono timer + Stop). Ek hi live element; baaki sab quiet chrome. Verdict colors sirf real verdicts pe.
- **Flag**: `localStorage ai_dost_copilot_ui='classic'` → CopilotIDE; default **aurora**. `pages/dashboard.jsx`: state `'aurora'` + post-mount effect se flag read (**hydration mismatch nahi** — server/first-paint hamesha aurora), `dynamic({ssr:false, loading: ViewSkeletonLoader type="ide"})`. Classic ke 13 test suites CopilotIDE directly mount karte hain → flag gate-safe. Escape hatch: rail ka `Classic UI` button (flag write + reload).
- **A1 = full shell on MOCK run data** (MOCK_PLAN 6 tasks / MOCK_EVENTS 7 rows / MOCK_FILES 3) — interactions live (composer send → spine me user row, stage tabs, stop idempotent + status row, perm segment). **A2** = real SSE `/api/agent/run` wiring · **A3** = live preview + file diffs (P5/P6 reuse) · **A4** = Cmd+K palette, keyboard map, responsive · **A5** = parity → default flip decision.
- **Bug caught in LIVE visual review (CSS cascade)**: media query block file ke TOP pe tha → same specificity me base `.stage{display:flex}` (baad me likha) jeet gaya → narrow viewport pe `display:none` dead → stage rail ke neeche stack. **Rule: CSS module me responsive/media blocks hamesha file ke END me** (regression comment file me bhi hai).
- **Gotcha**: browser localStorage me pehle se `ai_dost_copilot_ui='classic'` mila (purana write — koi bhi ho) → default-aurora verify karne se pehle key check/remove karo, warna classic render hota hai aur confusion hoti hai.
- **Live verify**: narrow branch (<1180px) = clean 2-col (rail+spine, stage hidden) screenshot ✓; 3-pane placement = forced-override se verify (test viewport 950px hai — real ≥1180px screens pe main column full milta hai). Turbopack CSS HMR se fix bina reload ke live.
- Tests: `frontend/tests/copilotAurora.test.jsx` → **6** (shell/rail/head/instrument + composer Enter appends `data-kind=user` row + stage tab switch + stop idempotent + classic flag write + perm segment). Gates: frontend jest **59 suites / 478 tests**, eslint 0/0.

## 32. P11 A2 — Aurora on the REAL run stream (2026-10-08)

**Ask**: A1 ka mock hatao — composer se live `POST /api/agent/run` (SSE), real plan + file diffs + Stop + approval.

- **New files**: `components/aurora/auroraRun.js` — **pure mapper** (`mapRunEvent` SSE data → actions `{op: row|plan|task|planAllDone|file|runId|approval|unknown|end}`, `normPlanTasks`, `buildChatHistory`) + `components/aurora/useAuroraRun.js` (hook: SSE ReadableStream loop, rows/plan/files/running/elapsed/approval state, timer tied to real run lifetime). `CopilotAurora.jsx` rewritten on the hook — **MOCK_* constants deleted**, idle = single `ready` row (honest empty state).
- **Request contract** (verified against CopilotIDE run loop): body `{userPrompt, projectId, taskId, chatHistory, copilotDirector:true, permissionLevel, preferredModel:'auto'}` + header `x-ai-dost-task-id` (`aurora-<b36>`); terminal `done/error/director_complete/director_canceled` → end-op breaks stream (reader.cancel). Unknown event types: **first 2 per type as rows, then counted — never silently dropped**.
- **Stop** = `lib/copilotStop.cancelAgentRun` (local AbortController + `POST /api/chat/tasks/:id/cancel`) — live verified 200 + `stopping run…`/`run stopped` rows + timer freeze + Stop disable. **Approval gate**: `gate_approval_required {gate.approval_token}` → amber banner (`approval-banner` / `approve-btn` / `reject-btn`) → Approve re-POSTs with `approvalToken` + `skipUserRow` (no duplicate user row; bypasses running-guard in case the paused stream is still open). **Files stage**: `file_written/file_changed` → `contentsRef` prev → `lib/lineDiff` stats → spine row meta `NEW` / `+N −M` + Files-tab entries (upsert per path).
- **Bugs caught LIVE (this is why live verify > unit tests)**:
  1. `director_plan` (`CopilotDirector.js:268`) maps tasks → `{id, specialty, role, dependsOn}` — **NO objective/title** → rail showed "Task 1/Task 2". Fix: label chain `objective||title||name||specialty||description||text` + **plain-string task** support (`typeof t === 'string'`).
  2. `PlannerExecutionLoop.js:108` emits `step` with **top-level** `{tool, description, status}` (NO `stepLog` wrapper!) → rows rendered blank "step step". Fix: mapper reads both shapes; `status:'running'` frames **collapsed** (loop fires running + done per step — running-drop keeps spine quiet).
  3. Header `STEP_KINDS` missed `'step'` → meter said `steps 1` while 10 step rows existed.
  4. Unit-caught: unknown-op embedded a `row()` *action-object* as the row (nested `{op,row}` → broken render) → plain row object.
  5. lint `react-hooks/refs`: `runIdRef.current` in render return → `runId` became **state** (reactive + rule-clean).
- **Live verify (3 real runs vs :5000)**: run-1 full completion — `done · 2 task(s) completed with verification`, plan → 2/2 (planAllDone), Stop auto-disabled, timer froze 0:27; run-2 Stop mid-run → cancel **200** (`aurora-muzpo7do-8i73u0`); run-3 specialty labels (`requirements/frontend/testing`) + step details (`list_directory · Inspect existing workspace files…`, `write_file · Create test script file`) + `write test_timer.js NEW` + steps meter 9.
- Tests: `frontend/tests/copilotAurora.test.jsx` → **11** (idle honesty — no fake timer/steps + SSE request contract incl. `perm-turbo` → body `permissionLevel` + event mapping → spine/plan/files/steps + Stop abort&cancel + approval resume + stage tabs + classic flag + pure-mapper: normPlanTasks statuses / director-specialty+string tasks / unknown op / chatHistory filter / both step shapes). Gates: frontend jest **59 suites / 482 tests**, eslint 0/0 (backend untouched — 344/344).
- **Next**: **A3** live preview + real file diffs in the stage (reuse P5/P6) · A4 Cmd+K palette/keyboard/responsive · A5 parity → default flip.

## 33. P11 A3 — Aurora stage: live preview + real file diffs + Start/Stop controls (2026-10-09)

**Ask**: stage ab placeholder nahi — Bolt-style preview (static → live) + asli file diffs + preview server Start/Stop.

- **Design**: Aurora-native minimal preview (classic `PreviewPane` ke 529-line props coupling se deliberate bachav). Auto mode: run stream ka `dev_server` READY → iframe `/api/preview/:projectId` proxy (`data-mode="live"`); warna static `generateLiveAppHtml(files, contents)` srcdoc; FAILED → static fallback + red chip. Files tab: file row = `<button aria-expanded>` → inline unified diff (`lib/lineDiff`, `MAX_DIFF_LINES=400`, `MAX_DIFF_CHARS=300000` → `nodiff` stats-only). Mount-time probe `GET /api/preview/:projectId/status` → P7-persisted server adopt (live before first run; non-JSON guarded).
- **Start/Stop preview controls** (A3 ka core addition): preview bar me Start (state null/STOPPED/FAILED) / Stop (READY), STARTING me chip "Booting preview…"; empty state me labeled Start button + honest FAILED line. Contract = wahi jo CopilotIDE ship karta hai: `POST /api/preview/:id/dev/start {projectPath:'.'}` → `{success, ok, url, hostPort}` / `dev/stop` → STOPPED. `previewBusy` double-click guard.
- **Discovery1 — director path kabhi `dev_server` emit NAHI karta**: `ensureLivePreview` (routes/agent.js:1965) sirf scaffold/ReAct routes (:2124/:3657) se call hota hai — `copilotDirectorHandler` me nahi. Fix frontend-side: stage khud preview lifecycle chalata hai (Start button) — backend P12 me director-run auto-preview ka option.
- **Discovery 2 — director run me `file_written` tabhi absent hote hain jab writes REJECT ho**: `deterministicCodeGuard` ("Full-file replacement is forbidden for existing project files") → `output.success:false` → `ExecutionController.js:295` emit skip. Files tab khali = CORRECT behavior, A3 wiring galat nahi (steps live aa rahe the + 15 unit tests). Live proof ke liye Naya filename maango.
- **Discovery 3 — duplicate row keys fix** (`Encountered two children with the same key, r7` — live console me6× + tests me bhi): `pushRow` updater ke **andar** `id: r${seqRef.current}` padhta tha — React batching me queued updaters sab ek hi FINAL seqRef value padhte the → same id → duplicate keys. Fix: id queueing se **pehle** capture (`const id = ...; setRows(prev => [...base, {id, ...r}])`) + regression test (8 batched SSE events → zero 'same key' console.error). `pushUserRow` me bhi same fix.
- **Discovery 4 — empty-state FAILED invisibility**: preview bar (chip) sirf `live || srcDoc` pe render hota hai → FAILED + no files me failure sirf spine row pe dikhta tha (UI pretend karta hai kuch hua hi nahi). Ab empty state me red line `preview server failed — <reason>` + retry Start.
- **Discovery 5 (verify-time gotcha)**: PowerShell5 `Out-File -Encoding utf8` **BOM** likhta hai → `JSON.parse` throws → devServerManager detection `static` fallback → "No dev server configuration detected". Workspace me file likhne ho to node `fs.writeFileSync` use karo.
- **Live verify** (servers restart ke baad, tab `localhost:3000/dashboard`): FAILED path — Start → honest empty-state line + spine row + retry ✓; SUCCESS path — workspace me `package.json` (scripts.dev=vite, BOM-free) + `index.html` → Start → **`Live · :60570`, frameBody "AURORA LIVE PREVIEW OK"** (real vite page, proxy ke through, frame mode=live) ✓; Stop → 420ms me chip/frame gone, empty wapas, spine `preview server stopped`, backend status STOPPED ✓. Narrow viewport pe stage forced-override CSS se screenshot-captured (media rule <1180px).
- **Gotcha (live polling)**: browser.evaluate me purana FAILED text turant match hota hai — busy-phase (button disabled / "Starting…") detect karke hi outcome poll karo, warna stale text par false-fail.
- Files: `auroraRun.js` (`file` op `previous`/`isNew` meta + `dev_server` case), `useAuroraRun.js` (contents mirror, devServer state + mount probe + `startPreview`/`stopPreview`/`previewBusy`, run-scope baseline diffs), `AuroraStage.jsx` (DiffPanel + preview bar + empty start/FAILED line), `Aurora.module.css` (preview/diff + `previewStartBtn`/`previewFailText` — responsive/media blocks file ke END me rule followed), `CopilotAurora.jsx` (prop passing).
- Tests: `frontend/tests/copilotAurora.test.jsx` → **19** (15 A1+A2+initial-A3 + Start preview → POST contract → Live chip + stop-swap, Stop → honest empty, failed-start → empty-state reason line (scoped `within(aurora-preview)` — same sentence spine row me bhi hoti hai, RTL multiple-match), batched-keys regression). Gates: frontend jest **59 suites / 491 tests**, eslint 0/0; backend untouched 344/344.
- Scope: auto-start preview after `done` + mode cycle (instant/mock) = A4/A5.

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
- **Planner**: `POST /api/agent/plan` `{userPrompt}` → `{plan}` (400 if empty); `POST /api/agent/run` (SSE) — body may include `preferredModel: auto|gemini|groq|ollama` (rotates `callLLM` cascade order; failure always falls through). Agent tools include `plan_project`, `execute_plan`, `list_templates` (see `backend/services/plannerService.js` — react-vite/nextjs/astro/sveltekit templates). `GET /api/agent/tasks` → `{tasks:[]}` (Kanban state is client-side).
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

### Known-benign console noise (do NOT "fix" these)
- **`_clientMiddlewareManifest.js` MIME error**: Next.js dev bug — `next/dist/server/lib/router-utils/setup-dev-bundler.js` serves the manifest as `application/json` while the browser demands `text/javascript`. Dev-only + cosmetic (koi `middleware.js` hai hi nahi, no pageerror). Global `X-Content-Type-Options: nosniff` (`frontend/next.config.mjs`) isi liye error dikhata hai — **nosniff mat hatao**, wo security header hai.
- **`about:srcdoc` iframe warning**: `PreviewPane.jsx` ke preview iframe ka `sandbox="allow-scripts allow-same-origin ..."` — theoretically escape risk (AI-generated code parent ka `localStorage`/token padh sakta hai). Par `VisualHealer`/`VisualDebugger` ko `contentDocument` chahiye → `allow-same-origin` hatana QA + Visual Healer features tod dega. Decision: silently change NAHI, ye trade-off document rehta hai.
- **`[Violation]` logs**: dev-mode long-task warnings, perf signal only.
- **CDN `net::ERR_ABORTED` (unpkg/tailwind/fonts)**: Playwright sweeps me navigation ke waqt cancel hote hain — real failure nahi.
- **`/copilot`, `/projects`, `/history`, `/settings` 404s**: `CommandRail` client-side `onSelectView` use karta hai (router nahi) — URL-based sweep ke artifacts, real bug nahi.
- **Client-side sweep trick**: `aside button:has-text("…")` History/Settings ko MISS karta hai (aria-label-only buttons) → `aside button[aria-label="History"]` use karo.

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
 npm test                    # 491 tests / 59 suites
npm test -- --coverage      # coverage thresholds enforced (statements 18 / branches 15 / functions 14 / lines 19)

# Frontend: real-browser VisualHealer suite (Playwright + Chromium, file:// fixtures)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npx playwright test         # 13 tests — real geometry, computed styles, MutationObserver, iframe, responsive
# NOTE: tests/browser/* is Playwright-only; Jest ignores it via testPathIgnorePatterns.

# Backend: unit + integration (node:test, 0 LLM calls, ephemeral port)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
npm run test:unit           # 344 tests (unit + project/auth/settings/cache + agent run history/watch bus + copilot memory + runtime/repair/retrieval/dep-cache/fix-memory/HMR-routing + P6–P9: shareTunnel/backgroundRuns/p9Tools/collabDoc + P10.1: opencodeCascade + P10.2: openrouter sweep)
npm run test:integration    # 73 pass + 1 pre-existing fail (memory DELETE baseline; real Express app on port 0)
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
- `frontend/tests/` — 59 suites / 491 tests total: KanbanBoard (add-task + TDZ crash regression), ProjectsView (api mocked via jest.mock), AICompanion, chatContent (internal-tag + image-command stripping), copilotIde, copilotAurora (19 — P11 A1/A2/A3: idle honesty, SSE request contract, event→spine/plan/files mapping, Stop abort+cancel, approval resume, stage tabs, classic flag, pure mapper, mount probe → P7 server adopt, live proxy frame, static srcdoc + unified diff, Start/Stop preview via dev/start|dev/stop, failed-start honest line, batched-events unique-row-keys regression), copilotSessionUi (23 tests: Devin-style plan card / status strip / checklist rows / IdeFooter run meter / PreviewPane QA badge + console drawer / CopilotMarkdown code-copy + wrapCodeBlocks), appIcon (6 tests: FA svg render / size passthrough / unknown-name fallback / map validity / loader spin / brand prefix), appIconSourceAudit (4 tests: static source scan — mangled `<AppIcon>` tags + literal `name=` vs `APP_ICONS` + map validity), previewEngine (11 tests: `resolveRootAlias` + `generateLiveAppHtml` mount guard), chatSessions (5 tests: `useChatHistory` exposes `setSessionId`/`setBackendHistory`, createSession/switchSession/deleteSession crash-free), SmartChatHeader bridge, agent/task timeline+planner+runtime, taskRuntime/taskActivityOverlay (chat approval gate + completion summary + per-file diff view), chatAgentFallback (agent marker vs REST cascade + live plan attach), lineDiff (unified LCS diff), universal intent, accessibility audit, public website smoke, design system (live primitives), chatStreamStop (SSE stream abort/meta regression), copilotStop/copilotSseEvents/copilotCheckpoint/copilotAgentModes/copilotPermissions/copilotMentions/copilotSideChat/copilotRetry/copilotWatch (Devin upgrade Phase 1a–3b: stop-cancel, SSE events, checkpoint-rollback, ask-plan-code modes, permission levels + approval resume, @file mentions, /btw side chat, message retry, watch mode), copilotMemory (self-learning memory panel + backend contract cross-check), previewInstant (6 — P6 instant-mode phases/chip/engine-error), shareButton (6 — P7 share UI states), backgroundRun (17 — P9 storage/reattach/eventToActions), collabClient (18 — P8 ws-url/first-touch/bind wiring/backend contract, yjs mocked), etc.
- `jest.setup.js` polyfills TextEncoder/TextDecoder/Streams (jsdom lacks them).
- **`frontend/jest.config.js` async wrapper**: next/jest apne factory se `transformIgnorePatterns` OVERWRITE karta tha (marked@18 ESM-only → `Unexpected token 'export'`); config ab `module.exports = async () => { … }` me `createJestConfig` await karke patterns ko map karta hai — `(?!(geist|` wale pattern me `marked|` inject. jsdom me `innerText` undefined hai → clipboard/copy asserts `textContent` use karein.
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
14. `setSessionId is not defined` chat crash (2026-10-01): `useChatView.js` ke `createSession`/`switchSession`/`deleteSession` `setSessionId` + `setBackendHistory` call karte the, lekin `useChatHistory()` ye dono **return hi nahi** karti thi → har "New chat"/session switch pe ReferenceError. Fix: `useChatHistory` return me `setSessionId` + `setBackendHistory` add kiye, `useChatView` me destructure + `useCallback` deps me dono daale. Gotcha: `npm run lint` ise pakadta hi nahi (project config me `no-undef` hooks ke liye enabled nahi) — sweep chalao: `npx eslint components hooks lib context pages services utils --no-ignore --rule '{"no-undef":"error"}'` (197 files, ab 0 errors). Regression: `frontend/tests/chatSessions.test.jsx` (5 tests; `SmartChatHeader` mock zaroori — woh `@google/genai` ESM-only chain laata hai jo jest transform nahi hota).
15. Packages Manager modal silently dead (2026-10-01): FA icon migration ka broad replace `<PackagesModal` ko match kar liya → `<PackagesModal>` JSX ban gaya `<AppIcon name="package"sModal` (CopilotIDE.jsx:3355). Modal kabhi render hi nahi hota tha + console me `Unknown event handler property onUpdatePackageJson/onRunCommand` warn. Fix: `<PackagesModal` restore + `PublicNavbar.jsx:111` ka `<AppIcon name="close"className=` missing space bhi. **Kyun test nahi pakda**: `copilotIde.test.jsx` `PackagesModal` ko *directly* render karta tha — `CopilotIDE` ka render site kabhi exercise hi nahi hua. Regression: `frontend/tests/appIconSourceAudit.test.js` (4 static tests: mangled `<AppIcon name="x"Y` tags + har literal `name=` vs `APP_ICONS` + map validity) — mutation-verified (dono bugs inject karke fail hota hai).
16. `ReferenceError: App is not defined` preview mount (2026-10-01): `PreviewEngine.generateLiveAppHtml` cleaning me `export default function HomePage()` ka naam **rehte** hain (line 131 `name ? \`function ${name}\` : 'function App'`) lekin mount hardcoded `<App />` karta tha → jis generated app ka root `HomePage`/`Dashboard`/`TodoApp` ho, blank preview + uncaught error (error `root.render(<App/>)` ke evaluation pe throw hota hai — `GlobalErrorBoundary` andar catch nahi kar pata). Fix 2-layer: (a) `resolveRootAlias(appCode, cleanedCode)` exported helper → `export default <Name>` capture karke agar `App` declare NAHI hai to `const App = typeof <Name> !== 'undefined' ? <Name> : undefined;` inject; (b) render guard — `typeof App === 'undefined'` hone par readable error card + `report('RUNTIME_ERROR')`, uncaught ReferenceError nahi. **Gotcha**: edit ke time block galat jagah land ho gaya tha (`files.forEach` callback ke andar → `rootAlias` mount pe out-of-scope) — same-file duplicate-anchor edits ke baad hamesha scope grep karo. E2E verify: HomePage fixture se generated HTML Playwright me load → `HOMEPAGE MOUNTED` + 0 page errors; alias strip karne par (negative control) guard card dikhta hai. Regression: `frontend/tests/previewEngine.test.js` (11 tests).
17. Stale Phase-2d assertions inside copilotPermissions suite (caught 2026-10-04 by FULL `npx jest`, not by per-suite runs): (a) `lastRunRef.current = { prompt, attachedImages, planOverride }` → Phase 2d added `mode: 'code'` field → `toMatch` failed; (b) `rejectApproval` test sliced `rejectApproval → handleSendRef` expecting NO `runCopilot(` inside — Phase 2d inserted `retryLastRun` (which calls `runCopilot`) between them → `.not.toContain` failed. **Lesson**: static-audit tests must be rerun against the WHOLE suite after ANY later phase touches the same source regions — targeted `npx jest tests/<one>` gives false confidence. Fix: updated pattern to `mode: 'code'` form + slice endpoint `rejectApproval → retryLastRun` (retry is a separate user action). Regression: full-suite `npx jest` 52/52 green.

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