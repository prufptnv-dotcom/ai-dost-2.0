# AI-Dost v2.0 - Agent Operations Guide

## 🚀 Quick Start

```powershell
# 1. Start Backend Server
cd "C:\Users\vikash kumar\Desktop\ai-dost version 2.o\backend"
node server.js
# Server runs on: http://localhost:5000

# 2. Start Frontend
cd "C:\Users\vikash kumar\Desktop\ai-dost version 2.o\frontend"
npm run dev
# Frontend runs on: http://localhost:3001

# 3. Start Python AI Engine (LlamaIndex RAG, optional)
cd "C:\Users\vikash kumar\Desktop\ai-dost version 2.o\ai-engine"
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
- **Service Worker**: `frontend/public/sw.js` — offline shell caching, cache-first for static, network-first for API
- **Install Prompt**: Browser "Install AI-Dost" on mobile/desktop
- **Next.js Integration**: `@ducanh2912/next-pwa` with auto-register in production

### 9. Agent Memory & Learning
- **Persistent Memory**: ai-engine `/ai/agent/learn` + `/ai/agent/memory/retrieve`
- **Auto-Learn**: Telegram chat handler injects retrieved memory + auto-saves user questions
- **Corrections**: `/correct <text>` saves user corrections for future context
- **Cross-Session**: Memory persists across restarts (SQLite in ai-engine)

## ⌃ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Toggle sidebar collapse/expand |
| `Ctrl+Shift+P` | Open agent planner mode |
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
# Frontend tests
cd "C:\Users\vikash kumar\Desktop\ai-dost version 2.o\frontend"
npm test

# Backend verification
cd "C:\Users\vikash kumar\Desktop\ai-dost version 2.o\backend"
node test_apiClient.js
node test_agent_run.js

# ESLint check
cd "C:\Users\vikash kumar\Desktop\ai-dost version 2.o\frontend"
npm run lint

# Document generation test (all 5 types)
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"pdf","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"docx","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"pptx","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"csv","topic":"test"}'
curl -X POST http://localhost:5000/api/document/generate -H "Content-Type: application/json" -d '{"type":"xlsx","topic":"test"}'

# AI Engine verification
curl http://127.0.0.1:8001/health
curl -X POST http://127.0.0.1:8001/ai/xlsx/generate -H "Content-Type: application/json" -d '{"topic":"test","rows":3}'
curl -X POST http://127.0.0.1:8001/ai/web/search -H "Content-Type: application/json" -d '{"query":"test"}'
```

## 🚀 Deployment

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