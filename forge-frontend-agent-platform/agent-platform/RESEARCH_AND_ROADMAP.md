# Forge: Feature Gap, Agent Skills, MCPs & Research

**Research checked:** 2026-10-10  
**Scope:** the current local Forge frontend prototype and official public protocol/provider documentation. The workspace Notion search for project-specific MCP/Skills requirements returned no pages, so this plan is grounded in the visible prototype and cited official docs.

## Executive recommendation

Build Forge as a **provider-neutral, project-aware agent workspace**: one task planner + a small number of task-specific skills + a permissioned MCP gateway + a sandboxed build/test/preview loop. Do not try to ship every provider tool or every skill in the prompt. Discover skills and MCP tools only when relevant, connect them through capability adapters, then prove quality with a repeatable benchmark.

No evidence-based public ranking can honestly establish that a new product is “more powerful than Google, Anthropic, or OpenAI” across every workload. These vendors expose different model, caching, MCP, and safety capabilities. Forge can compete on the **whole product experience**—minimal-input planning, project context, clean output, reliable QA, safe integrations, and cost per successful task—but must publish measured results instead of claiming an unsupported rank. [^https://modelcontextprotocol.io/docs] [^https://agentskills.io/home] [^https://developers.openai.com/api/docs/guides/agents]

## What the current prototype already has

- Replit-inspired dark workspace shell, project/file-tree mock, Preview/Code/Terminal tabs, a sample storefront preview, mobile preview controls, and theme selection.
- A Forge AI panel with plan/status cards and a four-stage **simulated** activity timeline.
- Demo Run/Deploy/chat interactions and a built frontend bundle.

These are UI demonstrations only. The file tree/code/terminal are not backed by a real project worktree, the chat/build/deploy callbacks do not call the existing backend, and the activity steps do not come from a real job event stream.

## Feature gaps to close

### P0 — Required for a trustworthy autonomous builder

1. **Real project/worktree connection:** open/import a repository, discover the current stack and scripts, edit only the intended files, show a diff, undo, and preserve existing backend code.
2. **Agent job lifecycle:** streaming response + durable job ID, plan/step events, tool-call visibility, cancel/pause/resume, retries, errors, and a live event stream that drives the activity animation.
3. **Safe execution sandbox:** isolated filesystem rooted to the selected project, command allowlist, resource/time limits, controlled egress, secret redaction, and no arbitrary host-shell access.
4. **MCP Connect manager:** catalog/search, remote Streamable HTTP and local stdio options where supported, OAuth consent, connection test, allowed-tool selection, per-scope grants, health, logs, reconnect and revoke.
5. **Skills library:** search/activation, versioning, visible provenance, immutable protected core, admin-managed additions, custom-skill review, and a safe enable/disable control.
6. **Human approvals:** auto-approve low-risk reads only after connector consent; request confirmation for writes, file deletion, data export, external messages, production deploys, or any destructive action. MCP calls can share data with remote services; approval must be explicit and inspectable. [^https://developers.openai.com/api/docs/guides/tools-connectors-mcp] [^https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices]
7. **Build and QA loop:** run the existing project's actual build/tests, browser preview at desktop + mobile, capture screenshots, check console/network errors, accessibility, and report what passed/failed before “Done.”
8. **Provider/model settings:** provider adapters for OpenAI, Anthropic, Google, and optional local models; user-owned secrets via the backend's secret store; per-task routing; fallback when a provider/MCP capability is unsupported.

### P1 — Professional output, project memory, and collaboration

9. Persistent project memory: stack, constraints, design tokens, routes, decisions, and test commands—retrieved selectively, not copied into every prompt.
10. Context-aware artifact/export pipelines for websites, chat experiences, games, 3D scenes, animation, PDF, presentation, documents, quizzes, spreadsheets, diagrams, images, and video storyboards.
11. Quality gates by output type: real render/preview, artifact validation, citation checks for research, responsive/accessibility checks for web, answer-key checks for quizzes, slide/page overflow checks for documents.
12. Deploy preview, environment-variable validation, domain/rollback handoff, deployment logs, and a clear production approval step.
13. Git branch/diff/commit/PR integration, version history, restore checkpoints, and optional collaboration/review comments.
14. Token/cost/latency dashboard: input/output/cache-read/cache-write tokens by task, provider, MCP, and skill; cost per successful task rather than “cheapest answer.”

### P2 — Extensibility and advanced workflows

15. Admin-curated, signed plug-in catalog; install/update/rollback; vulnerability review; compatibility tags; workspace policy.
16. Visual design import (Figma), asset generation, media timeline/render tools, and domain-specific game/3D engines selected by the user’s actual stack.
17. Benchmark leaderboard and regression tests for skills, provider changes, MCP changes, and model-routing policies.

## MCP research: what to build

MCP is an open protocol for connecting an AI application to external tools/context; its core server features include **tools, resources, and prompts**, while clients can provide capabilities such as elicitation. Treat this as an integration protocol—not as an automatic guarantee that an MCP server is safe or high quality. [^https://modelcontextprotocol.io/docs] [^https://modelcontextprotocol.io/specification/2026-07-28/index.md]

### Compatibility findings (checked 2026-10-10)

| Platform | What the official docs say | Forge implication |
|---|---|---|
| OpenAI Responses API | Remote MCP is supported over Streamable HTTP or HTTP/SSE; allowed-tool filters and approval requests are available, and Secure MCP Tunnel can expose private/local MCP without public exposure. [^https://developers.openai.com/api/docs/guides/tools-connectors-mcp] | Implement per-tool allowlists and an approval state machine; adapter may use provider-managed MCP or Forge's own MCP client. |
| Google Gemini Interactions API | Remote MCP uses Streamable HTTP; the docs say HTTP/SSE is not supported on that path and recommend snake_case server names. `allowed_tools` is available. [^https://ai.google.dev/gemini-api/docs/function-calling] | Make Streamable HTTP the first-class remote transport; normalize names/capabilities in the adapter and expose provider incompatibilities before connecting. |
| Anthropic | Official docs describe an MCP connector for Messages API and MCP support in Claude/SDK workflows. The open Agent Skills format originated at Anthropic and is now documented as an open standard. [^https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector] [^https://agentskills.io/home] | Keep provider adapters separate; reuse the portable skill package but map auth, approvals, and tool discovery per provider. |
| MCP security guidance | OAuth audience validation, per-client consent, least-privilege scopes, safe token handling, SSRF protections, and user approval for local server execution are important implementation concerns. [^https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices] | Use a backend token vault and egress policy; never store tokens in browser localStorage or forward user tokens blindly; scan/approve a local server command before execution. |

### Recommended connector order

**Start with five high-value connectors/tools:**

1. `project-files` — project-root-only read/write; reads available, writes are diffed/revertible.
2. `sandbox-terminal` — existing project build/test commands; no host shell or unrestricted network.
3. `browser-preview` — preview, console/network checks, responsive screenshots, basic accessibility checks.
4. `git-provider` — GitHub/GitLab repo/branch/diff/PR; grant the narrowest repository scope.
5. `docs-web-research` — official docs first, then broader web, with citations and source dates.

**Then add when the workflow needs them:** PostgreSQL/Supabase (read-only by default; migration writes separately approved), Figma, Drive/docs, Slack/Linear/Notion, image generation, PDF/PPTX renderers, and game/3D/media tools. Prefer first-party servers from the service owner; review tool descriptions, data handling, scopes, allowed tools, and maintenance before recommending an external server. OpenAI explicitly warns remote MCP servers may exfiltrate content in model context and recommends trusted servers and approval controls. [^https://developers.openai.com/api/docs/guides/tools-connectors-mcp]

**Connection UX:** `Connect` → display owner, transport, auth method, exact scopes, data leaving Forge, and risk → OAuth consent → test discovery → select only required tools → approve connection → show health/last-used/logs → revoke. For high-risk tool calls, show the tool name, arguments, target project/record, and an approve/deny action. Never treat a remote tool description or returned content as trusted instructions. [^https://modelcontextprotocol.io/specification/2026-07-28/index.md] [^https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices]

## Skills research: portable, small, tested

The Agent Skills open specification uses a `SKILL.md` with YAML `name`/`description`, with optional scripts, references, and assets. Its progressive-disclosure design loads compact metadata first, full instructions only when activated, and supporting files only when needed; the spec recommends roughly 100 tokens for metadata, under 5,000 tokens and 500 lines for the main instructions. This is the core token-saving idea used in the bundle below. [^https://agentskills.io/specification]

Anthropic's authoring guidance likewise recommends concise, scoped, tested skills; load focused references only when relevant, include validation loops, and iterate from execution traces rather than stuffing every edge case into the prompt. [^https://agentskills.io/skill-creation/best-practices.md] [^https://docs.anthropic.com/claude/docs/agents-and-tools/agent-skills/best-practices]

### Bundled skill ranking (priority by Forge value, not a vendor leaderboard)

**Tier S — core:** `minimal-input-planner`, `token-budget-router`, `context-pruner`, `codebase-scout`, `autonomous-fullstack-builder`, `frontend-ui-designer`, `test-debug-loop`, `secure-code-review`, `qa-release-gate`.

**Tier A — requested creation formats:** `chat-experience-builder`, `game-prototype-builder`, `three-d-scene-builder`, `motion-animation-builder`, `pdf-document-builder`, `presentation-builder`, `longform-document-builder`, `quiz-generator`, `spreadsheet-data-analyst`, `image-art-director`, `video-storyboard-builder`.

**Tier A — extensibility:** `web-research-citations`, `mcp-connector-author`, `skill-author-evaluator`.

This is a suggested activation priority. A task should usually activate one core planner plus one domain skill and, only if needed, one QA skill—not the whole bundle.

## Token and quality strategy

1. At chat start, send a short project/task summary and top-ranked skill metadata only. Fetch a full `SKILL.md` when selected; fetch its reference/scripts only at the point of need. [^https://agentskills.io/specification]
2. Index project files and search for relevant symbols; return small excerpts and paths instead of pasting whole files/repositories.
3. Expose MCP tool search/filtered `allowed_tools`; do not put every server's full schema in every request. Ask the connector only for the tools required by this task. [^https://developers.openai.com/api/docs/guides/tools-connectors-mcp] [^https://docs.anthropic.com/en/docs/claude-code/mcp]
4. Keep stable system instructions, tool definitions, and project rules at the front of provider requests; place changing user/task details later. Stable prompt-prefix reuse is supported differently by vendors and must be measured per provider. [^https://developers.openai.com/api/docs/guides/prompt-caching] [^https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching] [^https://ai.google.dev/gemini-api/docs/caching]
5. Maintain a compact task ledger: goal, constraints, assumptions, files changed, tests, next action, and unresolved risks. Use provider-native compaction when available; OpenAI documents compaction for reducing long-running context while preserving state. [^https://developers.openai.com/api/docs/guides/compaction]
6. Route routine edits/retrieval to a lower-cost/fast model; escalate to a stronger reasoning/model only for ambiguous architecture, risky changes, or failed quality checks. Evaluate actual completion/cost, not model brand.
7. Count tokens, cache hits, tool payload size, retries, and build/test pass. A cheaper model that requires repeated corrections may cost more per successful task.

## Immutable skills/MCP policy

- **Bundled core:** read-only to members; only release owners publish new versions.
- **Admin-managed custom:** an admin may add/replace an item; members may connect/enable but cannot edit/delete. Store version, checksum, source, owner, review status, and compatibility tags.
- **Pending custom submissions:** members may submit a skill or MCP URL/package for review, but cannot make it active or change protected definitions. Scan the skill text, scripts, MCP capabilities, scopes, and network requirements; approve/reject with an audit entry.
- **Optional user-owned shelf:** if later enabled, it must be explicitly labeled *User managed* and isolated from protected bundles, with separate permission boundaries.
- Enforce these policies in the Node backend/database/object store, not by hiding edit/delete buttons in the UI. Keep versions immutable and use atomic promote/rollback.

## Rollout plan

1. **Phase 0:** confirm existing backend routes, project storage model, auth/session, existing provider/API credentials, and job event format. Map the UI's demo handlers without replacing the backend.
2. **Phase 1:** implement project-root sandbox + real streamed chat/job lifecycle + diff/undo + build/test + browser preview; connect the five core tools.
3. **Phase 2:** add Connect/MCP registry, OAuth and least-privilege consent, approvals/audit, then protected Skills registry and lazy skill loading.
4. **Phase 3:** add provider adapters, model routing, token/cache telemetry, compaction, and benchmark comparisons.
5. **Phase 4:** add the requested artifact skills/renderers (PDF, slides, docs, quizzes, games, 3D, animation, image/video) one by one with output-specific QA.

Do not claim “one click creates a production-ready full stack” until the project runs through sandbox, tests, preview, and deployment checks on real repositories and the benchmark supports that claim.
