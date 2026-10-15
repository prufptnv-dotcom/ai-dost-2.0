/**
 * backgroundRun — P9 long-running work (frontend half).
 *
 * Two responsibilities:
 *  1. localStorage bookkeeping for a run that must OUTLIVE this page
 *     (refresh, tab close, crash): { runId, projectId, at }.
 *  2. attachRunEvents() — replay + live tail of a run's persisted SSE stream
 *     from `GET /api/agent/runs/:runId/events?after=N`, feeding each parsed
 *     event to a callback. Same `data: {json}` framing as /api/agent/run, so
 *     the server's dense seq equals "events seen so far" (start at 0 after a
 *     fresh load; the server replays from the top).
 *
 * eventToActions() is a PURE mapper (event -> UI actions) so the reattach
 * dispatcher is unit-testable without React and cannot drift silently from
 * the shapes the live handler already renders.
 */

export const BG_RUN_KEY = 'aidost_bg_run';

export function saveBgRun({ runId, projectId }) {
  if (!runId) return false;
  try {
    window.localStorage.setItem(BG_RUN_KEY, JSON.stringify({ runId, projectId: projectId || null, at: Date.now() }));
    return true;
  } catch (_) { /* private mode etc. — reattach just won't offer itself */ return false; }
}

export function loadBgRun() {
  try {
    const raw = window.localStorage.getItem(BG_RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.runId === 'string' ? parsed : null;
  } catch (_) { return null; }
}

/**
 * Clear the stored run — optionally ONLY if it is `runId` (never wipe a
 * different project's background run by accident).
 */
export function clearBgRun(runId = null) {
  try {
    if (runId) {
      const current = loadBgRun();
      if (!current || current.runId !== runId) return false;
    }
    window.localStorage.removeItem(BG_RUN_KEY);
    return true;
  } catch (_) { return false; }
}

/**
 * Consume a run's replay/tail stream. Resolves with the total event count
 * (= next `after`) when the server closes the stream (terminal event or the
 * run already being finished), rejects on HTTP/network failure.
 */
export async function attachRunEvents({ runId, after = 0, backend, onEvent, signal }) {
  if (!runId) throw new Error('runId required');
  const base = backend || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
  const res = await fetch(`${base}/api/agent/runs/${encodeURIComponent(runId)}/events?after=${Math.max(0, Math.floor(after) || 0)}`, { signal });
  if (!res.ok || !res.body) throw new Error(`replay failed: HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let count = Math.max(0, Math.floor(after) || 0);

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;
      let data = null;
      try { data = JSON.parse(payload); } catch (_) { continue; }
      if (!data || typeof data.type !== 'string') continue;
      count += 1;
      if (onEvent) onEvent(data, count);
    }
  }
  return count;
}

/**
 * PURE event -> action mapper for the reattach stream. Actions:
 *   { do: 'latestRunId', runId }
 *   { do: 'row', row }                    append a message row (live-handler shapes)
 *   { do: 'plan', tasks }                 replace milestone tasks
 *   { do: 'status', label, tone }         status strip
 *   { do: 'file', path, content }         workspace file upsert
 *   { do: 'done' }                        terminal — clear bg bookkeeping & stop
 * Events without a visible meaning map to [] (never throw on unknown types —
 * the backend is allowed to grow new events).
 */
export function eventToActions(data) {
  if (!data || typeof data.type !== 'string') return [];
  const t = data.type;

  if (t === 'run_started' || t === 'director_start') {
    return data.runId ? [{ do: 'latestRunId', runId: data.runId }] : [];
  }

  if (t === 'plan' && data.plan && Array.isArray(data.plan.tasks)) {
    return [{
      do: 'plan',
      tasks: data.plan.tasks.map((task, idx) => ({
        id: task.id || `task-${idx + 1}`,
        title: task.title || `Task ${idx + 1}`,
        status: task.status || 'pending'
      }))
    }];
  }
  if (t === 'director_plan' && Array.isArray(data.tasks)) {
    return [{
      do: 'plan',
      tasks: data.tasks.map((task, idx) => ({
        id: task.id || `task-${idx + 1}`,
        title: task.objective || task.title || `Task ${idx + 1}`,
        status: 'pending'
      }))
    }];
  }

  if (t === 'start' || t === 'thinking') {
    const msg = data.message || 'Working...';
    return [
      { do: 'status', label: `🚀 ${msg}`, tone: 'work' },
      { do: 'row', row: { role: 'assistant', kind: 'thought', content: `🚀 ${msg}` } }
    ];
  }

  if (t === 'step') {
    const log = data.stepLog || {};
    const content = typeof log.thought === 'object' ? JSON.stringify(log.thought)
      : typeof log.action === 'object' ? JSON.stringify(log.action)
        : (log.thought || log.action || 'Processing step');
    return [{ do: 'row', row: { role: 'assistant', kind: 'step', content } }];
  }

  if (t === 'file_written' || t === 'file_changed' || t === 'file') {
    const path = data.path || data.file;
    if (!path) return [];
    return [
      { do: 'file', path, content: data.content || '' },
      { do: 'row', row: { role: 'assistant', kind: 'file', file: path, content: `Created/Updated: ${path}` } }
    ];
  }

  if (t === 'terminal_output') {
    const out = String(data.output || data.text || '').trim();
    return out ? [{ do: 'row', row: { role: 'assistant', kind: 'step', content: `🖥️ Terminal:\n${out.slice(0, 2000)}` } }] : [];
  }

  if (t === 'self_heal') {
    const msg = String(data.message || data.reason || data.error || 'Agent detected a failure and is repairing it...');
    return [
      { do: 'status', label: `🛠️ ${msg.substring(0, 35)}`, tone: 'work' },
      { do: 'row', row: { role: 'assistant', kind: 'thought', content: `🛠️ Self-heal: ${msg}` } }
    ];
  }

  if (t === 'agent_status' || t === 'status') {
    const label = String(data.message || data.status || data.agent || '').trim();
    if (!label) return [];
    return [{ do: 'status', label, tone: data.status === 'FAILED' ? 'error' : 'work' }];
  }

  if (t === 'screenshot') {
    const shot = data.data || data.screenshot || data.image;
    return [{
      do: 'row',
      row: {
        role: 'assistant',
        kind: 'screenshot',
        image: shot ? `data:${data.mimeType || 'image/png'};base64,${shot}` : null,
        url: data.url || '',
        message: data.message || 'Live Application UI Verification Snapshot'
      }
    }];
  }

  if (t === 'error') {
    const msg = String(data.message || data.error || 'Agent run failed');
    return [
      { do: 'status', label: `⚠️ ${msg.substring(0, 40)}`, tone: 'error' },
      { do: 'row', row: { role: 'assistant', kind: 'error', content: `⚠️ ${msg}` } }
    ];
  }

  if (t === 'done') {
    const content = data.message || '🎉 Task completed.';
    return [
      { do: 'status', label: '✅ Done', tone: 'success' },
      { do: 'row', row: { role: 'assistant', kind: 'aistudio_card', model: 'Background run', content, summary: content } },
      { do: 'done' }
    ];
  }

  return [];
}
