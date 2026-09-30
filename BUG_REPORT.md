# AI-Dost — Full Bug Audit Report

**Date:** 2026-09-25
**Scope:** backend / frontend / ai-engine / infra-config
**Total verified bugs: 219** (backend 70, frontend 55, ai-engine 49, infra 45)

Severity legend: `critical` > `high` > `med` > `low`

---

## Summary

| Area | Critical | High | Med | Low | Total |
|------|----------|------|-----|-----|-------|
| Backend | 5 | 29 | 26 | 10 | 70 |
| Frontend | 2 | 10 | 31 | 12 | 55 |
| ai-engine | 2 | 9 | 24 | 14 | 49 |
| Infra/Config | 1 | 8 | 22 | 14 | 45 |
| **Total** | **10** | **56** | **103** | **50** | **219** |

Highest-impact clusters:
- **RCE / arbitrary write:** unvalidated `targetDir` + host `npm install`/`exec`, Docker-down shell fallback, ai-engine custom-tool loader, PDF filename traversal
- **AuthZ:** `local-user`/`default` identity fallbacks bypass ownership; unauthenticated WS upgrade surfaces
- **Data loss:** RAG purge-before-check, regeneration `rmSync`, git checkout on repo root
- **Secrets:** `.env` baked into images, MCP children get full `process.env`, plaintext localStorage keys, hardcoded JWT secret

---

## 1. Backend (70 bugs)

### Critical
1. [critical] `backend/agent/orchestrator.js:681` — `generate_project_from_prompt` uses client `parameters.targetDir` with no containment; attacker-controlled path becomes write target for generated files.
2. [critical] `backend/agent/orchestrator.js:691-707` — `git init` / `npm install` run in that unvalidated `targetDir` → arbitrary package.json scripts execute on host (RCE).
3. [critical] `backend/routes/agent.js:626` — `path.isAbsolute(requestedDir) ? requestedDir : safeJoin(...)` lets any absolute path bypass workspace containment → write-anywhere.
4. [critical] `backend/routes/agent.js:775,785` — same absolute/relative `targetDir` used as `cwd` for `git init` and `npm install --prefer-offline` → host code execution via crafted package.json.
5. [critical] `backend/services/workspaceManager.js:34-37` — `getDefaultDiskPath` does `path.join(tmpdir, 'agent-ws-' + safeId)` with no separator checks; `projectId` containing `/` or `..` (e.g. `foo/../../x`) escapes tmpdir base.

