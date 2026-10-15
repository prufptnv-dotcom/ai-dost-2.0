# Frontend Integration Spec (Proposed, Not Wired)

This is a **mapping guide**, not a claim that these API routes already exist. Adapt the contract to the user's existing Node backend rather than creating a duplicate backend.

## Add these app surfaces

### Integrations / Connect

- **Connected**: name/operator, transport, granted scopes, selected tools, health/last sync, reconnect, revoke.
- **Catalog**: curated integrations grouped by coding, QA, research, docs, design, data, and media; show verified owner, permissions, risk, and expected access.
- **Connect wizard**: (1) provider/server identity + data flow, (2) OAuth scopes or exact local command, (3) allowed tools, (4) approval policy, (5) consent + test, (6) connected result.
- **Per-action approval**: show server + tool + exact arguments + target project/data + data-sharing destination; approve once, deny, or revoke. Do not hide high-risk call details.

### Skills library

- Search/filter by task domain; show description, owner, version, activation reason, last evaluation, and required tools.
- Core/admin-managed entries get a **Protected** badge and no member edit/delete controls; enable/disable and inspect only.
- Custom submissions enter a **Pending review** queue, never run at submission time. Owners promote immutable versions after scan/evaluation.
- Display active skills for the current task to make routing visible and debuggable.

### Provider and usage controls

- Provider/model dropdown, capability badges, fallback policy, max cost/time, token/cache usage, and saved model preferences.
- Credentials are entered/authorized through the backend's secret-safe connection flow, never held in browser localStorage.

## Frontend-to-backend interface to map

The actual route names are unknown. These are conceptual operations to map onto the existing backend:

- `listConnections()` → current user's permitted MCP/provider connections.
- `beginConnection(catalogId)` → start OAuth or reviewed local server consent.
- `testConnection(connectionId)` → discover capabilities and report safe health status.
- `updateAllowedTools(connectionId, toolIds)` / `revokeConnection(connectionId)` → policy-controlled connector management.
- `listSkills()` / `submitSkillForReview(package)` → read-only curated registry + custom proposal submission.
- `startAgentJob(projectId, prompt, selectedSkills, allowedTools)` → return durable `jobId`.
- `subscribeJob(jobId)` → SSE/WebSocket events for truthful progress; reconnect from last event ID.
- `approveToolCall(jobId, requestId, decision)` / `cancelJob(jobId)` / `retryJob(jobId)` → human control.
- `getJobArtifacts(jobId)` → validated file references and preview URLs.

## Suggested public job events

Keep events concise and display safe **actions/results**, not private chain-of-thought. Example event types:

```json
{"type":"job.started","jobId":"job_123","message":"Understanding the project request"}
{"type":"plan.ready","jobId":"job_123","steps":[{"id":"inspect","label":"Inspect project files"},{"id":"build","label":"Implement the page"}]}
{"type":"tool.started","jobId":"job_123","tool":"project-files.search","summary":"Finding the existing route"}
{"type":"tool.approval_required","jobId":"job_123","requestId":"approval_456","tool":"github.create_pull_request","summary":"Create a pull request","risk":"write"}
{"type":"tool.completed","jobId":"job_123","tool":"project-files.search","summary":"Found 3 relevant files"}
{"type":"step.completed","jobId":"job_123","stepId":"inspect","summary":"Project structure mapped"}
{"type":"artifact.created","jobId":"job_123","artifactId":"artifact_789","kind":"website-preview","url":"/preview/opaque-id"}
{"type":"job.completed","jobId":"job_123","summary":"Build and responsive checks passed"}
{"type":"job.failed","jobId":"job_123","code":"BUILD_FAILED","message":"Build failed; review the log and retry"}
```

Never send access tokens, raw environment values, hidden reasoning, or unfiltered tool output in UI events. Validate and sanitize event payloads on the backend.

## Existing frontend placeholders

In `src/main.jsx`, map `submitPrompt`, `runBuild`, and the Deploy button to existing backend handlers. The current activity animation is client-side simulation; replace it with real job events. Implement the Integrations and Skills pages only after matching them to the existing authentication, authorization, job, and connection models.
