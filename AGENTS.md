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
 npm test                    # 418 tests / 53 suites
npm test -- --coverage      # coverage thresholds enforced (statements 18 / branches 15 / functions 14 / lines 19)

# Frontend: real-browser VisualHealer suite (Playwright + Chromium, file:// fixtures)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\frontend"
npx playwright test         # 13 tests — real geometry, computed styles, MutationObserver, iframe, responsive
# NOTE: tests/browser/* is Playwright-only; Jest ignores it via testPathIgnorePatterns.

# Backend: unit + integration (node:test, 0 LLM calls, ephemeral port)
cd "C:\Users\vikash kumar\Pictures\ai dost 3.0\backend"
npm run test:unit           # 140 tests / 23 suites (unit + project/auth/settings/cache + agent run history/watch bus + copilot memory)
npm run test:integration    # 65 tests (real Express app on port 0)
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
- `frontend/tests/` — 53 suites / 418 tests total: KanbanBoard (add-task + TDZ crash regression), ProjectsView (api mocked via jest.mock), AICompanion, chatContent (internal-tag + image-command stripping), copilotIde, copilotSessionUi (23 tests: Devin-style plan card / status strip / checklist rows / IdeFooter run meter / PreviewPane QA badge + console drawer / CopilotMarkdown code-copy + wrapCodeBlocks), appIcon (6 tests: FA svg render / size passthrough / unknown-name fallback / map validity / loader spin / brand prefix), appIconSourceAudit (4 tests: static source scan — mangled `<AppIcon>` tags + literal `name=` vs `APP_ICONS` + map validity), previewEngine (11 tests: `resolveRootAlias` + `generateLiveAppHtml` mount guard), chatSessions (5 tests: `useChatHistory` exposes `setSessionId`/`setBackendHistory`, createSession/switchSession/deleteSession crash-free), SmartChatHeader bridge, agent/task timeline+planner+runtime, taskRuntime/taskActivityOverlay (chat approval gate + completion summary + per-file diff view), chatAgentFallback (agent marker vs REST cascade + live plan attach), lineDiff (unified LCS diff), universal intent, accessibility audit, public website smoke, design system (live primitives), chatStreamStop (SSE stream abort/meta regression), copilotStop/copilotSseEvents/copilotCheckpoint/copilotAgentModes/copilotPermissions/copilotMentions/copilotSideChat/copilotRetry/copilotWatch (Devin upgrade Phase 1a–3b: stop-cancel, SSE events, checkpoint-rollback, ask-plan-code modes, permission levels + approval resume, @file mentions, /btw side chat, message retry, watch mode), copilotMemory (self-learning memory panel + backend contract cross-check), etc.
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