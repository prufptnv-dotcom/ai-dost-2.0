# Docker & Infrastructure Audit — AI-Dost 3.0

**Audit Date:** 2026-09-16  
**Scope:** Dockerfiles, docker-compose.yml, sandbox containers, port allocation, and health checks.

---

## 1. Docker Compose Topology

Inspected `docker-compose.yml`:
- **Services:**
  - `backend`: Exposes `5000:5000`, healthcheck on `http://127.0.0.1:5000/health`.
  - `frontend`: Exposes `3000:3000`, depends on backend healthcheck.
  - `ai-engine` (optional): Exposes `8001:8001` for FastAPI LlamaIndex and TTS.
- **Networks:** Isolated bridge network `ai-dost-network`.
- **Volumes:** Persistent volume for SQLite data storage (`./backend/data:/app/data`).

---

## 2. Sandbox Container Lifecycle

- **Dockerode Bridge (`backend/sandbox/SandboxManager.js`):**
  - Spawns isolated alpine/node runner containers.
  - Enforces 2GB RAM cap and 1 CPU core allocation.
  - Automatic idle container cleanup after 30 minutes.
  - Safe fallback to local execution when Docker daemon is not active.
