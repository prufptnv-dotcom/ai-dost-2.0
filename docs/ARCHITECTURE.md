# AI-Dost Platform Architecture

**Document Type:** Technical Architecture Specification  
**Status:** Living Specification  
**Last Updated:** 2026-08-30

---

## 1. High-Level Architectural Model

```text
                         AI-DOST
                            │
                    ┌───────┴───────┐
                    │   EXPERIENCE  │
                    └───────┬───────┘
                            │
        ┌────────────┬──────┼───────┬────────────┐
        │            │      │       │            │
       Chat       Copilot  Images  Research   Documents
        │            │      │       │            │
        └────────────┴──────┼───────┴────────────┘
                            │
                    UNIFIED AGENT CORE
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
      Planner           Executor           Verifier
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                    CONTEXT / MEMORY
                            │
              ┌─────────────┼─────────────┐
              │             │             │
           Project      Knowledge       User
            Graph         Graph        Memory
              │             │             │
              └─────────────┼─────────────┘
                            │
                  TOOL / CONNECTOR LAYER
                            │
       ┌─────────┬─────────┬─────────┬─────────┐
       │ Files   │ Browser │ Git     │ Terminal│
       └─────────┴─────────┴─────────┴─────────┘
                            │
                    SECURITY / POLICY
                            │
                  Sandbox • Permissions
                  Audit • Secrets • Limits
                            │
                    INFRASTRUCTURE
                            │
              Models • Queue • DB • Storage
              Observability • Deployment
```

---

## 2. Shared Platform Core Services
1. **Model Router & Cascade:** Multi-model fallback across Gemini, Groq, Cerebras, NVIDIA, Together, DeepSeek, Mistral, HuggingFace, OpenRouter, and local Ollama.
2. **Execution Sandbox:** Containerized isolation via Docker/SandboxManager with strict path and resource policies.
3. **AST Diagnostics & Verification:** Real-time diagnostics interceptor validating syntax and types before user delivery.
4. **Dependency & Concurrency Engine:** DAG analyzer, file-level mutex lock manager, and parallel batch scheduler.
5. **Universal Project Store:** Unified filesystem and metadata storage powering Chat, Copilot, Documents, and Images.
