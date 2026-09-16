# Operations Runbook — AI-Dost 3.0

## 1. Quick Start

### Backend Service (Port 5000)
```powershell
cd backend
npm install
node server.js
```
Health Check: `http://127.0.0.1:5000/health`

### Frontend Application (Port 3000)
```powershell
cd frontend
npm install
npm run dev
```
Web Interface: `http://127.0.0.1:3000`

### Optional Python AI Engine (Port 8001)
```powershell
cd ai-engine
start_ai_engine.bat
```

---

## 2. Environment Verification

Ensure `.env` in root and `backend/.env` contain required keys:
- `PORT=5000`
- `GEMINI_API_KEY=...`
- `GROQ_API_KEY=...` (optional fallback)
- `DEEPSEEK_API_KEY=...` (optional fallback)
- `OPENROUTER_API_KEY=...` (optional fallback)
- `NVIDIA_API_KEY=...` (optional fallback)

In `frontend/.env.local`:
- `NEXT_PUBLIC_EXPRESS_BACKEND_URL=http://127.0.0.1:5000`

---

## 3. Running Verification Tests

```powershell
# Backend Unit Tests
cd backend
npm run test:unit

# Backend Integration Tests
npm run test:integration

# Security Boundary Tests
node --test tests/orchestratorSecurityBoundary.test.js
node --test agent/security/*.test.js

# Frontend Tests
cd ../frontend
npm test
```
