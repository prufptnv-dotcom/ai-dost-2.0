# AI Dost Generation Request-Path Map

Date: 2026-10-14

Status: **PARTIAL MAP — code-traced; live request tracing and baseline artifacts remain open.**

This document separates generation entry points that look similar in the UI but execute different backend paths. Do not assume a single route or a green unit suite proves every path behaves the same.

## 1. Main Copilot IDE prompt (primary path)

1. **UI request** — `frontend/components/views/CopilotIDE.jsx` posts to `/api/agent/run` with `userPrompt`, `projectId`, `projectFiles`, `copilotDirector: true`, `permissionLevel`, and `preferredModel`. The UI reads the response as SSE.
2. **Preload route bridge** — `backend/chatAgentRouteBridge.js` wraps the Express router's `POST /run` handler. If `req.body.copilotDirector` is truthy, it dispatches to `handleCopilotDirectorRequest`; if `chatTaskPlan` is present instead, it dispatches to the chat-task handler; otherwise the original ReAct handler runs.
3. **Director request validation** — `backend/agent/runtime/copilotDirectorHandler.js` resolves `projectId`, authorizes/creates the project, applies permission/capability checks, and emits SSE lifecycle events.
4. **Structured specification** — the Director handler calls `buildAppSpecification(request)`, validates/maps requirements and acceptance checks, formats the specification, and appends it to the planning request before `runtime.director.run(...)`.
5. **Task execution and file events** — the Director runtime plans/delegates work and emits events through `countingOnEvent`; file changes are streamed to the UI. This path is project-store/Director driven; do not assume the supplied `projectPath` alone is the authoritative workspace.
6. **UI state** — `CopilotIDE.jsx` consumes the SSE events and applies file/status/quality updates. `frontend/lib/outputQualityStatus.js` helps keep `UNVERIFIED` and `FAILED` QA from being rendered as completed.

**Important deployment dependency:** the route bridge is installed by the backend preload chain (including `chatAgentRouteBridge.js`). Running `node server.js` without the intended preload chain can select a different handler. Test the same startup command used by CI/production.

## 2. Legacy ReAct agent route (when Director mode is not requested)

1. `POST /api/agent/run` reaches `router.post('/run')` in `backend/routes/agent.js` when the bridge does not divert the request.
2. The ReAct loop calls `callLLM(..., preferredModel)` to select the next action.
3. When the model selects `generate_project_from_prompt`, the tool builds an `AppSpecification`, appends the formatted requirements/acceptance context to the full-stack system prompt, and calls `callScaffoldLLM`.
4. The bounded source-signal preflight can trigger one targeted completion attempt when known requested feature signals are absent. This is diagnostic/repair triggering only; source signals are not functional proof.
5. The route writes generated files, installs declared dependencies through the runtime bridge, runs real build/browser smoke verification, and may use the bounded repair loop. Build/render smoke is not requirement-level acceptance; acceptance remains `NOT_EVALUATED` without criterion-specific evidence.

## 3. Project Wizard path (separate legacy entry point)

1. `frontend/components/views/ProjectWizardModal.jsx` creates a configuration containing title, description, audience, selected features, stack, theme, and custom notes.
2. `CopilotIDE.jsx::handleWizardBuild` posts that configuration to `/agent/scaffold-wizard`. The request contract must use `wizardConfig` (not `spec`); the route returns SSE, not a JSON `{success:true}` response.
3. `router.post('/scaffold-wizard')` in `backend/routes/agent.js` builds a structured specification from the description plus wizard-selected features, passes it into the scaffold prompt, performs a bounded source-signal completion attempt, and writes files into the per-project temporary workspace.
4. The route emits `file_changed`, `generation_provider`, `output_quality`, and terminal events. The UI parses SSE, hydrates generated file contents into the editor, and must not display a success/accepted state unless the emitted status supports it.
5. This route currently does **not** run the same install/build/browser verification pipeline as the legacy full-project tool. Its best possible status without additional verification is `UNVERIFIED`; fallback or missing feature signals produce `PARTIAL`.

## 4. Evidence and benchmark contract

- `backend/scripts/run-phase-1-benchmark.js` targets the primary Director path with `copilotDirector: true`, a unique `projectId` per run, and a fresh local artifact directory.
- Director-backed workspaces may not be written to the request's `projectPath`. The runner reconstructs generated project files from emitted `file_written`/`file_changed` events and stores the event stream, metadata, and static diagnostic report.
- A terminal SSE event alone is not generation success: at least one generated file must be captured.
- Static source signals, CI green status, and a successful build are not equivalent to passing each user-requested behavior.
- Acceptance remains `NOT_EVALUATED` until isolated build/browser flows and criterion-specific evidence are recorded.

## 5. Phase 0 follow-ups still open

- Run the same prompt against the baseline and candidate with identical provider credentials/order and capture the actual files and event logs.
- Verify the preload chain under the real CI/production start command; confirm that the Director bridge is active.
- Exercise the Project Wizard route in a browser and verify editor hydration plus its explicitly unverified status.
- Map any additional entry points discovered through the UI and chat bridge; do not mark Phase 0 complete until the request-path inventory and baseline corpus are reviewed.