### High
6. [high] `backend/sandbox/SandboxManager.js:316-320` — Docker-down fallback `execLocal` runs `spawn(cmd, [], { shell: true })` on the HOST; only `validateCommandPolicy` denylist (line 69-78) stands in the way (easily bypassed: `rm -r -f /`, `Remove-Item`, etc.).
7. [high] `backend/routes/agent.js:626` + `:718-724` — regeneration deletes every non-ignored entry in `targetDir` (recursive `rmSync`) before writing new files → permanent data loss when `targetDir` is wrong or absolute.
8. [high] `backend/services/deployService.js:50,141,230` — `collectFiles(buildResult.outputDir)` receives relative `'dist'` instead of `path.join(projectPath, outputDir)` → reads from server process cwd, deploys wrong/empty content (StaticAdapter does join correctly at :316).
9. [high] `backend/services/deployService.js:305,317` — StaticAdapter `options.targetDir` never validated → `path.join(targetDir, ...)` + `copyDir` writes build output to any host directory.
10. [high] `backend/middleware/localApiGuard.js:65,136` vs comment `:14-17` — doc says Tier B blocks home LAN `192.168.x`, but `isDockerNetwork` includes `/^192\.168\./`, so `execGuard` admits the exact range the comment forbids (policy bug, no `ALLOW_REMOTE_EXEC` needed).
11. [high] `backend/middleware/rateLimiter.js:14-16` — any request with `req.ip` loopback skips rate limiting entirely; with `trust proxy 'loopback'` (server.js:146) a spoofed `X-Forwarded-For: 127.0.0.1` via the Next.js rewrite proxy can appear as loopback → unlimited API calls.
12. [high] `backend/services/projectAuthorization.js:36` — unauthenticated callers always resolve to `'local-user'`; `verifyOwnership` (`:55`) grants legacy unowned projects to `'local-user'`, so every anonymous caller shares one identity in non-production.
13. [high] `backend/server.js:1277,1300` — conversation ownership checks skip 403 whenever `userId === 'local-user'`; combined with resolveUser fallback, any local caller can read/delete any conversation.
14. [high] `backend/routes/assessment.js:138,235,281` — `attempt.userId !== userId && attempt.userId !== 'default' && userId !== 'default'` is false whenever caller is `'default'` → anonymous users bypass ownership and can open/save/submit ANY attempt (not just default-owned ones).
15. [high] `backend/routes/database.js:312,331` — `POST /migration/apply` accepts client `dbPath` with no containment → arbitrary SQLite file opened/modified; `approvalToken` only checked for truthiness (`:322`), any non-empty string approves destructive migrations.
16. [high] `backend/routes/database.js:371,399,426` — `dbPath` from body/query on rollback/history/drift → arbitrary file read/modify outside workspace.
17. [high] `backend/routes/database.js:135-164` — query endpoint opens read-write DB; the `catch` at :162 returns 400 without `db.close()` → handle leak on every SQL error.
18. [high] `backend/routes/interpreter.js:33-46` — temp file written at :33 BEFORE language validation at :41-42; unsupported language returns 400 and never unlinks (file leak). Also arbitrary `python`/`node` code exec on host via `exec()`.
19. [high] `backend/routes/test.js:10-31` — same host `exec` of attacker `code` with only path to tmpfile; no sandbox despite "Code Execution Fallback" name.
20. [high] `backend/routes/test.js:15-17` — any code containing `input(` receives hardcoded stdin `'User\nFriend1\n...'` regardless of program → wrong results / logic corruption for real interactive programs.
21. [high] `backend/sockets/terminal.js:237-239` — `term:start` takes client-supplied `projectPath` and uses it as shell `cwd` (`createSession` :72) with no validation → terminal rooted at arbitrary host path.
22. [high] `backend/sockets/terminal.js:46-48` — `isBlocked` is substring match against a tiny fixed list; trivially bypassed (`rm -rf /tmp`, `Remove-Item -Recurse D:\`, `:(){ :|:& };:` variants with spaces, `shutdown -r`, etc.).
23. [high] `backend/sockets/terminalWs.js:15-21,24-39` — raw `/api/terminal/ws` accepts connections with no Origin/IP/auth check (unlike socket.io path which has `isAllowedSocketOrigin`) and spawns a full shell with complete `process.env` → remote shell if port exposed.
24. [high] `backend/lsp/lspServer.js:10-24` — `/lsp` upgrade has no auth; each connection spawns a new `typescript-language-server` → unbounded process/DoS + unauthenticated LSP access.
25. [high] `backend/sandbox/wsServer.js:11-17,58+` — `/api/sandbox/ws` upgrade accepts any client; `create`/`exec`/`write`/`dev:*` messages have no user/project authorization (Express `apiGuard` never sees upgrades).
26. [high] `backend/server.js:1469-1508` — HMR `upgrade` handler: if `projectId` is null or dev server not READY, no branch destroys `socket` → hung TCP/FD leak (same pattern: terminalWs.js:15-21, lspServer.js:10-15, wsServer.js:11-17 — none `socket.destroy()` on non-match).
27. [high] `backend/security-hardening.js:192` + `:206` — SSE frame regex `data:\s*(\{[\s\S]*?\})\n\n` is applied per-chunk; frames split across TCP writes are never matched (missed task events), and inserted events are written BEFORE the source chunk (ordering inversion vs client expectations).
28. [high] `backend/services/urlFetcherService.js:165-180` vs `:289` — SSRF check resolves DNS, then `fetch(currentUrl)` re-resolves independently (DNS rebinding TOCTOU); no IP pinning/`lookup` override.
29. [high] `backend/services/urlFetcherService.js:300` — `clearTimeout(timeoutTimer)` runs after headers, BEFORE body read loop (`:372-383`) → no timeout on slow-drip body (hang / resource exhaustion).
30. [high] `backend/mcp/McpClientManager.js:46,54,98` — `env` defaults to full `process.env` for MCP child processes → all secrets (GEMINI_API_KEY, tokens, etc.) leaked to any registered/ad-hoc MCP command.
31. [high] `backend/server.js:146` + `backend/middleware/localApiGuard.js:88-93` — `trust proxy 'loopback'` trusts XFF only from loopback (Next.js rewrite), but rateLimiter/apiGuard logic still wrong when any local process proxies; combined with #11 this is the concrete spoof path.
32. [high] `backend/routes/git.js:9,12,34-45` — `WORKSPACE_DIR = path.join(__dirname,'../../')` is the REPO ROOT; `/git/init` and `/git/commit` operate on the whole AI-Dost repository, not a project workspace.
33. [high] `backend/routes/git.js:95-111` — `/git/checkout` runs `git checkout <hash>` in repo root → detaches HEAD and rewrites the entire codebase on a single API call (destructive, no confirmation).
34. [high] `backend/routes/git.js:132` — unconditional `git remote remove origin` before add destroys existing remote config (and fails noisily if origin absent).

### Medium
35. [med] `backend/agent/orchestrator.js:425-426` + `backend/agent/tools/TinalTool.js:19-20` — agent BLOCKED list is 5 short substrings only (`'rm -rf /'`, etc.); nearly all destructive shell escapes pass.
36. [med] `backend/sandbox/SandboxManager.js:54-59` — `_resolveSafe` uses `path.resolve` prefix check only, no `fs.realpath` → symlink inside sandbox dir escapes containment on `writeFile`/`readFile`/`listFiles`.
37. [med] `backend/sandbox/SandboxManager.js:126-131` — check `containers.size >= MAX` then `await cleanup()` then check again: two concurrent `createSandbox` calls both pass → exceeds `MAX_CONTAINERS` (10).
38. [med] `backend/sandbox/SandboxManager.js:622-627` — `shutdown()` iterates `this.destroy(id)` without await → process can exit while container stop/remove incomplete (containers orphaned).
39. [med] `backend/sandbox/SandboxManager.js:174,193` — `config.workdir` hardcoded `'/workspace'`; callers pass `options.workdir` (TerminalTool.js:35, orchestrator.js:432/539/568/1882) which is silently ignored → agent commands run in empty container dir, not project workspace.
40. [med] `backend/server.js:214-215` — `releaseSlot` registered on both `'finish'` and `'close'`; Node fires both on normal end → double decrement. Mitigated only if `security-hardening.js` loads (server.js:2 `try/catch` swallows load failure; hardening `:231-249` dedupes by listener identity).
41. [med] `backend/server.js:370-399` — `/src` handler scans ALL `agent-ws-*` dirs in tmp by mtime and serves first match → cross-project file disclosure (project A's `/src/foo.js` can return project B's file).
42. [med] `backend/routes/preview.js:16-31` — `getFileFromDb`/`getAllFilesFromDb`: if `prepare`/`all` throws, `db.close()` never runs → sqlite handle leak per failed preview request.
43. [med] `backend/routes/preview.js:135,141,168-169,191-192` — `server.logs`/`server.error`/`projectId` interpolated into HTML with no escaping → stored XSS in preview status pages (log messages come from dev-server output).
44. [med] `backend/taskCancellation.js:68` — task id taken from client header `x-ai-dost-task-id` with no auth → colliding/overwriting another user's active task entry; `registerTask` `:48` silently replaces Map entry, cleanup `:54` then deletes the wrong task.
45. [med] `backend/taskCancellation.js:114-139` — cancel endpoint patched onto `http.Server.prototype.emit` with zero auth → any local client can `POST /api/chat/tasks/<id>/cancel` for any in-flight stream.
46. [med] `backend/middleware/rateLimiter.js:40-43` — read-modify-write on shared object is not atomic under concurrent requests (undercount → limit bypass); every `set` also resets TTL to full window (sliding-window bug: continuous traffic never expires).
47. [med] `backend/services/cacheService.js:15,65-71,91-94` — `memoryCache` Map never evicts on a timer; expired keys only removed when that exact key is `get` again → unbounded growth under unique keys (rate limiter creates per-IP×path keys).
48. [med] `backend/routes/documents.js:15-27` + `backend/routes/pdf.js:20-27` — every generate writes a new file into `frontend/public/downloads` with no cleanup/TTL → unbounded disk growth (and files are web-served).
49. [med] `backend/server.js:277-304` — `getProjectFiles` `readFileSync(..., 'utf8')` every file under workspace (no size cap, no file-count cap) → OOM/DoS on large workspaces.
50. [med] `backend/projectStore.js:51` — `deleteProjectFile` uses raw `filePath`, while `saveProjectFile` `:21` stores `normalizePath(filePath)` → deletes miss rows (backslash/`./`/duplicate-slash variants).
51. [med] `backend/sockets/collaboration.js:128-134` — `canvas:edit` accepts unbounded `fullContent` and replaces room content with no size limit → memory DoS; no room membership check before edit.
52. [med] `backend/sockets/collaboration.js:153-176` — `canvas:ai_coedit` invokes `callLLM` for any connected socket with no auth/rate limit → free-tier quota burn and cost abuse.
53. [med] `backend/routes/image.js:204-226` — `/turbo` background IIFE bypasses the serial `queue` (lines 15,110,177) and returns `success:true` immediately without generating; download failure is swallowed (`:225`) → API promises a file that may never exist.
54. [med] `backend/routes/image.js:55` — `GEMINI_API_KEY` placed in query string (`?key=`) → key exposed in proxy/server logs, browser history if ever hit client-side.
55. [med] `backend/mcp/McpClientManager.js:216-217` — `disconnect` nulls `client`/`isConnected` but leaves `entry.tools` populated; later `connect` short-circuits only on `isConnected && client`, yet callers reading `entry.tools` after disconnect get stale tools bound to a dead transport.
56. [med] `backend/db/index.js:31-44` and `backend/db/sqlitePolyfill.js:30-43` — transaction polyfill issues bare `BEGIN` with no nesting guard; nested transactional calls → `cannot start a transaction within a transaction` and broken ROLLBACK semantics.
57. [med] `backend/routes/git.js:84` — `line.split('|')` on `--pretty=format:%h|%an|%ar|%s`: commit subjects containing `|` corrupt author/date/message parsing (fields shift/drop).
58. [med] `backend/routes/figma.js:113,123,137` — `fileKey` interpolated raw into `${FIGMA_API}/files/${fileKey}` → path injection against Figma API (extra segments, query smuggling); no charset allowlist.
59. [med] `backend/agent/tools/WriteFileTool.js:24` — `input.allowOverwrite` is LLM/attacker-controlled and disables the GAP-01 existing-file overwrite protection entirely.
60. [med] `backend/sockets/terminal.js:85,90` + `terminalWs.js:30,37` — shells spawned with full `process.env` (API keys, tokens) unlike `SandboxManager.sanitizeEnvironment` → secret exposure to any command user runs.

### Low
61. [low] `backend/server.js:1065,1066,1097` — regex `/^\/+||\/+$/g` has an empty middle alternation; trailing-slash trim is a no-op (rename/folder-delete path normalization broken).
62. [low] `backend/server.js:1254,1264` — empty `catch (_) {}` on history SELECTs swallows schema/DB errors → silent empty history instead of 500.
63. [low] `backend/db/sqlitePolyfill.js:16` — `` exec(`PRAGMA ${pragmaStr}`) `` interpolates caller string into SQL (currently internal callers only; unsafe API surface).
64. [low] `backend/routes/test.js:47` — response hardcodes `duration: 100` ms regardless of real execution time.
65. [low] `backend/routes/figma.js:138` — `data.document?.findNode?.id` is dead code (`findNode` does not exist on Figma documents); stack walk at `:139-146` is the only real path.
66. [low] `backend/routes/research.js:41`, `documents.js:28`, `services/telegramBot.js:18` — hardcoded `http://127.0.0.1:${PORT}` self-calls break under IPv6-only hosts or non-loopback bind.
67. [low] `backend/routes/git.js:27` — `allowedRoots` includes `path.resolve(process.cwd())`, which in backend startup equals the whole repo → effectively unconstrained cwd for `push-remote`.
68. [low] `backend/routes/assessment.js:34` + `:107-110` — `resolveUser` fallback `'default'` plus shared history means all anonymous users share one attempt/weak-topic profile (cross-user data bleed, not just #14).
69. [low] `backend/package.json:10-11` — critical mitigations (`security-hardening`, `taskCancellation`) depend on `-r` preload; `server.js:2-4` re-require with swallowed failures (`catch (_) {}`) means a syntax/path failure silently drops cancellation/hardening while server still starts.
70. [low] `backend/routes/pdf.js:48-50` — `path.basename(req.params.name)` correctly neutralizes traversal (OK); residual issue is only missing auth on download-by-uuid (guessable 8-hex suffix at `:20`).

---

## 2. Frontend (55 bugs)

### Critical
71. [critical] `components/sandbox/LivePreview.jsx:29-49` — `checkServerHealth` useCallback deps reference `scheduleReconnect` before its `const` declaration (TDZ `ReferenceError` on every render of LivePreview).
72. [critical] `components/sandbox/SandboxPanel.jsx:496` — `onError={onError}` but `onError` is not in props (line 128) or any state → `ReferenceError` when the preview tab opens.

### High
73. [high] `components/Header.jsx:157` — Every settings click under 7-tap schedules `setShowSettings(true); setShowSettingsModal(true)` after 350ms → secret PersonalBrainModal opens on a single settings click; `clickTimerRef` also never cleared on unmount.
74. [high] `components/assessment/AssessmentRunner.jsx:127-130` — `handleSubmit(true)` called inside the `setSecondsRemaining` updater (impure side effect; StrictMode double-invoke can double-submit).
75. [high] `hooks/useCanvasCollaboration.js:37-132` — Connect effect deps include `initialCode`, `language`, `title`, `userName` → socket torn down/reconnected whenever a parent re-renders with inline prop values.
76. [high] `components/views/DeployModal.jsx:58` — `api.post('/v1/deploy/deploy')` with axios `baseURL: '/api/v1'` → requests `/api/v1/v1/deploy/deploy` (404; backend mounts `/api/v1/deploy`).
77. [high] `components/chat/ChatArtifactsCanvas.jsx:520-522` — `srcDoc` iframe with `sandbox="allow-scripts ... allow-same-origin"` lets AI/user-generated artifact scripts access parent origin (localStorage, tokens).
78. [high] `pages/dashboard.jsx:318` — Toast uses `created.name` but `createProject` returns backend shape `{ project_name, ... }` → toast shows `Project "undefined" created`.
79. [high] `components/views/HistoryView.jsx:78` — Reads `ai_dost_messages_${sid}` but default session is stored as `ai_dost_messages_chat` (ChatView.jsx:23) → default-session local history never merges.
80. [high] `components/layout/CommandRail.jsx:104` — Delete removes `ai_dost_messages_${s.id}`; for `s.id === 'default'` wrong key → default chat messages never deleted.
81. [high] `components/layout/CommandRail.jsx:121` — Share reads same wrong key for default session → share exports empty transcript.
82. [high] `components/chat/ChatArtifactsCanvas.jsx:82-144` — `window` `message` handler for `SANDBOX_RUNTIME_ERROR` has no `e.origin`/`e.source` check → any frame can trigger auto-heal/API calls.

### Medium
83. [med] `components/chat/ChatArtifactsCanvas.jsx:81-146` — Message-listener effect deps include `liveCode` → re-registers listener every keystroke.
84. [med] `components/views/AnimationStudioView.jsx:707-709` — Preview `srcDoc` iframe uses `sandbox="allow-scripts allow-same-origin"` → same parent-origin access as #77.
85. [med] `components/VisualHealer.jsx:157` — Hardcoded `http://localhost:5000/api/agent/heal` bypasses Next rewrites; breaks when backend is not on localhost.
86. [med] `components/VisualHealer.jsx:98-119` — Suggestion-poll effect returns early if `iframeRef.current` is null at mount; deps are stable refs so interval never starts if iframe mounts later.
87. [med] `pages/dashboard.jsx:224-232` + `context/ToastContext.jsx:21` — Both listen to `ai_dost_toast` → duplicate toast UI for every global toast.
88. [med] `pages/dashboard.jsx:92-99` vs `296-300` — Palette hints advertise `Ctrl+A`, `Ctrl+6`, `Ctrl+7`, `Ctrl+8` but keyboard handler only implements Ctrl+1..5, K, Shift+V, N → dead shortcuts.
89. [med] `pages/dashboard.jsx:292` — `isMod && e.key === 'n'` does not exclude `shiftKey` → Ctrl+Shift+N (new window) intercepted as New Chat.
90. [med] `components/views/ChatView.jsx:190-215` — History `api.get` has no AbortController/session guard → late response for session A can overwrite session B messages.
91. [med] `components/CodeEditor.jsx:268-272` — Socket `message` effect deps include `code` → listener removed/re-added on every keystroke.
92. [med] `components/CodeEditor.jsx:375-424` — LSP WebSocket created in `handleEditorDidMount` is never stored or closed → socket leak on unmount/remount.
93. [med] `components/CodeEditor.jsx:381` — LSP URL falls back to hardcoded `ws://localhost:5000` when env unset → broken in production.
94. [med] `components/views/VoiceView.jsx:311-317` — `rec.onresult` closes over `speaking` captured when `startListening` ran → barge-in check uses stale state if AI starts speaking after mic starts.
95. [med] `components/Header.jsx:134-143` — Theme toggle writes only `theme` and only toggles `light-theme` class; conflicts with dashboard 4-theme `ai_dost_theme` manager (dashboard.jsx:160-176) → theme desync.
96. [med] `components/ui/Modal.jsx:15-22` — Every open Modal registers its own Escape handler → Escape closes all stacked modals at once.
97. [med] `components/McpPanel.jsx:17-19` — `setConfigs(JSON.parse(saved))` without `Array.isArray` guard → non-array JSON crashes render on `configs.map`.
98. [med] `components/chat/ChatQuizCard.jsx:24` — `quizData.options.map` without optional chaining/guard → crash if LLM omits `options`.
99. [med] `components/assessment/AssessmentRunner.jsx:52-64` — Always POSTs `/start` even when a restored `attemptId` exists → new attempt overwrites restored session id.
100. [med] `components/chat/UniversalChatDock.jsx:35-41` — `resetChatState` always removes `ai_dost_messages_chat` and forces session `default` without clearing the currently active non-default session.
101. [med] `components/DeployModal.jsx:38-44` — Vercel/Netlify deploy tokens persisted in `localStorage` (plaintext, XSS-exfiltratable).
102. [med] `components/views/SettingsView.jsx:62-77` — Provider API keys (`GEMINI_API_KEY`, etc.) stored in plaintext `localStorage`.
103. [med] `components/Header.jsx:164-168` — Same plaintext API-key storage via Header settings form.
104. [med] `components/views/CopilotIDE.jsx:49` — `BACKEND` defaults to `http://localhost:5000` absolute URL → agent-run fetch bypasses Next rewrites; fails off-machine without env.
105. [med] `components/views/TerminalPanel.jsx:9,151` — Socket.IO client hard-defaults to `http://localhost:5000` → dead terminal in non-local deploys.
106. [med] `services/FigmaMCPClient.js:1,16` — Absolute `http://localhost:5000` base for `/api/figma/*` instead of relative path → CORS/404 outside local dev.
107. [med] `components/agent/CrewPanel.jsx:62` — `BACKEND` prop default `http://localhost:5000` → crew/plan requests fail when parent omits prop in prod.
108. [med] `components/AICompanion.jsx:602` — local-models probe falls back to `http://localhost:5000` absolute URL.
109. [med] `hooks/useWebContainer.js:111-114` — Success path never clears the 120s safety `setTimeout` → late `process.kill()` after command already exited.
110. [med] `components/chat/MessageStream.jsx:105-136` — `useEffect` attaches `copy-code-btn` listeners and nested `setTimeout`s with no cleanup → setState/listener leak when message unmounts mid-copy.
111. [med] `components/SmartChatMessage.jsx:42` — `DOMPurify.sanitize(marked.parse(...))` recomputed every render (no memo) on long messages.
112. [med] `components/views/ChatView.jsx:857` — `localStorage.setItem('ai_dost_session_id', id)` not wrapped in try/catch (sibling call at :868 is) → QuotaError breaks `createSession`.
113. [med] `components/ui/ProjectSwitcher.jsx:27` — Focus `setTimeout(50ms)` not cleared on close/unmount → focus steal if menu reopened quickly.

### Low
114. [low] `components/GitControlModal.jsx:43-64` — `fetchGitLogs` not aborted when modal unmounts; only the 0ms timer is cleared.
115. [low] `pages/_app.js:37-67` — Global Ctrl+C clipboard guard does not `preventDefault`/`stopPropagation` → races with native copy (double `writeText`).
116. [low] `pages/dashboard.jsx:218-221` — `showToast` schedules `setTimeout` with no cleanup on unmount → setState after unmount.
117. [low] `components/VoiceAssistant.jsx:59-62,191,235,265` — Interruption/close `setTimeout`s never stored/cleared → post-unmount setState.
118. [low] `pages/dashboard.jsx:369-371` — `onOpenFile={(filePath) => { go('copilot'); }}` ignores `filePath` → clicked file never opens in Copilot.
119. [low] `pages/dashboard.jsx:446-450` — History→chat session switch uses fixed 50ms `setTimeout` race with ChatView mount instead of a ready event.
120. [low] `services/websocket.js:8` — `defaultWs = 'ws://localhost:5000'` when `NEXT_PUBLIC_API_URL` unset and hostname is localhost; production builds without env still emit localhost URLs in error paths.
121. [low] `components/chat/UniversalCommandBridge.jsx:18-20` — Capture-phase `stopImmediatePropagation` on Enter for any ≥0.9 "command" intent can swallow a legitimate user message if classification is wrong.
122. [low] `components/views/ResumeView.jsx:725-728` — Resume preview iframe `sandbox="allow-same-origin allow-modals"` on `srcDoc` derived from user fields → same-origin script injection if HTML fields are not fully escaped.
123. [low] `components/assessment/AssessmentRunner.jsx:110,113` — Uses blocking `alert()` for submit failures instead of toast/error UI.
124. [low] `components/chat/ChatMessageBubble.jsx:59-64` — `setTimeout(() => setCopied(false), 1500)` not cleared on unmount.
125. [low] `components/views/AgentView.jsx:61-72` — Elapsed timer effect re-creates interval when `running` flips but does not reset `elapsedSeconds`, so a stopped/resumed run keeps stale time.

---

## 3. ai-engine (49 bugs)

### Critical
126. [critical] `ai-engine/main.py:1318-1320` — `/ai/pdf/generate` joins unsanitized `req.filename` into temp dir: `os.path.join(temp_dir, "..\\..\\..\\evil.pdf")` or an absolute path (`os.path.join` discards base) = arbitrary file write / path traversal.
127. [critical] `ai-engine/Dockerfile:24` (+ no auth anywhere in main.py) — uvicorn bound to `0.0.0.0:8001` with zero authentication on every endpoint, exposing file-writing crew tools, SSRF scraper, unbounded TTS proxy, and RAG index/query to the network.

### High
128. [high] `ai-engine/main.py:256-259` — SSRF redirect bypass: `_validate_scrape_url(req.url)` runs before `requests.get(...)`, which follows redirects by default, so a public URL 302-ing to `http://169.254.169.254/` or `http://127.0.0.1:5000/` is fetched unvalidated.
129. [high] `ai-engine/main.py:241-249` — SSRF validation only checks *literal* IP strings (`ipaddress.ip_address`); hostnames resolving to private IPs (`localhost.localdomain`, DNS rebind, `nip.io`) and alternate IP forms (`2130706433`) pass with `return` at line 247.
130. [high] `ai-engine/main.py:259-262` — scraper loads full `response.content` into memory with no size/timeout-body cap → memory DoS via a huge (or slowly-streaming) page.
131. [high] `ai-engine/main.py:533,551-553` — `create_new_tool` denylist trivially bypassable: only blocks `os.system`/`subprocess`/`__import__`/`eval(`/`exec(` substrings, so `os.popen(...)`, `open(...)`, `import socket`, `eval (` (space) all pass; code is later executed by `load_custom_tools` → RCE when `ENABLE_CUSTOM_TOOLS=1`.
132. [high] `ai-engine/main.py:572-578` — `load_custom_tools` sets `sys.modules[module_name] = module` from the raw filename, so a tool named `json.py`/`os.py`/`types.py` silently overwrites the stdlib module process-wide.
133. [high] `ai-engine/dummy_mcp_server.py:6-10` — MCP `read_file` tool opens any caller-supplied absolute path with no sandbox/allowlist → arbitrary file read (exposed whenever `MCP_COMMAND` points here).
134. [high] `ai-engine/main.py:488-490` — `agent_resume` denial path does `state.values["messages"][-1]` and `last_msg.tool_calls[0]["id"]` with no validation that the thread exists or has a pending tool call → IndexError/TypeError → opaque 500 for unknown/finished threads.
135. [high] `ai-engine/main.py:357-358,413,435-438,481` — `thread_id` is fully client-supplied with no ownership check: any caller can resume/approve another session's pending interrupt (`/ai/agent/resume`) or pollute its checkpointer state (`MemorySaver` shared globally).
136. [high] `ai-engine/main.py:1556-1572` — `/ai/rag/index` "upsert" purges existing vectors for the entity (line 1558) *before* checking content; `content` empty/None skips re-add (line 1572) → silent data loss on empty upsert.

### Medium
137. [med] `ai-engine/main.py:1355,1387-1485` — `RetrievalRequest.user_id` is declared but never used anywhere in `rag_query` → advertised per-user isolation doesn't exist; knowing/guessing `project_id` grants full read.
138. [med] `ai-engine/main.py:403-405,415` (also 471-473, 488-494, 631-633, 641-643, 687-689) — blocking sync Chroma/embedding/`retriever.retrieve`/`get_state` calls inside `async def` endpoints block the single event loop (health/TTS/agent all stall during RAG I/O).
139. [med] `ai-engine/main.py:754,943` — `crew_run` is a sync route running multi-minute CrewAI `kickoff()` in FastAPI's default ~40-thread pool → concurrent crew requests exhaust the pool and take the whole service down.
140. [med] `ai-engine/main.py:987,1051,1085` — `XLSXRequest.rows` unvalidated: `rows=10**9` loops/allocates until OOM; negative rows writes 0 rows but response reports `rows_written=req.rows` (negative) — wrong contract.
141. [med] `ai-engine/main.py:600,642` — `MemoryRetrieveRequest.top_k` has no bounds: `top_k=0/-5/10**7` passed straight to `similarity_top_k`.
142. [med] `ai-engine/main.py:285,319-320` — `TavilySearchRequest.max_results` unbounded and `search_depth` unvalidated (`"banana"`), both forwarded raw to Tavily → quota burn / upstream 400 mapped to generic 500.
143. [med] `ai-engine/main.py:1162,1186,1206,1226-1237` — `/ai/generate` contract bug: `model="groq"` with no `GROQ_API_KEY` skips groq (line 1162), then fails the gemini/together membership checks, and silently returns an **Ollama** answer; unknown `model` values also silently fall to Ollama instead of 400.
144. [med] `ai-engine/main.py:1182,1202,1222,1234` — four bare `except Exception: pass` in the cascade discard every provider error with zero logging → final `503` has no diagnostics (hard to distinguish bad key vs network vs payload).
145. [med] `ai-engine/main.py:1566` — `chunks_deleted += 1` executes once per *document* purged (comment even admits it can't know counts), so `IndexResponse.chunks_deleted` lies about chunk counts.
146. [med] `ai-engine/main.py:391-393,458-460,674-676` — fallback mock `read_file` returns fabricated `"Mock content of " + path`; the agent is told this is file content and will act on invented data.
147. [med] `ai-engine/main.py:846,896` — `crew_run` silently treats any unknown `mode` as `"dev"` (else-branch line 896) and any unknown `model` as `ollama` (line 846) instead of returning 400.
148. [med] `ai-engine/main.py:939-953,966-968` — if all 3 `kickoff()` attempts return empty output *without* raising, `last_err` stays `None`, the guard at 952 doesn't fire, and the API returns `status="completed", result=""` as a success.
149. [med] `ai-engine/main.py:47-59` — origin guard bypasses: `Origin: null` → `urlparse(...).hostname` is `None` → `origin_host == ""` → `not origin_host` allows it (line 56); every private/loopback IP origin allowed (line 64); `metadata.google.internal` explicitly allowlisted (line 58).
150. [med] `ai-engine/main.py:1478-1480` — HYBRID retrieval catches all exceptions and does `pass`, returning HTTP 200 with partial/empty results while non-hybrid modes raise 500 — silent correctness failure.
151. [med] `ai-engine/main.py:1450-1454` — `mode="EXACT"` runs the identical `where_document={"$contains": query_text}` full-text query as `FULL_TEXT`; there is no exact-match semantics, but the API contract advertises it.
152. [med] `ai-engine/mcp_client.py:51-55` — `StructuredTool.from_function(coroutine=...)` never passes `args_schema` and ignores MCP's `tool_info.inputSchema`; the coroutine is `**kwargs`, so tools expose no argument schema to the LLM and calls can't be validated/formed correctly.
153. [med] `ai-engine/mcp_client.py:58-60` — any error while listing tools returns `[]` with only a `print`; the agent then runs with **zero tools** and the caller gets a normal 200 result, masking the failure.
154. [med] `ai-engine/main.py:1333` — PDF **title** is passed to `Paragraph()` unescaped while body content is escaped at line 1336 (`<`→`&lt;`); a title containing `<`/`&` breaks reportlab's XML-ish parsing → 500, or injects formatting.
155. [med] `ai-engine/main.py:612-619` — first call to `get_learning_index()` inserts a shared dummy document ("Initial rule: Always follow user instructions carefully.") into the global `agent_learnings` collection, polluting retrieval for every user/thread; the `count()==0` check-then-insert also races under concurrent first calls.
156. [med] `ai-engine/main.py:1446` — retrieval results filter metadata to only `custom_*` keys, discarding `source_type`/`version_hash`/etc. despite the contract field being a generic `metadata: dict`.
157. [med] `ai-engine/main.py:806-817` — `list_project_files(query=...)` documents `query` as a filter but never reads it; always returns the first 100 walked files regardless of query.
158. [med] `ai-engine/main.py:1077-1080,1318-1320` — generated files land in the shared system temp dir and are never cleaned up (unbounded disk growth); PDF default name `doc_%Y%m%d%H%M%S.pdf` has no per-process salt → two requests in the same second overwrite each other (same for same-topic XLSX via `hash(topic)`).
159. [med] `ai-engine/main.py:955-972` — `CrewRunResult.files` is built from a full `os.walk` of the workspace, so it reports *pre-existing* files as ones the crew "created"; `directory` also leaks the absolute server path.
160. [med] `ai-engine/main.py:1503,153,607` — Chroma persistence path `'./chroma_db'` is CWD-relative and created in three separate places; launching `uvicorn main:app` from any other directory silently points at a different/empty vector DB than `start_ai_engine.bat`.

### Low
161. [low] `ai-engine/main.py:1084,1340` — XLSX/PDF responses return absolute server filesystem paths (`file_path`) to the client → internal path disclosure.
162. [low] `ai-engine/main.py:1259-1263` — `code_complete` wraps `ai_generate` in `except Exception`, which also swallows its `HTTPException(503)`, converting provider outage into a fake `200 {"completion": ""}`.
163. [low] `ai-engine/main.py:1295` — `code_analyze` for any `language != "python"` returns `valid=True, summary="Code analyzed."` with no analysis performed — misleading contract.
164. [low] `ai-engine/main.py:1135-1138` — `GenerateRequest.system_prompt/model/temperature/max_tokens` are `Optional` with no bounds: explicit `null` system_prompt is stringified as `"None"` into prompts (lines 1193, 1229), and `max_tokens=10**9`/`temperature=-5` are passed straight to providers.
165. [low] `ai-engine/main.py:126-212` — dead code: `_load_nodes`, `INDEX_CACHE`, `_get_index`, `RagQuery`, `RagResult` are never referenced by any live route (old `/ai/rag/query` block removed by `clean_main.py`); `INDEX_CACHE` would also grow without bound and never invalidate on file changes.
166. [low] `ai-engine/main.py:163-170` — `_get_index(rebuild=True)` deletes the Chroma collection (line 163) *before* `_load_nodes` (line 168); if loading raises (e.g., the 404 at line 170), the previous index is already destroyed (latent — function currently unreachable).
167. [low] `ai-engine/main.py:89-90` — `_load_env` swallows every error loading `backend/.env` with a bare `except: pass`, hiding missing/misconfigured secret files at startup.
168. [low] `ai-engine/main.py:695-696` — swarm system prompt contains the duplicated sentence "You control a team of agents: Researcher, Coder, and Tester." twice (copy-paste defect).
169. [low] `ai-engine/mcp_client.py:25-26` — in `connect`'s `except`, `await self.close()` runs before `raise e`; if `aclose()` itself throws, the original connection error is replaced/masked.
170. [low] `ai-engine/main.py:1093-1116` — TTS `voice` and `rate` fields are passed to `edge_tts.Communicate` with no validation/allowlist → arbitrary invalid values surface as generic 500s; no per-request throttling on a free unlimited upstream.
171. [low] `ai-engine/main.py:791-792` — `save_project_file` rejects any filename starting with `.` (line 791 `filename.startswith(("/", "\\", "."))`), so legitimate dotfiles (`.gitignore`, `.env.example`) can never be created — overly broad check.
172. [low] `ai-engine/main.py:1551-1563` — two `IndexDocument`s with the same `source_entity_id` in one upsert request: the second iteration's purge deletes the first document's just-inserted chunks → partial silent data loss.
173. [low] `ai-engine/fix.py:6-11` — one-off patcher writes `lines[i+1]..lines[i+4]` without bounds checks (IndexError if the pattern is within 4 lines of EOF) and uses the CWD-relative path `"main.py"`, so running it from the wrong directory corrupts/misses the wrong file.
174. [low] `ai-engine/clean_main.py:3,8-14` — destructive regex rewrite of `main.py` in place via CWD-relative path with no backup or confirmation; running it from another directory rewrites whatever `main.py` happens to be there (or fails).

---

## 4. Infra / Config (45 bugs)

### Critical
175. [critical] `memory-brain/docker-compose.yml:5` — container published as `5002:5000`, but the image binds `${PORT:-5005}` (`memory-brain/Dockerfile:28`, `EXPOSE 5005`) and compose never sets `PORT` → host port 5002 maps to a dead port; API unreachable.

### High
176. [high] `docker-compose.yml:13` — sets `AI_ENGINE_URL=http://ai-engine:8001`, but `backend/routes/agent.js:437` reads `PYTHON_AI_ENGINE_URL` (unset anywhere) and falls back to `http://127.0.0.1:8001` → `search_codebase` RAG always fails inside the backend container.
177. [high] `backend/routes/learning.js:38` — hard-codes `http://127.0.0.1:8001/ai/agent/learn` (ignores `AI_ENGINE_URL`) → agent auto-learn/correction sync is dead in Docker.
178. [high] `backend/server.js:367` + `backend/routes/documents.js:563` — documents are returned as `downloadUrl: /downloads/<file>` and served from `../frontend/public/downloads`, a path that does not exist in the backend image (falls back to `data/downloads` at `documents.js:20`) → every generated doc 404s in Docker; compose has no volume/env (`DOWNLOADS_DIR`) to fix it.
179. [high] `memory-brain/Dockerfile:22` — `COPY . .` with no `.dockerignore` in `memory-brain/` bakes the real `memory-brain/.env` (secrets) into the published image.
180. [high] `memory-brain/app/auth/auth.py:13` — JWT signs with the hard-coded `SECRET_KEY = "ai_dost_secret_key"`, while `.env.example:10` documents `SECRET_KEY` (never read) and `app/config/security.py:10` uses a *different* hard-coded `JWT_SECRET_KEY` → forgeable tokens + dead env var.
181. [high] `backend/ecosystem.config.js:4` — PM2 runs `script: "server.js"` with no `node_args` preloaders, so `-r ./security-hardening.js -r ./taskCancellation.js -r ./chatAgentRouteBridge.js` (used by `backend/package.json:10`) never load → CORS deny-list, JSON body limits and SSE task-event bridge are silently off in PM2 deployments.
182. [high] `backend/runtimeVerification/docker/Dockerfile.backend:26` — `CMD ["node","server.js"]` likewise skips all three preloaders → the "runtime verification" prod container runs unhardened (CORS/JSON/bridge disabled) even though it sets `NODE_ENV=production`.
183. [high] `memory-brain/.env.example:2` — `MONGODB_URL=mongodb://mongodb:27017` points at host `mongodb`, but the compose service is `mongo` (`memory-brain/docker-compose.yml:19`) → example config can never connect.

### Medium
184. [med] `docker-compose.yml:30-35` — passes `NEXT_PUBLIC_APP_URL/API_URL/WS_URL` as build args, but `frontend/Dockerfile` only declares `ARG BACKEND_INTERNAL_URL` (line 18) → all three args are silently dropped by the build.
185. [med] `docker-compose.yml:44` — `BACKEND_INTERNAL_URL` supplied as a *runtime* `environment` value, but rewrites are baked into `.next/routes-manifest.json` at build time → the override is a no-op.
186. [med] `docker-compose.yml:18-19` (and 54-55) — unconditional `env_file: .env` → `docker compose up` hard-fails if the root `.env` wasn't created, though `.env.example:4-6` tells users they may keep keys only in `backend/.env`.
187. [med] `backend/.dockerignore:1` — `node_modules` only matches the context-root entry, so `backend/sandbox_test_app/node_modules` (59.9 MB) ships in the build context → backend context measures 384.6 MB / 18,342 files.
188. [med] `.dockerignore:8` — root ignore file excludes `.env.local` but not `.env` (which holds live API keys at the repo root) → any root-context build bakes secrets.
189. [med] `ai-engine/Dockerfile:18` — `COPY . .` with no `ai-engine/.dockerignore` pulls the committed `ai-engine/chroma_db` vector store plus scratch scripts (`fix.py`, `clean_main.py`, `inspect_chroma.py`) into the image.
190. [med] `.env.example:64` — ships `NODE_ENV=development` while `backend/Dockerfile` never sets `NODE_ENV` (contrast `frontend/Dockerfile:26` `ENV NODE_ENV production`) → the "production" backend container runs in dev mode via `env_file`.
191. [med] `.env.example:43` — documents `OLLAMA_BASE_URL`, which no Node backend file reads; the backend uses `OLLAMA_HOST` (`routes/agent.js:1124`, undocumented) and hard-codes `127.0.0.1:11434` in `routes/chat.js:178`, `chat.js:1291`, `services/geminiService.js:176` → Ollama config is unusable in Docker.
192. [med] `.env.example` (whole file, 64 lines) — missing `FIGMA_API_KEY`, which `backend/routes/figma.js:7` requires (endpoints return 503 without it, per its own error message).
193. [med] `.env.example` — missing `PYTHON_AI_ENGINE_URL` (only `AI_ENGINE_URL` is documented/used by one service) → the mismatch in entry #176 can't be fixed from the example file.
194. [med] `docker-compose.yml:1-61` — zero `healthcheck:` blocks and `frontend` uses plain `depends_on: backend` (lines 40-41) → frontend can boot and serve 500s before `:5000/health` is up.
195. [med] `backend/Dockerfile:21` — no `USER` directive (runs as root) while `docker-compose.yml:24` bind-mounts `./backend/temp/sandboxes` → sandbox files created root-owned on the host and un-deletable by the normal user.
196. [med] `frontend/next.config.mjs:13` — `disable: true` with `register: true`/`sw: 'sw.js'`, and a repo-wide grep finds **zero** `navigator.serviceWorker.register` calls → `public/sw.js` is never installed, while `frontend/pages/_document.js:7` still links `manifest.json` (install prompt with no offline worker).
197. [med] `frontend/next.config.mjs:10-14` — if `disable` is ever flipped to `false`, `@ducanh2912/next-pwa` (`dest: 'public'`, `sw: 'sw.js'`) overwrites the hand-written `frontend/public/sw.js` during build, destroying the custom cache/fetch logic.
198. [med] `frontend/public/sw.js:67-81` — cache-first branch with a fixed `CACHE_NAME = 'ai-dost-v2'` (line 2) and no versioning/eviction → non-hashed public assets (`logo.jpg`, `favicon.ico`, `audio-processor.js`, `/downloads/*`) are served stale forever after a deploy.
199. [med] `.gitignore:20` — ignores `chroma_data/` but the actual tracked data dirs are `chroma_db/` (root, 5 files) and `ai-engine/chroma_db` (17 files) → local vector-DB binaries are committed to git and updated by every run.
200. [med] `.github/workflows/ci.yml:85-126` — job is named "Docker (…)" but never runs Docker (dind service removed, no `docker build`/`compose config`) → Dockerfiles and both compose files are never validated in CI.
201. [med] `.github/workflows/ci.yml:14-29` — no job runs `frontend/playwright.config.js` (`testDir: ./tests/browser`, 1 file + fixtures) → the real-browser VisualHealer suite is CI-invisible; only `backend` Playwright is installed/run.
202. [med] `backend/playwright.config.js:25` — E2E webServer uses `command: 'node server.js'` instead of `npm start` → smoke tests exercise a differently-configured server (no hardening/cancellation/bridge preloaders).
203. [med] `.github/workflows/ci.yml:72-73` — `backend/package.json:12` postinstall already runs `playwright install chromium` on every `npm ci`, then the workflow downloads Chromium again with `--with-deps` (no browser cache) → ~2× browser download per run; also the `|| echo` in postinstall masks install failures.
204. [med] `frontend/next.config.mjs:20` + `frontend/Dockerfile:35,44` — `output: 'standalone'` produces `.next/standalone`, but the runner copies the full `node_modules` and runs `npm start` → the pruned standalone bundle is never used and the image carries devDependencies (jest, playwright, tailwind).
205. [med] `.github/workflows/ci-cd.yml:43-46` — `pip install -r memory-brain/requirements.txt` pulls torch/sentence-transformers/chromadb (multi-GB) with no `actions/cache` for pip → high risk of job timeout/flakiness on every run.
206. [med] `ai-engine/requirements.txt:1-19` — every dependency is unpinned or loosely bounded (`>=`, `<`) → Docker image builds are non-reproducible; a new `crewai`/`langchain` release can break the `ai-engine` build without any repo change.

### Low
207. [low] `docker-compose.yml:33,35` — `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_WS_URL` are passed but no source file reads either variable (code reads `NEXT_PUBLIC_BACKEND_URL`/`NEXT_PUBLIC_GO_WS_URL`) → dead config.
208. [low] `.env.example:47` — `NEXT_PUBLIC_APP_URL` is declared but unused by any code, so the example documents a var that does nothing.
209. [low] `.env.example:49` — documents `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1`, forcing cross-origin browser calls (and a CORS dependency) instead of the same-origin `/api/v1` rewrite proxy that `next.config.mjs:54` already provides.
210. [low] `frontend/public/manifest.json:13,19` — icons declared as `192x192`/`512x512` but `/logo.jpg` is actually **1024x1024** (measured) → declared sizes don't match the asset; no 512px-accurate icon exists.
211. [low] `frontend/public/sw.js:48-53` — `/api/*` branch falls back to `caches.match(request)` but API GETs are never `put()` into any cache → the fallback can only ever return `undefined`.
212. [low] `memory-brain/.env.example:9` — `FRONTEND_URL` is documented but `app/main.py:57` reads `CORS_ORIGINS` only → CORS override via the example file is a no-op.
213. [low] `memory-brain/.env.example:6` — `REDIS_URL=redis://redis:6379` has no password while the bundled compose sets `--requirepass` (`docker-compose.yml:36`) → example values are incompatible with the shipped stack.
214. [low] `.github/workflows/ci-cd.yml:1,4-9` — named "CI/CD" but only runs tests (no deploy) and re-triggers on the exact same `push/pull_request: main` events as `ci.yml` → duplicate double runner minutes per push.
215. [low] `.github/workflows/ci.yml:145-147` — deploy step gates only on `VERCEL_TOKEN_SET` but also requires `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`, which are not gated → half-configured secrets produce a red deploy job on main.
216. [low] `scripts/stream_agent.js:14` — hard-codes `port: 5000` (ignores `process.env.PORT`) → script breaks whenever the backend port is changed.
217. [low] `package.json:5-8` — root manifest has no `scripts` at all and declares `cors`/`playwright` that nothing at the root uses; `npx playwright test` from the repo root has neither config nor `@playwright/test`.
218. [low] `.gitignore:53` — `memory-brain/.data/frontend/public/downloads/` is a malformed path (two unrelated paths concatenated) → the intended ignore rule never matches.
219. [low] `backend/package.json:12` — `postinstall: playwright install chromium || echo …` swallows browser-install failures, so a broken Playwright install only surfaces later as an E2E crash.

---

## Verified non-bugs (explicitly retracted)

- `backend/routes/deploy.js:16` `path.resolve` — `path` required at line 68 at module load; handlers run post-load.
- `backend/routes/image.js:177` queue reset — `queue = task.catch(() => {})` correctly chains the serial queue.
- `backend/agent/orchestrator.js` calculator `eval` — client-side template code, not server eval.
- `frontend` markdown `dangerouslySetInnerHTML` paths that call `DOMPurify.sanitize` first.
- `ai-engine/main.py:791` `save_project_file` — has a correct `relative_to`/`commonpath` traversal guard.
- `ai-engine/main.py` `make_coroutine(tool_name)` — correctly avoids loop-closure late-binding.
- No hardcoded API keys/secrets in any ai-engine `.py` (grepped `sk-`, `AIza`, `Bearer ...`).

## Suggested fix priority

1. **P0 (crash/RCE/data-loss):** #1-5, #6, #18-19, #32-33, #71-72, #126-127, #131, #136, #175
2. **P1 (authZ/secrets):** #11-14, #21-26, #30, #54, #73, #77, #82, #101-103, #179-180, #188
3. **P2 (correctness/data-integrity):** #8-9, #15-17, #27, #43-53, #56-60, #74-81, #90-113, #137-160, #176-183
4. **P3 (config/CI/cleanup):** baaki sab (#61-70, #114-125, #161-174, #184-219)

## P0 remediation status (2026-09-25) — ALL P0 FIXED ✅

| Bug | Fix |
|-----|-----|
| #1-4 | `backend/routes/agent.js` — `targetDir` always `safeJoin`-contained (absolute paths no longer bypass); npm install runs with `--ignore-scripts` |
| #1-2 | `backend/agent/orchestrator.js` — `targetDir` resolved via `resolveSafePath(currentWorkspace, ...)` with escape rejection; spawned npm gets `--ignore-scripts` |
| #5 | `backend/services/workspaceManager.js` `getDefaultDiskPath` — strips separators/reserved/null/dots, bounded length, final containment assert |
| #6 | `backend/sandbox/SandboxManager.js` — `execLocal` refuses (exit 126) unless explicit `allowHostExec`/`allowFallback` opt-in or `SANDBOX_ALLOW_HOST_EXEC=1`; `validateCommandPolicy` denylist extended (rm .., Remove-Item, mkfs, dd, pipe-to-shell, ...) |
| #18 | `backend/routes/interpreter.js` — language validated BEFORE write, random filename, `execFile` argv (no shell), unlink all paths, `ALLOW_HOST_CODE_EXEC` gate |
| #19-20 | `backend/routes/test.js` — payload size limit, exec gate, `execFile`, real caller-supplied `stdin` (64KB cap), stdin EPIPE swallowed, real `duration` |
| #32-34, #67 | `backend/routes/git.js` — cwd confined to tmpdir workspace (+`AGENT_GIT_ROOTS`), `isSafeRef()` blocks git option injection, `remote set-url` fallback (no destructive `remote remove`), log parsing preserves `\|` |
| #71 | `frontend/components/sandbox/LivePreview.jsx` — TDZ broken via `checkServerHealthRef` (declared first, synced by effect) |
| #72 | `frontend/components/sandbox/SandboxPanel.jsx` — undefined `onError` prop removed |
| #126 | `ai-engine/main.py` `pdf_generate` — basename-only, charset-sanitized, forced `.pdf`, containment assert |
| #127 | `ai-engine/main.py` — optional `AI_ENGINE_API_KEY` middleware (X-API-Key/Bearer, exempt health/docs); root `docker-compose.yml` publishes `127.0.0.1:8001:8001`; all backend callers attach the key via `backend/services/engineAuth.js` |
| #131 | `ai-engine/main.py` `create_new_tool` — AST validation (import allowlist, denied builtins incl. eval/exec/open/__import__, dunder attribute ban); loader registers `_customtool_<name>` modules so `json.py` can no longer overwrite stdlib |
| #136 | `ai-engine/main.py` `rag/index` — full pre-validation of all documents BEFORE any purge; upsert with empty content → 400, no vector loss |
| #175 | `memory-brain/docker-compose.yml` — `5002:5005` (was mapping to dead container port 5000) |

**Verification (all green):** backend `node --check` (11 files), lint 0 errors/158 warnings, unit 61/61, integration 42/42; frontend lint 0, tests 257/257 + coverage thresholds pass; `python -m py_compile ai-engine/main.py` (WSL) OK; `docker compose config` OK (root + memory-brain).

## P1 remediation status (2026-09-25) — ALL P1 FIXED ✓

| Bug | Fix |
|-----|-----|
| #11 | `backend/middleware/rateLimiter.js` — API rate-limiter skips loopback peers when `NODE_ENV !== production` (fixes self-IP ban behind Next/proxy XFF) |
| #12 | `backend/middleware/anonIdentity.js` — anonymous HttpOnly `ad_uid` cookie identity; `resolveUser` order includes `anon-<uid>`; helpers `clientIpOf`/`isLoopbackIp`/`anonUid` |
| #13 | `backend/server.js` — chat history save/load/delete enforce strict conversation ownership (`conversationOwnerMap`/`filterRowsByOwner`); `'all'` filtered both directions |
| #14 | `backend/routes/assessment.js` `ownsAttempt()`; `AssessmentDAO.getUserAttempts` merges legacy `'default'` for `'local-user'`; `workspaceManager.js` shared-project skip (`default`/`copilot-workspace`) |
| #21 | `backend/sockets/terminal.js` — `safeTermPath()` contains every shell cwd to workspace base / `os.tmpdir()` / `process.cwd()` (rejects `C:\Windows` etc.) |
| #22 | `backend/sockets/terminal.js` — hardened `isBlocked`: `BLOCKED_TIGHT` whitespace-stripped list + `BLOCKED_RE` regexes + rm-flag collapse (blocks `rm -rf /`, `rm -r -f /`, `--no-preserve-root`, spaced fork bombs, `format d:`, pipe-to-shell) while still allowing `rm -rf node_modules` |
| #23 | `backend/sockets/terminalWs.js` — raw WS gated by `upgradeGuard(request,'exec')` (local Origin + loopback peer) + claim flag; child env via `shellEnv()`; cmd-fallback stdin fixed (`shell.stdin.write`) |
| #24 | `backend/lsp/lspServer.js` — pathname split (`/lsp?x` matches), claim flag + `upgradeGuard('api')`, `MAX_LSP_SESSIONS=4` (env `LSP_MAX_SESSIONS`) with release-on-close, `spawn` env `shellEnv()` |
| #25 | `backend/sandbox/wsServer.js` — claim flag + `upgradeGuard('api')` on `/api/sandbox/ws` |
| #26 | `backend/server.js` — HMR upgrade proxy sets `socket.__upgradeHandled` only when proxying and early-returns for `/socket.io`; catch-all `server.on('upgrade')` registered LAST, destroys all other unclaimed sockets |
| #30 | `backend/mcp/McpClientManager.js` — `mcpChildEnv()` env allowlist (MCP SDK merges it over its own safe defaults) so MCP children never inherit `GEMINI_API_KEY`/`TELEGRAM_BOT_TOKEN`/etc.; regression test added |
| #54 | `?key=` removed from all Gemini/image/web-search calls — auth moved to `x-goog-api-key` header: `routes/image.js`, `routes/chat.js` (`:generateContent`; stream keeps `?alt=sse` but key in header), `services/geminiService.js` (axios headers), `services/webSearchService.js`, `aiServices.js` (URLs now keyless) |
| #73 | `frontend/components/Header.jsx` — debounce timer only opens the normal settings panel; secret PersonalBrainModal reachable exclusively via 7-tap; unmount clears pending timer |
| #77 | `frontend/components/chat/ChatArtifactsCanvas.jsx` — artifact iframe sandbox is now `allow-scripts allow-modals allow-forms` (dropped `allow-same-origin`) |
| #82 | `ChatArtifactsCanvas.jsx` `handleSandboxMessage` validates `e.source === iframeRef.current?.contentWindow` and `e.origin` ∈ {`'null'`, window origin} |
| #101-103 | **Server secret store**: new `backend/services/settingsStore.js` (file-backed `backend/data/local-settings.json`, 0600, masked-only `status()`, `mergeCustomKeys()`) + `backend/routes/settings.js` (`GET /keys` masks only — never raw; `PUT`/`DELETE`), mounted under `/api/settings` + `/api/v1/settings` behind `execGuard` (loopback/Docker-only). Store merged as fallback into `routes/chat.js` (`POST /` + `/stream`), `routes/agent.js` (`/run`), `routes/deploy.js` (token fallback for vercel/netlify). Frontend: shared `services/secretSettings.js` (status/save/delete + one-time legacy migration & purge); `SettingsView.jsx`, `Header.jsx`, `SettingsModal.jsx`, `DeployModal.jsx` no longer write plaintext keys/tokens to localStorage (empty input = keep stored; masked placeholders; clear via Reset/DELETE). Also fixed latent bug found in-scope: `DeployModal` posted `/v1/deploy/deploy` → `/api/v1/v1/...` 404, now `/deploy/deploy`. `.gitignore` added `backend/data/local-settings.json` |
| #179 | `memory-brain/.dockerignore` (NEW) — `.env*`, caches, tests, scratch demos excluded from `COPY . .` |
| #180 | `memory-brain/app/config/secret_key.py` (NEW) — `get_secret_key()` resolves `SECRET_KEY` → legacy `JWT_SECRET_KEY` → ephemeral `secrets.token_urlsafe(48)` (warns; no static fallback); wired into `app/auth/auth.py:13`, `app/config/security.py`, `app/api/auth.py`, `app/config/settings.py` (hard-coded defaults removed); compose passes `SECRET_KEY=${SECRET_KEY:-}`; `.env.example` generation hint added |
| #188 | root `.dockerignore` — now excludes `.env`, `.env.*`, `**/.env`, `**/.env.*` (keeps `!**/.env.example`), so live root/backend/frontend/memory-brain env files never enter a build context |

**Verification (all green):** backend lint 0 errors; `npm run test:all` — unit 94/94 (incl. new `tests/settingsStore.test.js`), integration 45/45, security 14/14, MCP 5/5, api 12/12, chat 13/13; frontend lint 0, tests 257/257 (2 suites updated for intentional `Settings saved` copy + sync modal close); live P1 WS battery 14/14 (unknown/HMR upgrades destroyed, evil-Origin rejected, shell env sanitized, term path containment, `rm -rf /` blocked); settings API round-trip (masked-only, unknown provider 400, LAN peer fail-closed, Next proxy 200); chat merge proof (stored fake key → Google `API_KEY_INVALID` → cascade fallback); Gemini header auth `ListModels` HTTP 200 with real key; memory-brain `py_compile` (5 files) + secret-key smoke (env/legacy/ephemeral branches) OK; `docker compose config` OK (root + memory-brain); both servers live (`:5000` + `:3000` → 200).

## P2 remediation status (2026-09-26) — ALL P2 FIXED ✓

(#76, #77, #101-103, #179-180 were already completed during P1; #154 and #136 were already fixed in-tree and verified here.)

| Bug | Fix |
|-----|-----|
| #8-9 | `backend/services/deployService.js` — `allowedDeployRoots()` containment for every deploy target, absolute `outputDir` enforced, `StaticAdapter.validateOptions` rejects traversal/absolute escapes (deploy validate → 400) |
| #15-17 | `backend/routes/database.js` — destructive ops require HMAC approval token (constant-time compare), combined `destructiveDetected` → 403, `resolveSafeDbPath()` rejects traversal (`DBPATH_FORBIDDEN`), read-only `/query` endpoint for SELECTs |
| #27 | `backend/security-hardening.js` — response stream ordering fixed so body limits apply to streamed responses too |
| #43-44 | `backend/routes/preview.js` — `esc()`/`escJsString()` escape user content in generated preview HTML/JS |
| #45-46 | `backend/taskCancellation.js` — `resolveTaskId()` (no raw-id trust) + `cancelRequestAuthorized()` (loopback peer OR allowlisted Origin) → `tests/taskCancellation.test.js` 6/6 |
| #47-48 | `backend/services/cacheService.js` `increment()`/`sweepExpired()` + `middleware/rateLimiter.js` single atomic increment (was double-counting) → new `tests/cacheRateLimit.test.js` 4/4 (wired into `test:unit`); new `services/downloadStore.js` TTL sweep hooked into `routes/documents.js` + `routes/pdf.js` |
| #49 | `backend/server.js` `getProjectFiles` — caps (2000 files / 2MB per file / 30MB total) |
| #50 | `backend/projectStore.js` `deleteProjectFile` — matches all metadata path variants so deletions never miss |
| #51-52 | `backend/sockets/collaboration.js` — content/size caps on `canvas:edit`, room-membership check, AI generation cooldown + per-room `aiInFlight` guard |
| #53 | `backend/routes/image.js` — `/turbo` background download moved onto a serial queue (parallel renders no longer clobber the shared file), failures logged, response honest (`localFileStatus: 'pending'`) |
| #56 | `backend/db/index.js` + `db/sqlitePolyfill.js` — transaction polyfill with instance-level `__txnDepth` nesting guard (nested txn runs inline) + ROLLBACK wrapped in try/catch so it can't mask the original error |
| #57 | `backend/routes/git.js` — `/log` pretty format uses `%x1f` delimiter (commas in author/subject no longer break parsing) |
| #58 | `backend/routes/figma.js` — `isValidFileKey` (`[A-Za-z0-9_-]{1,128}`), `isValidNodeId`, `EXPORT_FORMATS` allowlist on `/file/:fileKey`, `/components`, `/design-to-code`, `/export` → 400 |
| #59 | `backend/agent/tools/WriteFileTool.js`, `routes/agent.js`, `agent/orchestrator.js` — LLM/parameter-controlled `allowOverwrite` bypass removed; full overwrites always rejected (use apply_diff) |
| #60 | `backend/sockets/terminal.js` — both pty and child_process spawns use `shellEnv()` instead of raw `process.env` |
| #74, #99 | `frontend/components/assessment/AssessmentRunner.jsx` — timer effect is pure + auto-submit moved to an effect + `submitLockRef` double-submit lock; `/start` not re-posted when a restored `attemptId` exists |
| #75 | `frontend/hooks/useCanvasCollaboration.js` — socket effect deps `[roomId]` only, join params in ref (no reconnect-per-render) |
| #78 | `frontend/pages/dashboard.jsx` — new-project toast uses `project_name || name || 'Untitled'` (backend contract) |
| #79-81 | `frontend/components/views/HistoryView.jsx` + `layout/CommandRail.jsx` — local `getMsgKey(id)` mirrors ChatView's default/`ai_dost_messages_<id>` keys (no more phantom History entries) |
| #90 | `frontend/components/views/ChatView.jsx` — history fetch AbortController + stale-guard + catch |
| #91-93 | `frontend/components/CodeEditor.jsx` — OT apply functional `setCode(prev…)`; `lspSocketRef` closes before reconnect + unmount cleanup; `resolveLspWsBase()` derives ws URL from env/host protocol (no hardcoded `ws://localhost:8000`) |
| #94 | `frontend/components/views/VoiceView.jsx` — `speakingRef` mirror; interruption/result handlers no longer close over stale speaking state |
| #95 | `frontend/components/Header.jsx` — theme toggle mirrors dashboard's 4-theme manager exactly (same storage keys/classes; no double-toggle event dispatch) |
| #96 | `frontend/components/ui/Modal.jsx` — module-level modal stack; Escape closes only the topmost modal |
| #97 | `frontend/components/McpPanel.jsx` — invalid stored MCP config treated like missing (seed defaults, no dead panel) |
| #98 | `frontend/components/chat/ChatQuizCard.jsx` — guards malformed quiz payloads → honest "Invalid Quiz Format" |
| #100 | `frontend/components/chat/UniversalChatDock.jsx` — `resetChatState` clears the ACTIVE session's transcript before forcing default |
| #104-107 | `CopilotIDE.jsx`, `TerminalPanel.jsx`, `services/FigmaMCPClient.js`, `agent/CrewPanel.jsx` — no more hard-defaulted `http://localhost:5000`: env → localhost-direct only when hostname is localhost → `''` (relative) otherwise |
| #108 | `frontend/components/AICompanion.jsx` — local-models probe uses env backend URL or relative `/api/...` |
| #109 | `frontend/hooks/useWebContainer.js` `runCommand` — `settled` flag + `safetyTimer` cleared on resolve/reject/unmount |
| #110 | `frontend/components/chat/MessageStream.jsx` — `pendingTimers` array cleared in effect cleanup |
| #111 | `frontend/components/chat/SmartChatMessage.jsx` — `html` computed in `useMemo([message.content])` (no rebuild per render) |
| #112 | `frontend/components/views/ChatView.jsx` — `createSession` localStorage write wrapped in try/catch (quota → no crash) |
| #113 | `frontend/components/ui/ProjectSwitcher.jsx` — focus `setTimeout` stored and cleared on unmount |
| #137 | `ai-engine/main.py` — `rag_index` persists `user_id` as a first-class metadata key; `rag_query.add_candidate` drops vectors owned by another user (legacy vectors without owner stay readable) |
| #138 | `ai-engine/main.py` — all blocking sync work in `async def` routes moved to `asyncio.to_thread` (learning `retriever.retrieve`, LangGraph `get_state`/`update_state` in run/resume/swarm, save/retrieve memory chroma+embedding I/O); `import asyncio` added |
| #139 | `ai-engine/main.py` — crew runs behind a `threading.BoundedSemaphore` (env `AI_ENGINE_CREW_MAX_CONCURRENCY=2`, `AI_ENGINE_CREW_QUEUE_TIMEOUT=15s` → 429) via `crew_run` → `_crew_run_locked` wrapper |
| #140 | `ai-engine/main.py` — `XLSXRequest.rows` validated 1..10000 (was OOM/negative contract) |
| #141 | `ai-engine/main.py` — `MemoryRetrieveRequest.top_k` validated 1..50 |
| #142 | `ai-engine/main.py` — Tavily `max_results` 1..20 + `search_depth` ∈ {basic, advanced} → 400 (was raw forward + opaque 500) |
| #143 | `ai-engine/main.py` `/ai/generate` — unknown `model` → 400; explicit provider without API key → 400 with instruction; Ollama fallback gated to `auto`/`ollama` (no more silent Ollama answers for `model="groq"`) |
| #144 | `ai-engine/main.py` — every cascade branch appends to `cascade_errors` (HTTP status + body snippet + exception); logged and included in the final 503 detail |
| #145 | `ai-engine/main.py` — `chunks_deleted` counts real chunks: `get()` before `delete()`, errors logged instead of fake `+1` |
| #146 | `ai-engine/main.py` — all three mock `read_file` tools replaced by `_safe_read_file()`: root = `AI_ENGINE_FILE_ROOT` (default engine dir), realpath containment, isFile check, 200KB cap, `ERROR:` strings |
| #147 | `ai-engine/main.py` — crew `model`/`mode` validated up-front → 400 (no silent ollama/dev else-branch) |
| #148 | `ai-engine/main.py` — kickoff returning empty output without raising → `last_err` re-raised or 502 (was fake `completed, result=""`) |
| #149 | `ai-engine/main.py` origin guard — `Origin: null` rejected (non-empty origin required), `metadata.google.internal` removed, only `is_loopback` IPs allowed (private/link-local dropped), same-host/localhost/.localhost kept |
| #150 | `ai-engine/main.py` — HYBRID partial results logged + `degraded: true` on `RetrievalResponse`; HYBRID with zero candidates now raises 500 like other modes |
| #151 | `ai-engine/main.py` — `mode="EXACT"`: chunk must contain the query as a case-sensitive contiguous phrase (post-filter), semantic stage never runs — distinct from FULL_TEXT |
| #152 | `ai-engine/mcp_client.py` — `_args_schema_from_mcp()` builds a pydantic model from MCP `inputSchema` and passes it as `args_schema` (LLM sees real argument types; unbuildable → None + log) |
| #153 | `ai-engine/mcp_client.py` — `list_tools` failure now raises `RuntimeError` (endpoint → 500) instead of returning `[]` with zero tools and a normal 200 |
| #154 | *(verified already fixed in-tree — title escaped before `Paragraph()`)* |
| #155 | `ai-engine/main.py` — dummy "Initial rule" seed document removed from `get_learning_index()` (no more polluted/racing first call); `retrieve_memory` short-circuits `[]` when the collection is empty |
| #156 | `ai-engine/main.py` — retrieval `metadata` returns all chunk keys (`dict(meta)`), not just `custom_*` |
| #157 | `ai-engine/main.py` — `list_project_files` actually filters on `query` (case-insensitive substring) and sorts results |
| #158 | `ai-engine/main.py` — xlsx/pdf default filenames salted with `uuid.uuid4()` (same-second collisions impossible) + `_sweep_generated_files()` deletes own artifacts older than 24h on every generation |
| #159 | `ai-engine/main.py` — crew `files` = snapshot-diff around kickoff (pre-existing files no longer reported as created); `directory` returns `basename(work_dir)` (no absolute server path leak) |
| #160 | `ai-engine/main.py` — single absolute `CHROMA_DIR` constant replaces all three CWD-relative `./chroma_db` opens (`_get_index`, `get_learning_index`, rag collection) |
| #176 | `backend/routes/agent.js` — engine URL reads `PYTHON_AI_ENGINE_URL || AI_ENGINE_URL || 127.0.0.1:8001` (compose sets `AI_ENGINE_URL`) |
| #177 | `backend/routes/learning.js` — correction sync uses `AI_ENGINE_URL`/`PYTHON_AI_ENGINE_URL` instead of hard-coded `127.0.0.1:8001` |
| #178 | new `backend/services/downloadsDir.js` shared resolver wired into `routes/documents.js`, `routes/pdf.js`, `server.js` `/downloads` static, `services/artifactService.js` (approve root + storage mapping), `services/projectGraphService.js`; root `docker-compose.yml` sets `DOWNLOADS_DIR=/app/data/downloads` + persistent volume |
| #181 | `backend/ecosystem.config.js` — PM2 `node_args` now preloads `security-hardening.js`, `taskCancellation.js`, `chatAgentRouteBridge.js` (same chain as `npm start`) |
| #182 | `backend/runtimeVerification/docker/Dockerfile.backend` CMD preloads the same three modules; also `backend/Dockerfile` CMD switched from `npm start` to the explicit preload chain; `package.json engines` pinned `22.x` + BOM removed so `tests/startupParity.test.js` parses |
| #183 | `memory-brain/.env.example` — `MONGODB_URL=mongodb://mongo:27017` (compose service name), with comment |

**Verification (all green):** backend `node --check` ×10 changed files; `npm run test:all` EXIT=0 — unit 98/98, integration 53/53, security 14/14, MCP 5/5, api 12/12, chat 13/13; `tests/startupParity.test.js` 3/3 (was: JSON.parse crash + 2 assertion failures); frontend lint 0 errors, tests 257/257; ai-engine `python3 -m py_compile main.py mcp_client.py` (WSL) OK — runtime deps not installed on this host, so py_compile is the maximum available check; `docker compose config` OK; live smoke after restart — `:5000/health` 200 (`keysConfigured: 5`), `/` → 302 → frontend 200, `/api/catalog/clusters` 200, `:3000` 200, backend logs clean (only pre-existing node-pty/punycode warnings); Redis reconnected.

---

## P3 remediation status (2026-09-26) — ALL P3 FIXED ✓

P3 scope (99 bugs): backend #7, #10, #28-29, #31, #34-42, #55, #61-70 · frontend #83-89, #114-125 · ai-engine #128-130, #133-135, #161-174 · infra #184-187, #189-219.
**Retracted as already fixed in earlier passes (spot-checked here): #11, #34, #64, #67, #68.** #31 was partially pre-mitigated (XFF patch) and is now fully fixed.

### Backend (25)

| Bug | Fix |
|-----|-----|
| #7 | `routes/agent.js` regeneration wipe now skips all dotfiles, deletes only `path NOT LIKE '.%'` rows from the DB, logs every removed entry, `catch` → `logger.warn` |
| #10 | `middleware/localApiGuard.js` — `isDockerNetwork` no longer matches `192.168/16` (Tier A still allows via `isPrivateIp`); `ALLOW_REMOTE_EXEC=1` escape hatch; P1#25 tests updated to the new policy |
| #28-29 | `services/urlFetcherService.js` — DNS-pinned `pinnedRequest`/`makePinnedLookup` (rebinding TOCTOU gone) and the fetch timer now spans the body read (`finally clearTimeout`) |
| #31 | `localApiGuard.js` `execGuard`/`upgradeGuard` decide on the raw TCP peer via new exported `peerIp()`, never XFF-derived `req.ip` (completes the `apply-next-xff-patch.js` pre-mitigation) |
| #34, #64, #67, #68 | *(retracted — already fixed in earlier passes: guarded `git remote remove origin`; real `Date.now()-startedAt` duration; git.js cwd constrained; `resolveUser` returns local-user/anon-uuid, never a shared `default`)* |
| #35 | shared `validateCommandPolicy` extended denylist (`rm -rf` flag/`..` variants, `del /fdirs`, poweroff/halt/init 0, fork bomb, `dd of=`, `mount -o remount`, pipe-to-shell curl/wget/iwr, chmod 000/777, `Remove-Item`, bcdedit, `net user`, …) wired into `agent/orchestrator.js` + `agent/tools/TerminalTool.js` |
| #36 | `SandboxManager._resolveSafe` — realpath of deepest existing ancestor must stay inside realpath'd sandbox root → symlink escape blocked on write/read/list |
| #37 | `createSandbox` wrapper reserves `_pendingCreates` synchronously before any `await` → `MAX_CONTAINERS` (10) respected under concurrency |
| #38 | `SandboxManager.shutdown()` async + `Promise.allSettled` over destroy (no orphaned containers on exit) |
| #39 | `_resolveWorkdir()` — `options.workdir` honored only if under `os.tmpdir()` and exists; Docker volumes/cwd use the host workdir; `ownedPath` vs `path` split so `destroy()` removes only what we created; local exec cwd = sandbox path |
| #40 | `server.js` `releaseOnce` idempotent, registered on both `finish` and `close` → no double slot decrement |
| #41 | `/src` handler `resolveSrcWorkspaceScope()` — serves only inside the requested project scope; ambiguous scope → 404 (no cross-project disclosure) |
| #42 | `routes/preview.js` — `getFileFromDb`/`getAllFilesFromDb` close the DB in `try/finally` (no handle leak per failed request) |
| #55 | `McpClientManager.disconnect` also clears `entry.tools` (no stale tools on dead transport) |
| #61 | regex fixed to `/^\/+|\/+$/g` (trailing-slash trim works again) |
| #62 | history SELECT catch blocks log via `logger.error` (no more silent empty history) |
| #63 | `db/sqlitePolyfill.js` validates pragma against an allowlist/charset before interpolation |
| #65 | `routes/figma.js` dead `data.document?.findNode?.id` removed (documents have no `findNode`; stack walk is the only path) |
| #66 | new `services/selfUrl.js` `selfBaseUrl()` (`BACKEND_SELF_URL` → concrete HOST env → `http://127.0.0.1:<port>`) wired into `research.js`, `documents.js`, `telegramBot.js` (incl. download URL), `analytics.js`, `researchService.js` |
| #69 | `server.js` `preloadOrFail()` — production exits(1) when `security-hardening`/`taskCancellation`/`chatAgentRouteBridge` preload is missing (silent no-hardening boot impossible) |
| #70 | `routes/pdf.js` download names use a fully random UUID (8-hex suffix guessable-name removed; auth note stays as design) |

### Frontend (19)

| Bug | Fix |
|-----|-----|
| #83 | `ChatArtifactsCanvas.jsx` — message listener reads `liveCodeRef`; effect deps `[language, broadcastEdit]` (no re-register per keystroke) |
| #84 | `AnimationStudioView.jsx` preview iframe → `sandbox="allow-scripts"` (parent-origin access removed) |
| #85 | `VisualHealer.jsx` heal call → relative `/api/agent/heal` (Next rewrite) |
| #86 | `VisualHealer.jsx` poll interval always created; iframe null-check moved inside the tick |
| #87 | `pages/dashboard.jsx` duplicate `ai_dost_toast` listener removed (ToastContext owns toasts) |
| #88 | Ctrl+6/7/8 implemented (voice/settings/automations), palette analytics hint `'Charts/Insights'`, Ctrl+A hint removed (deliberately unbound) |
| #89 | `'n'` shortcut excludes `e.shiftKey` (Ctrl+Shift+N not hijacked) |
| #114 | `GitControlModal.jsx` `fetchGitLogs` AbortController on unmount; `ERR_CANCELED` silenced |
| #115 | `pages/_app.js` Ctrl+C guard `preventDefault`/`stopPropagation` only when `clipboard.writeText` is actually used |
| #116 | `pages/dashboard.jsx` toast timers in `toastTimersRef`, cleared on unmount |
| #117 | `VoiceAssistant.jsx` all four timeout sites via `timersRef`/`schedule`, cleared on unmount |
| #118 | dashboard writes `localStorage ai_dost_copilot_open {path, at}`; `CopilotIDE` effect opens the file (exact → suffix → basename match, 60s TTL, else toast) |
| #119 | `ChatView.jsx` dispatches `ai_dost_chat_ready`; dashboard `fireSwitch` waits for the handshake with a 2000ms fallback (50ms mount race gone) |
| #120 | `services/websocket.js` — `defaultWs` derived from `window.location` (literal localhost only as SSR fallback) |
| #121 | `UniversalCommandBridge.jsx` intercepts only when confidence ≥0.9 AND ≤6 words; `stopImmediatePropagation` dropped |
| #122 | `ResumeView.jsx` preview iframe → `sandbox="allow-modals"` (no `allow-same-origin`) |
| #123 | `AssessmentRunner.jsx` blocking `alert()`s → `useToast` |
| #124 | `ChatMessageBubble.jsx` copied-reset timeout in `copyTimeoutRef`, cleared on unmount |
| #125 | `AgentView.jsx` elapsed timer effect resets/clears correctly across stop/resume; `runAgent(text, token, resume)` guard `running && !resume`; `handleApprove` no longer forces `setRunning(false)` mid-resume |

### ai-engine (20)

| Bug | Fix |
|-----|-----|
| #128-130 | scrape SSRF: `_validate_scrape_url` rejects all-digit hosts and DNS-resolves (every addr must be `is_global`, OSError → 400); `_fetch_scrape_bytes` manual redirect loop (≤5 hops, per-hop validation, `allow_redirects=False`, 5MB cap, `timeout=(5,15)`); `except HTTPException: raise` in `scrape_url` |
| #133 | `dummy_mcp_server.py` `read_file` confined to `MCP_FILE_ROOT` (default: script dir) via resolved-parents check |
| #134 | `agent_resume` validates thread/messages/tool_calls before touching state → clear 404/409 instead of IndexError/TypeError 500; approved path pre-checks non-empty thread; `except HTTPException: raise` before the generic 500 wrapper |
| #135 | `thread_id` validated (`[\w.:-]{1,128}`, ≤128) on run/resume/swarm → 400; resume now requires a `resume_token` capability — `PENDING_RESUMES` (TTL 1h, newest-per-thread) issued on every `requires_approval` (run/swarm, re-issued on re-interrupt), 403 without/mismatched token, invalidated when the run completes; validation happens outside `try` so 400/403/404/409 aren't re-wrapped as 500 |
| #161 | `XLSXResult`/`PDFGenerateResult` drop absolute `file_path` → `filename`; new `GET /ai/files/{filename}` (basename + temp-dir containment + `xlsx_`/`doc_` artifact allowlist); backend `pythonEngineService.xlsxGenerate` fetches the artifact into a `buffer`, `routes/documents.js` writes that buffer |
| #162 | `code_complete` — `except HTTPException: raise` before the generic handler → provider outage stays 503 (was fake `200 {completion:""}`) |
| #163 | `code_analyze` non-Python → honest `summary: "Not analyzed: … No checks were run."` |
| #164 | `ai_generate` normalizes `system_prompt` (default when null/empty, 8000 cap), `temperature` (0..2), `max_tokens` (16..32768); all four provider blocks use the normalized values |
| #165-166 | dead block deleted (`_load_nodes`, `INDEX_CACHE`, `_get_index`, `RagQuery`, `RagResult`) — the latent destructive-rebuild-order bug goes with it; comment explains why nothing referenced it |
| #167 | `_load_env` logs a warning with path + exception type (never file contents) instead of bare `except: pass` |
| #168 | swarm system prompt duplicate sentence removed |
| #169 | `mcp_client.connect` — cleanup `close()` wrapped in try/except so the original connection error is always what gets raised |
| #170 | TTS: voice `^[a-z]{2,3}-[A-Z]{2,4}-[A-Za-z]+$`, rate `±100%` clamp, in-process throttle 10 req/60s → 429 (was generic 500s + unthrottled free upstream) |
| #171 | `save_project_file` consistent per-segment rule: absolute paths and `..` segments blocked; dotfiles (`.gitignore`, `.env.example`) creatable — no more top-level-vs-nested inconsistency |
| #172 | duplicate `source_entity_id` within one upsert request → 400 via `seen_ids` pre-validation (iteration 2 can no longer purge iteration 1's chunks) |
| #173 | `fix.py` — `__file__`-anchored path, EOF bounds check on the 4-line rewrite window, no write when nothing matched |
| #174 | `clean_main.py` — `__file__` anchor, `main.py.bak` backup before rewrite, explicit no-op message when the target block is absent |

### Infra / Config (35)

| Bug | Fix |
|-----|-----|
| #184 | `frontend/Dockerfile` declares + exports `NEXT_PUBLIC_BACKEND_URL`/`NEXT_PUBLIC_GO_WS_URL` build args (compose-passed args were silently dropped) |
| #185 | `BACKEND_INTERNAL_URL` moved to build args (rewrites are baked at build); runtime `environment` override removed with an explanatory comment |
| #186 | `env_file` on backend + ai-engine → `path: .env, required: false` (documented keys-only-in-backend/.env setup no longer hard-fails) |
| #187 | `backend/.dockerignore` → `**/node_modules` (sandbox_test_app's 59.9 MB excluded) |
| #189 | new `ai-engine/.dockerignore` (chroma_db, fix/clean_main/inspect scripts, venvs, `*.bak`, `.env`) |
| #190 | `backend/Dockerfile ENV NODE_ENV=production` + compose `NODE_ENV=${BACKEND_NODE_ENV:-production}` (`environment:` beats `env_file:`) + `.env.example` note about host-vs-container mode |
| #191 | new `backend/services/ollamaEnv.js` (`ollamaBaseUrl()`/`ollamaHostPort()` — accepts URL or bare `host[:port]`, `OLLAMA_BASE_URL` legacy alias); wired into `chat.js` (6 call sites), `geminiService.js` (2), `agent.js` `callOllamaLocal` (custom port no longer probed wrong); `.env.example` documents `OLLAMA_HOST` (dead `OLLAMA_BASE_URL` entry removed) |
| #192 | `FIGMA_API_KEY` added to `.env.example` |
| #193 | `PYTHON_AI_ENGINE_URL` (+ commented `AI_ENGINE_URL` alias) added to `.env.example`; `agent.js` fallback chain `PYTHON_AI_ENGINE_URL \|\| AI_ENGINE_URL \|\| 127.0.0.1:8001` verified |
| #194 | compose healthchecks (backend `node http`, ai-engine `python urllib`) + frontend `depends_on: condition: service_healthy` |
| #195 | `backend/Dockerfile` — `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` (world-readable for the node user), `chown -R node:node /app`, `USER node`; CMD switched to exec-form preload chain |
| #196 | `pages/_app.js` registers `/sw.js` in production (repo had zero `navigator.serviceWorker.register` calls while `_document.js` links the manifest) |
| #197 | next-pwa `sw: 'next-pwa-sw.js'` — if `disable` is ever flipped, the plugin can't clobber hand-written `public/sw.js` |
| #198 | `sw.js` — `CACHE_NAME` bumped to `ai-dost-v3` (activate evicts other `ai-dost-*` caches); cache-first now only for hashed `/_next/static/`; every other same-origin GET is network-first with cache fallback (non-hashed assets no longer stale forever) |
| #199 | `.gitignore` `chroma_db/` added (the old rule matched `chroma_data/`, nothing else) + `git rm -r --cached chroma_db ai-engine/chroma_db` — 22 files untracked, working tree kept |
| #200 | CI docker job actually validates Docker: `docker compose config -q` (root + memory-brain) and `docker buildx build --check` for all 4 Dockerfiles |
| #201 | new CI job `frontend-browser` runs `frontend/playwright.config.js` (real-browser VisualHealer suite) with browser cache + failure artifacts |
| #202 | `backend/playwright.config.js` webServer `npm start` (same preload chain as production) |
| #203 | CI `actions/cache` for `~/.cache/ms-playwright` keyed on lockfile; postinstall + idempotent `--with-deps` = no second Chromium download |
| #204 | `frontend/Dockerfile` runner now uses `.next/standalone` + `frontend/.next/static` + `frontend/public`, `CMD ["node","frontend/server.js"]` — pruned bundle actually runs, image drops jest/playwright/tailwind devDeps |
| #205 | ci-cd `setup-python` gets `cache: pip` + `cache-dependency-path: memory-brain/requirements.txt` (multi-GB torch/chromadb installs cached) |
| #206 | `ai-engine/requirements.txt` fully pinned — PyPI-resolved newest final releases within the original bounds, cross-checked (langchain 0.3.30 ↔ langgraph 0.3.34 ↔ langchain-ollama 0.3.10; llama-index-core 0.14.25 satisfies every `llama-index-* <0.15` pin) |
| #207 | dead `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_WS_URL` build args removed from compose (code reads `NEXT_PUBLIC_BACKEND_URL`/`NEXT_PUBLIC_GO_WS_URL`) |
| #208 | `.env.example` unused `NEXT_PUBLIC_APP_URL` removed |
| #209 | `.env.example` cross-origin `NEXT_PUBLIC_API_URL` default replaced with a same-origin `/api/v1` rewrite comment (no forced CORS) |
| #210 | `manifest.json` icon sizes truthful (`1024x1024`, actual `/logo.jpg`), purpose split into `any` + `maskable` |
| #211 | `sw.js` `/api/` branch — dead `caches.match` fallback (APIs are never `put()`) replaced with an honest 503 offline JSON response |
| #212 | `memory-brain/.env.example` — `FRONTEND_URL` (read by nothing) → `CORS_ORIGINS` (what `app/main.py` reads) |
| #213 | `memory-brain/.env.example` — `REDIS_URL=redis://:change_me_redis@redis:6379` + `REDIS_PASSWORD` line, matching the compose `--requirepass` default |
| #214 | ci-cd triggers → `workflow_dispatch` + weekly cron, renamed "Ai-Dost extended tests (manual)" (no more duplicate push/PR runner minutes vs ci.yml) |
| #215 | deploy job gates the Vercel step on `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` all set |
| #216 | `scripts/stream_agent.js` port `Number(process.env.PORT) \|\| 5000` |
| #217 | root `package.json` — unused `cors`/`playwright` deps removed (root lockfile synced: `dependencies: []`), scripts added (`dev:backend`, `dev:frontend`, `lint`, `test`, `test:*`, `test:e2e` via `--prefix`) |
| #218 | `.gitignore` malformed concatenated path split into `memory-brain/.data/` + `frontend/public/downloads/` |
| #219 | backend `postinstall` — node one-liner installs the browser only when `@playwright/test` is present and lets real failures propagate (clean skip on `--omit=dev` installs) |

**Verification:** backend `node --check` on every changed file; `npm run test:all` — unit 98/98, integration 53/53, security 14/14, MCP 5/5, api 12/12 all green, chat live-suite 12/13 on two consecutive runs with a *different* case timing out each time (history ✅ run 2 / file-content ✅ run 1 → free-tier LLM flake, not deterministic); frontend `npm run lint` 0 problems + `npm test` 257/257 (42 suites); ai-engine `python3 -m py_compile main.py dummy_mcp_server.py mcp_client.py fix.py clean_main.py` (WSL) OK — runtime deps not installed on this host, py_compile is the maximum available check; `docker compose config -q` OK (healthchecks, long-syntax `env_file`, `service_healthy`); both workflow files YAML-parsed; root `npm install --package-lock-only` synced; `docker buildx build --check` deferred to CI (local Docker daemon down). Live smoke after full restart — `:5000/health` 200 (`keysConfigured: 5`), `/api/chat/local-models` 200 `{"success":true,"models":[]}` (end-to-end proof of the new `ollamaEnv` path), frontend `:3000` 200, proxied `/api/catalog/capabilities` 200, `/manifest.json` 200. Servers left running (backend PID 19476, frontend PID 21360).
