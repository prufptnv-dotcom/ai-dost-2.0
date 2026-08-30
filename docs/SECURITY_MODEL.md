# Security & Policy Model

**Document Type:** Security Architecture & Boundaries  
**Status:** Enforced  
**Last Updated:** 2026-08-30

---

## 1. Core Security Invariants
1. **Workspace Boundary:** Path traversal (`../`) and out-of-workspace writes are strictly rejected via `resolveSafePath`.
2. **Secret Shield:** `.env`, private keys (`*.pem`, `id_rsa`), database files, and system credentials are inaccessible to agent read/write tools.
3. **Terminal Command Policy:** Destructive commands (`rm -rf /`, `mkfs`, `format`, `:(){ :|:& };:`) are blocked at tool dispatch.
4. **Docker Sandbox Isolation:** Unsafe executions and foreign code runs occur inside isolated Docker containers with non-root privileges and memory limits.
5. **Circuit Breakers & Rate Limiters:** Robust API client safeguards third-party LLM and tool integrations against denial-of-service and runaway spend.
