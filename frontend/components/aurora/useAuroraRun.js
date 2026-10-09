import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelAgentRun } from '../../lib/copilotStop';
import { diffLines, diffStats } from '../../lib/lineDiff';
import { buildChatHistory, mapRunEvent } from './auroraRun';

/**
 * P11 A2 — real run wiring for Aurora.
 *
 * send(prompt)  → POST /api/agent/run (SSE) → mapRunEvent → spine rows / plan
 *                 / files / approval, with the classic body contract
 *                 (userPrompt, projectId, taskId, chatHistory, copilotDirector,
 *                 permissionLevel, preferredModel) and header x-ai-dost-task-id.
 * stop()        → local AbortController + server cancel (lib/copilotStop), so
 *                 the backend director actually halts — not just the browser.
 *
 * Honest states: idle before the first run (READY row), elapsed timer tied to
 * the real run lifetime, files diffed against the previous content via
 * lib/lineDiff (NEW badge for first writes).
 *
 * P11 A3 — preview + run-scope diffs:
 *   contents  mirror of every file_written body → static srcdoc preview
 *             (PreviewEngine.generateLiveAppHtml) until a dev server is READY.
 *   devServer P5 state from `dev_server` SSE events + a mount-time probe of
 *             GET /api/preview/:projectId/status (P7 persists READY servers →
 *             the app shows live BEFORE the first run in this session).
 *   baselineRef per-path run-scope baseline (first sighting wins) so the Files
 *             tab diff = "what THIS run changed", with backend `previous`
 *             (agent.js:927) as the original when the file already existed.
 *   start/stopPreview — the director path (copilotDirector:true) never emits
 *             `dev_server` (ensureLivePreview only runs on the scaffold/ReAct
 *             paths), so the stage drives the existing preview API itself:
 *             POST /api/preview/:id/dev/start {projectPath:'.'} → READY, or
 *             /dev/stop → STOPPED. Same contracts CopilotIDE ships with.
 *
 * P11 A4 — run-finish auto-start: when a run ends having written files and
 *             nothing is serving (state null/STOPPED/FAILED), the hook boots
 *             the preview itself once (startPreviewRef); a Stop/abort skips it
 *             and a live/starting server is never re-kicked (devRef mirror).
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

// Diff panel storage cap per file (baseline + current). Beyond this the stats
// still render; the panel says so instead of dropping the row.
const MAX_DIFF_CHARS = 300000;

const READY_ROW = {
  id: 'ready',
  kind: 'status',
  label: 'ready',
  detail: 'Type a prompt — Enter starts a run',
  tone: 'muted',
};

// Kinds that count as executed "steps" in the header meter. 'step' = the
// PlannerExecutionLoop/agent step rows (they ARE the executed steps).
const STEP_KINDS = new Set(['step', 'tool', 'file', 'fix', 'term', 'diff']);

function stamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function useAuroraRun({ projectId = 'default', onToast } = {}) {
  const [rows, setRows] = useState([READY_ROW]);
  const [plan, setPlan] = useState([]);
  const [files, setFiles] = useState([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [approval, setApproval] = useState(null); // {token, gate}
  const [runId, setRunId] = useState(null);
  const [lastPrompt, setLastPrompt] = useState(''); // A5: retry re-sends it
  const [contents, setContents] = useState({}); // path → current body (preview)
  const [devServer, setDevServer] = useState({
    state: null,
    url: null,
    hostPort: null,
    framework: null,
    reason: null,
  });

  const abortRef = useRef(null);
  const taskIdRef = useRef(null);
  const lastPromptRef = useRef('');
  const rowsRef = useRef(rows);
  const contentsRef = useRef({});
  const baselineRef = useRef({}); // path → run-scope diff baseline (first win)
  const unknownRef = useRef(new Map());
  const seqRef = useRef(0);
  const devRef = useRef(null); // devServer mirror for the post-run auto-start
  const runTouchedFilesRef = useRef(false);
  const startPreviewRef = useRef(() => false);

  // P7: READY dev servers survive restarts — probe on mount so a running app
  // shows live immediately (failures just stay on the static fallback).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/preview/${encodeURIComponent(projectId)}/status`);
        if (!alive || !res || typeof res.json !== 'function') return;
        const data = await res.json();
        if (!alive || !data || !data.state || data.state === 'STOPPED') return;
        const next = {
          state: data.state,
          url: data.url || null,
          hostPort: data.hostPort ?? null,
          framework: data.framework || null,
          reason: data.error || null,
        };
        devRef.current = next;
        setDevServer(next);
      } catch (_) {
        /* no server running — static preview is the honest fallback */
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  // Keep the mirror fresh for the run-finish auto-start (state updates may
  // batch; the finally handler reads the LATEST value, not the last render's).
  useEffect(() => {
    devRef.current = devServer;
  }, [devServer]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Elapsed ticks only while a run is live.
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  // Capture the id BEFORE queueing the updater: React may batch several
  // pushRow calls into one render pass, and an id read from seqRef inside the
  // updater would resolve to the SAME final counter value for each queued
  // call → duplicate keys ("Encountered two children with the same key, r7").
  const pushRow = useCallback((r) => {
    seqRef.current += 1;
    const id = `r${seqRef.current}`;
    setRows((prev) => {
      const base = prev.length === 1 && prev[0].id === 'ready' ? [] : prev;
      return [...base.slice(-400), { id, ...r }];
    });
  }, []);

  const pushUserRow = useCallback((text) => {
    seqRef.current += 1;
    const id = `u${seqRef.current}`;
    setRows((prev) => {
      const base = prev.length === 1 && prev[0].id === 'ready' ? [] : prev;
      return [
        ...base.slice(-400),
        { id, kind: 'user', label: 'you', detail: text, meta: stamp(), tone: 'user' },
      ];
    });
  }, []);

  const handleFile = useCallback(
    (path, content, meta = {}) => {
      runTouchedFilesRef.current = true;
      const hadLocal = typeof contentsRef.current[path] === 'string';
      const body =
        typeof content === 'string' && content.length > 0 ? content : hadLocal ? contentsRef.current[path] : '';
      // Watch-style path-only events carry nothing to render — a row, no entry.
      if (body === '' && !hadLocal) {
        pushRow({ kind: 'file', label: 'file', detail: path, meta: '', tone: 'muted' });
        return;
      }

      // Run-scope baseline: FIRST sighting wins (session-mount lifetime) so the
      // Files diff = "what changed here", not just the last write's delta.
      if (!(path in baselineRef.current)) {
        baselineRef.current[path] =
          typeof meta.previous === 'string'
            ? meta.previous // backend snapshot for pre-existing files
            : hadLocal
              ? contentsRef.current[path]
              : '';
      }
      const baseline = baselineRef.current[path];

      let added = 0;
      let removed = 0;
      try {
        const stats = diffStats(diffLines(baseline, body));
        added = stats.added;
        removed = stats.removed;
      } catch (_) {}

      const overCap = baseline.length + body.length > MAX_DIFF_CHARS;
      const isNew = baseline === '' && body !== '';
      contentsRef.current = { ...contentsRef.current, [path]: body };
      setContents((c) => ({ ...c, [path]: body }));
      setFiles((prevFiles) => {
        const idx = prevFiles.findIndex((f) => f.path.toLowerCase() === path.toLowerCase());
        const entry = {
          path,
          add: added,
          del: removed,
          isNew,
          prev: overCap ? null : baseline,
          next: overCap ? null : body,
          nodiff: overCap,
        };
        if (idx === -1) return [...prevFiles, entry];
        const next = [...prevFiles];
        next[idx] = entry;
        return next;
      });
      const metaLabel = isNew ? 'NEW' : `+${added}${removed ? ` −${removed}` : ''}`;
      pushRow({ kind: 'file', label: 'write', detail: path, meta: metaLabel, tone: 'accent' });
    },
    [pushRow]
  );

  /** Apply mapped actions; returns true when the stream must stop. */
  const applyActions = useCallback(
    (actions) => {
      let stop = false;
      for (const a of actions) {
        switch (a.op) {
          case 'row':
            pushRow(a.row);
            break;
          case 'plan':
            setPlan(a.tasks);
            break;
          case 'task':
            setPlan((prev) =>
              prev.map((t) => {
                if (t.id !== a.id) return t;
                const s = String(a.status || '').toLowerCase();
                const status =
                  s === 'succeeded' || s === 'completed'
                    ? 'done'
                    : s === 'failed' || s === 'error'
                      ? 'error'
                      : s === 'retrying'
                        ? 'active'
                        : 'active';
                return { ...t, status };
              })
            );
            break;
          case 'planAllDone':
            setPlan((prev) => prev.map((t) => ({ ...t, status: 'done' })));
            break;
          case 'file':
            handleFile(a.path, a.content, { previous: a.previous, isNew: a.isNew });
            break;
          case 'devServer':
            devRef.current = a.server;
            setDevServer(a.server);
            break;
          case 'runId':
            setRunId(a.runId);
            break;
          case 'approval':
            setApproval({ token: a.token, gate: a.gate });
            break;
          case 'unknown': {
            const seen = (unknownRef.current.get(a.type) || 0) + 1;
            unknownRef.current.set(a.type, seen);
            if (seen <= 2) pushRow(a.row); // first 2 per type as rows, then silent
            break;
          }
          case 'end':
            stop = true;
            break;
          default:
            break;
        }
      }
      return stop;
    },
    [handleFile, pushRow]
  );

  const send = useCallback(
    async (prompt, opts = {}) => {
      const text = String(prompt || '').trim();
      // Approval resume bypasses the running guard: if the paused run still
      // holds its old stream open, Approve must still start the token run.
      if (!text || (running && !opts.approvalToken)) return false;

      if (!opts.approvalToken && !opts.skipUserRow) pushUserRow(text);
      lastPromptRef.current = text;
      setLastPrompt(text);

      const controller = new AbortController();
      abortRef.current = controller;
      const taskId = `aurora-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      taskIdRef.current = taskId;

      setRunning(true);
      setElapsed(0);
      setApproval(null);
      unknownRef.current = new Map();
      runTouchedFilesRef.current = false;
      let aborted = false;

      try {
        const res = await fetch(`${BACKEND}/api/agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ai-dost-task-id': taskId },
          body: JSON.stringify({
            userPrompt: text,
            projectId,
            taskId,
            chatHistory: buildChatHistory(rowsRef.current),
            copilotDirector: true,
            permissionLevel: opts.permissionLevel || 'auto',
            // A5: model picker + @file mention context (classic parity).
            preferredModel: opts.preferredModel || 'auto',
            ...(opts.projectFiles && opts.projectFiles.length ? { projectFiles: opts.projectFiles } : {}),
            ...(opts.contextFiles && opts.contextFiles.length ? { contextFiles: opts.contextFiles } : {}),
            ...(opts.approvalToken ? { approvalToken: opts.approvalToken } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Agent request failed: ${res.status || res.statusText}`);
        if (!res.body || typeof res.body.getReader !== 'function') {
          throw new Error('Agent stream unavailable (no body)');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;

        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            if (jsonStr === '[DONE]') {
              finished = true;
              break;
            }
            try {
              const data = JSON.parse(jsonStr);
              if (applyActions(mapRunEvent(data))) {
                finished = true;
                break;
              }
            } catch (_) {
              /* malformed frame — never kill the stream over one line */
            }
          }
          if (finished) {
            try {
              await reader.cancel();
            } catch (_) {}
          }
        }
      } catch (err) {
        if (err && err.name === 'AbortError') {
          aborted = true;
          pushRow({ kind: 'stop', label: 'stop', detail: 'run stopped', tone: 'muted' });
        } else {
          const message = String((err && err.message) || err).slice(0, 200);
          pushRow({ kind: 'error', label: 'error', detail: message, tone: 'err' });
          if (typeof onToast === 'function') onToast(message, 'error');
        }
      } finally {
        // Only the still-active run may clear running — a stopped run's finally
        // must never kill a newer run started meanwhile (classic guard).
        if (abortRef.current === controller) {
          abortRef.current = null;
          setRunning(false);
          // A4: the director path never emits `dev_server` — boot the preview
          // once the run actually produced files and nothing is serving yet.
          // Skipped after Stop/abort (user chose to end the run) and when a
          // server is already live/starting (devRef = latest state, batched or
          // not). Failures land in the honest FAILED chip like a manual start.
          const st = devRef.current ? devRef.current.state : null;
          if (!aborted && runTouchedFilesRef.current && (st === null || st === 'STOPPED' || st === 'FAILED')) {
            startPreviewRef.current();
          }
        }
      }
      return true;
    },
    [applyActions, onToast, projectId, pushRow, pushUserRow, running]
  );

  const stop = useCallback(() => {
    if (!abortRef.current) return;
    // Local abort + server-side cancel: the director loop must halt too.
    cancelAgentRun({ backend: BACKEND, taskId: taskIdRef.current, controller: abortRef.current });
    pushRow({ kind: 'stop', label: 'stop', detail: 'stopping run…', tone: 'muted' });
    setRunning(false);
    if (typeof onToast === 'function') onToast('Run stopped');
  }, [onToast, pushRow]);

  const approve = useCallback(() => {
    if (!approval || !lastPromptRef.current) return;
    const token = approval.token;
    setApproval(null);
    return send(lastPromptRef.current, { approvalToken: token, skipUserRow: true });
  }, [approval, send]);

  const [previewBusy, setPreviewBusy] = useState(false);

  // Boot the real dev server for this project (start can take a while —
  // install + framework boot — so STARTING is a first-class chip state).
  const startPreview = useCallback(async () => {
    if (previewBusy) return false;
    setPreviewBusy(true);
    devRef.current = { ...devRef.current, state: 'STARTING', reason: null };
    setDevServer((prev) => ({ ...prev, state: 'STARTING', reason: null }));
    try {
      const res = await fetch(`${BACKEND}/api/preview/${encodeURIComponent(projectId)}/dev/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: '.' }),
      });
      const data = res && typeof res.json === 'function' ? await res.json() : null;
      if (data && data.success !== false && data.ok !== false && (data.url || data.hostPort != null)) {
        const next = {
          state: 'READY',
          url: data.url || null,
          hostPort: data.hostPort ?? null,
          framework: data.framework || null,
          reason: null,
        };
        devRef.current = next;
        setDevServer(next);
        pushRow({
          kind: 'dev',
          label: 'preview',
          detail: `live preview on :${data.hostPort ?? '?'}`,
          tone: 'ok',
        });
        if (typeof onToast === 'function') onToast('Live preview started');
        return true;
      }
      const reason = (data && (data.error || data.reason)) || 'dev server failed to start';
      devRef.current = { state: 'FAILED', url: null, hostPort: null, framework: null, reason };
      setDevServer({ state: 'FAILED', url: null, hostPort: null, framework: null, reason });
      pushRow({ kind: 'dev', label: 'preview', detail: `preview server failed — ${reason}`, tone: 'err' });
      if (typeof onToast === 'function') onToast(reason, 'error');
      return false;
    } catch (err) {
      const reason = String((err && err.message) || err).slice(0, 160);
      devRef.current = { state: 'FAILED', url: null, hostPort: null, framework: null, reason };
      setDevServer({ state: 'FAILED', url: null, hostPort: null, framework: null, reason });
      pushRow({ kind: 'dev', label: 'preview', detail: `preview server failed — ${reason}`, tone: 'err' });
      return false;
    } finally {
      setPreviewBusy(false);
    }
  }, [onToast, previewBusy, projectId, pushRow]);

  // send()'s auto-start runs before this callback exists in the module graph —
  // route it through a ref that always points at the live implementation.
  useEffect(() => {
    startPreviewRef.current = startPreview;
  }, [startPreview]);

  const stopPreview = useCallback(async () => {
    if (previewBusy) return;
    setPreviewBusy(true);
    try {
      await fetch(`${BACKEND}/api/preview/${encodeURIComponent(projectId)}/dev/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const next = { state: 'STOPPED', url: null, hostPort: null, framework: null, reason: null };
      devRef.current = next;
      setDevServer(next);
      pushRow({ kind: 'dev', label: 'preview', detail: 'preview server stopped', tone: 'muted' });
    } catch (_) {
      /* keep the last known state — a failed stop must not blank the chip */
    } finally {
      setPreviewBusy(false);
    }
  }, [previewBusy, projectId, pushRow]);

  const stepCount = rows.filter((r) => STEP_KINDS.has(r.kind)).length;

  return {
    rows,
    plan,
    files,
    contents,
    devServer,
    previewBusy,
    running,
    elapsed,
    approval,
    stepCount,
    runId,
    lastPrompt,
    send,
    stop,
    approve,
    startPreview,
    stopPreview,
    dismissApproval: () => setApproval(null),
  };
}
