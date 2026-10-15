# Changelog

All notable changes to AI-Dost are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-rc.1] - 2026-08-31

### Added
- **Editorial Workbench Visual System**: Completely redesigned interface featuring `AppShell -> CommandRail -> Canvas -> ContextInspector` architecture, removing legacy gradients and floating orbs.
- **Universal SQLite Project Store**: Versioned migrations 001–004 with WAL mode, cascading foreign keys, and atomic schema migrations across 8 relational tables.
- **Autonomous Multi-Agent Runtime**: Supervisor orchestration with verified delegation handoffs (`SUPERVISOR` -> `RESEARCHER` / `CODER` / `VERIFIER`) and checkpoint resumption.
- **Visual Verification Loop**: Headless Playwright capture and vision-based self-healing bug detection loop.
- **9-Tier AI Cascade**: Multi-provider inference (Groq -> Gemini -> Cerebras -> NVIDIA -> Together -> DeepSeek -> Mistral -> HuggingFace -> OpenRouter -> Ollama) with circuit breaker protection.
- **Production Health & Metrics**: Live endpoints at `/api/health`, `/api/circuit-breaker`, and `/api/quota-status`.
- **Large-Scale Workspace Scalability**: 10,000 files benchmark executed in 16ms with flat memory RSS.

### Security & Hardening
- Synchronously enforced path traversal (`../`), Windows UNC (`\\`), null byte (`\0`), and symlink escape defenses via `WorkspaceManager`.
- Cross-user tenant isolation enforcing 403 `ERR_UNAUTHORIZED` on unauthorized project access.
- Role-based capability bounding preventing unauthorized tool executions.
- Zero client-side API key leakage verified across bundles and logs.

### Fixed
- Fixed empty state text assertions across views to match frozen Editorial copy.
- Fixed mock envelope shapes in RAG indexer and retrieval contract test suites.
- Aliased `/api/health` and `/api/v1/health` for standard Docker/Kubernetes/Render probe compatibility.
