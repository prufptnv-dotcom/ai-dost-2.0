# Current Prototype — Missing Features List

## Present today (frontend/demo)

- IDE-style shell with file-tree mock, Preview/Code/Terminal tabs, responsive preview, and accent themes.
- Assistant conversation UI, task-plan card, simulated four-step activity card.
- Run, Deploy, chat, and theme controls; only the theme is persisted in this frontend prototype.

## Not connected yet / missing

1. **Real repo and backend:** current file names/code/terminal are sample UI; there is no project worktree, real code editor, API call, test process, or existing-backend integration.
2. **Real autonomous job orchestration:** plan/edit/build/test/diff/undo/cancel/resume, job persistence, streamed logs, and real progress events.
3. **MCP Connect page:** server catalog, remote/local connection wizard, OAuth, scope review, tool allowlist, health/reconnect/revoke, and per-call approval.
4. **Skills page:** search, task-based skill activation, version/evaluation history, enable/disable, pending custom submissions, and protected admin-managed core skills.
5. **Model/provider connections:** OpenAI/Anthropic/Gemini/local model setup, secrets vault, per-task routing, fallback, limits, and provider capability checks.
6. **Safe runtime:** project-root filesystem, isolated shell/container, network egress restrictions, dependency scanning, and action audit trail.
7. **Project memory/search:** repository indexing, file-level retrieval, durable constraints/design tokens, and compact task state.
8. **Real QA and artifact export:** browser testing, mobile screenshots, accessibility/security checks, PDF/PPTX/DOCX render validation, and downloadable outputs.
9. **Creation domains:** chat app builder, games, Three.js/3D, animations, image/video pipelines, PDF/reports, presentations, documents, quizzes, spreadsheets, diagrams.
10. **Production deployment:** secrets/env configuration, preview deployments, domain setup, logs, health checks, rollback, and explicit production approval.
11. **Collaboration:** Git branches/diffs/PRs, version history, restore checkpoints, and optional reviewer workflow.
12. **Cost and quality dashboard:** token/cache usage, per-task cost/latency, model/skill/MCP success rate, retry rates, and quality regressions.

## Priority order

- **P0:** connect the already-written backend; real job events; safe project sandbox; MCP and Skills registry; approvals; actual build/test/browser preview.
- **P1:** provider adapters, project memory, token/cost telemetry, protected plugin management, Git, artifact exporters, and deployment workflow.
- **P2:** broader media/game/3D/document integrations, collaboration, and benchmark leaderboard.

Do not promise production-ready one-click output until the real backend path passes the release gate and evaluation suite. See [`RESEARCH_AND_ROADMAP.md`](./RESEARCH_AND_ROADMAP.md) for the architecture and vendor capability research.
