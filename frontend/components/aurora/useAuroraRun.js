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
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || '';

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

  const abortRef = useRef(null);
  const taskIdRef = useRef(null);
  const lastPromptRef = useRef('');
  const rowsRef = useRef(rows);
  const contentsRef = useRef({});
  const unknownRef = useRef(new Map());
  const seqRef = useRef(0);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Elapsed ticks only while a run is live.
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const pushRow = useCallback((r) => {
    seqRef.current += 1;
    setRows((prev) => {
      const base = prev.length === 1 && prev[0].id === 'ready' ? [] : prev;
      return [...base.slice(-400), { id: `r${seqRef.current}`, ...r }];
    });
  }, []);

  const pushUserRow = useCallback((text) => {
    seqRef.current += 1;
    setRows((prev) => {
      const base = prev.length === 1 && prev[0].id === 'ready' ? [] : prev;
      return [
        ...base.slice(-400),
        { id: `u${seqRef.current}`, kind: 'user', label: 'you', detail: text, meta: stamp(), tone: 'user' },
      ];
    });
  }, []);

  const handleFile = useCallback((path, content) => {
    const prev = contentsRef.current[path];
    const hasPrev = typeof prev === 'string';
    const body = typeof content === 'string' && content.length > 0 ? content : hasPrev ? prev : '';
    let added = 0;
    let removed = 0;
    if (hasPrev && body) {
      try {
        const stats = diffStats(diffLines(prev, body));
        added = stats.added;
        removed = stats.removed;
      } catch (_) {}
    }
    contentsRef.current = { ...contentsRef.current, [path]: body };
    const isNew = !hasPrev;
    setFiles((prevFiles) => {
      const idx = prevFiles.findIndex((f) => f.path.toLowerCase() === path.toLowerCase());
      const entry = { path, add: added, del: removed, isNew };
      if (idx === -1) return [...prevFiles, entry];
      const next = [...prevFiles];
      next[idx] = entry;
      return next;
    });
    const meta = isNew && !added ? 'NEW' : `+${added}${removed ? ` −${removed}` : ''}`;
    pushRow({ kind: 'file', label: 'write', detail: path, meta, tone: 'accent' });
  }, [pushRow]);

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
            handleFile(a.path, a.content);
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

      const controller = new AbortController();
      abortRef.current = controller;
      const taskId = `aurora-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      taskIdRef.current = taskId;

      setRunning(true);
      setElapsed(0);
      setApproval(null);
      unknownRef.current = new Map();

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
            preferredModel: 'auto',
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

  const stepCount = rows.filter((r) => STEP_KINDS.has(r.kind)).length;

  return {
    rows,
    plan,
    files,
    running,
    elapsed,
    approval,
    stepCount,
    runId,
    send,
    stop,
    approve,
    dismissApproval: () => setApproval(null),
  };
}
