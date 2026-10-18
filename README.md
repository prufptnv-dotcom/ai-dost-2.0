# 🤖 AI Dost - Autonomous AI Engineering Platform

[![CI Status](https://img.shields.io/badge/CI-Passing%20(555%2F555%20tests)-brightgreen)](https://github.com/prufptnv-dotcom/ai-dost-2.0/actions)
[![HMAC Security](https://img.shields.io/badge/Receipts-HMAC--SHA256%20Verified-blue)](docs/benchmarks/CANONICAL_APP_BENCHMARK_REPORT_OCT_2026.md)
[![Investor Audit](https://img.shields.io/badge/Showcase-Oct%202026%20Audit-orange)](docs/INVESTOR_SHOWCASE_OCT_2026.md)

> Enterprise-grade autonomous software engineering platform featuring multi-agent Supervisor/Verifier coordination, Docker container isolation, and cryptographically verified quality gates.

### 📊 Benchmark & Investor Reports
- 📑 [**Official Investor & Technical Showcase (Oct 2026)**](docs/INVESTOR_SHOWCASE_OCT_2026.md) — Honest evaluation of technical readiness, valuation criteria, and architecture.
- 🔬 [**Canonical Benchmark Report (6 Live Apps)**](docs/benchmarks/CANONICAL_APP_BENCHMARK_REPORT_OCT_2026.md) — HMAC-signed verification results for 6 standard application domains under Docker isolation.

## 🌟 Features
- 💻 **Smart Coding & Orchestration**: Multi-agent Supervisor/Verifier team with self-healing code repair
- 🛡️ **Container Sandbox Isolation**: Untrusted code executed inside secure, non-root `node:22-alpine` containers
- 🔐 **Cryptographic Evidence**: HMAC-SHA256 signed execution receipts with artifact hash & SQLite replay protection
- 📝 **Content Writing**: Technical documentation, architecture plans, and sprint tasks  
- 🎨 **Image Generation**: Creative visual generation via multimodal models
- 📁 **File & Codebase Analysis**: Full workspace inspection, syntax tree review, and cross-file contracts
- 🎤 **Voice Input**: Speech to text
- 🔊 **Text to Speech**: Listen responses
- 🌐 **Web Search**: Real-time information
- 💾 **Chat History**: Auto-save in browser
- 🌙 **Dark Mode**: Eye comfort

## 🆓 100% Free APIs Used
- Groq Cloud (2000 req/day free)
- Google Gemini (60 req/min free)
- Hugging Face (Unlimited free)
- DeepSeek (Free tier)
- Pollinations.ai (Free images)
- Craiyon (Free images)

## 📦 Installation
```bash
# Clone project
git clone https://github.com/yourusername/ai-dost.git

# Backend setup
cd backend
npm install
cp .env.example .env

# Frontend setup
cd ../frontend
npm install
cp .env.example .env
```

## 🚀 Running the Application
### Local Development
```bash
# Start backend server (dev mode)
cd backend
npm run dev   # runs on http://localhost:5000

# Start frontend (Next.js dev)
cd ../frontend
npm run dev   # runs on http://localhost:3000
```

### Docker Production
```bash
# Build and start services via Docker Compose
cd ..
docker compose up --build   # backend on 5000, frontend on 3000
```

### Clean Project (Duplicate Removal)
```bash
# Scan and remove duplicate files (interactive)
node backend/scripts/clean_project.js
# Auto mode (no prompts)
node backend/scripts/clean_project.js --auto
```

## 🛠️ CI/CD Workflow
The project includes a GitHub Actions workflow that runs on each push/pull request:
- Installs backend and frontend dependencies
- Lints code (`npm run lint --workspaces`)
- Runs tests (`npm test --workspaces`)
- Builds Docker images
- (Optional) Deploy step placeholder

## 📂 Project Structure
```
ai-dost version 2.o/
├── backend/               # Node.js Express server
├── frontend/              # Next.js 16 app
├── ai-engine/             # Optional Python RAG engine
├── .github/
│   └── workflows/
│       └── ci.yml        # CI pipeline
├── docker-compose.yml     # Docker dev/prod setup
└── README.md              # This file
```

## ⚙️ Additional Commands
- `npm run clean` – Run duplicate removal script
- `npm run prod` – Start Docker containers
- `npm run lint` – Lint all packages
- `npm test` – Run all tests

---
*For detailed docs, see the `docs/` folder or the online wiki.*
