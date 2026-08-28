# 🤖 AI Dost - Your Personal AI Assistant

## 🌟 Features
- 💻 **Smart Coding**: Debug, write, explain code
- 📝 **Content Writing**: Blogs, scripts, stories  
- 🎨 **Image Generation**: Create amazing images
- 📁 **File Analysis**: PDF, DOCX, Images, Text
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
