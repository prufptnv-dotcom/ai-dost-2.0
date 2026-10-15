---
name: ai-engine-ops
description: >-
  Use this skill to manage, start, or debug the Python-based AI Engine (FastAPI) for AI-Dost 2.0.
---

# Managing the AI Engine

The AI Engine handles RAG, Vector Embeddings (ChromaDB), and complex Python tasks. It runs on `127.0.0.1:8001`.

## Starting the Engine
Always start the engine using the provided batch script. Do not try to run `uvicorn` manually without activating the `.venv`.

```powershell
cd "c:\Users\vikash kumar\Pictures\ai dost 3.0\ai-engine"
.\start_ai_engine.bat
```

## Troubleshooting
- **Pip install failed:** Manually activate the venv and update packages:
  ```powershell
  cd "c:\Users\vikash kumar\Pictures\ai dost 3.0\ai-engine"
  .venv\Scripts\activate
  python -m pip install -r requirements.txt
  ```
- **Port 8001 in use:** Check if another python.exe process is running and kill it using `Taskkill /IM python.exe /F` (be careful if user has other python tasks).
- **ChromaDB issues:** If the vector database is corrupted, you can clear the `chroma_db` directory inside the project root to start fresh.
