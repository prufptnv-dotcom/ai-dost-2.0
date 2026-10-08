/**
 * P9 — background run bookkeeping + reattach stream (frontend half).
 * Zero network: fetch is mocked with a hand-built SSE ReadableStream.
 */
import {
  BG_RUN_KEY,
  saveBgRun,
  loadBgRun,
  clearBgRun,
  attachRunEvents,
  eventToActions,
} from '../lib/backgroundRun';

function sseResponse(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
  return { ok: true, status: 200, body: stream };
}

describe('P9 — backgroundRun storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips a saved run', () => {
    expect(saveBgRun({ runId: 'run-abc', projectId: 'p9' })).toBe(true);
    const loaded = loadBgRun();
    expect(loaded.runId).toBe('run-abc');
    expect(loaded.projectId).toBe('p9');
    expect(typeof loaded.at).toBe('number');
  });

  it('refuses to save without a runId', () => {
    expect(saveBgRun({ projectId: 'p9' })).toBe(false);
    expect(loadBgRun()).toBeNull();
  });

  it('clearBgRun(runId) only clears a MATCHING run (never wipes another project)', () => {
    saveBgRun({ runId: 'run-abc', projectId: 'p9' });
    expect(clearBgRun('run-other')).toBe(false);
    expect(loadBgRun()).not.toBeNull();
    expect(clearBgRun('run-abc')).toBe(true);
    expect(loadBgRun()).toBeNull();
  });

  it('survives corrupt storage gracefully', () => {
    window.localStorage.setItem(BG_RUN_KEY, '{not json');
    expect(loadBgRun()).toBeNull();
  });
});

describe('P9 — attachRunEvents (replay stream)', () => {
  beforeEach(() => window.localStorage.clear());

  it('parses data: frames, skips keepalive/junk, counts dense seq', async () => {
    const events = [];
    const chunks = [
      ': keepalive\n\n',
      'data: {"type":"start","message":"hi"}\n\ndata: not-json\n\n',
      'data: {"type":"done","message":"ok"}\n\ndata: 42\n\n',
    ];
    const prevFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(sseResponse(chunks));
    try {
      const total = await attachRunEvents({
        runId: 'run-abc',
        backend: 'http://test',
        onEvent: (data) => events.push(data.type),
      });
      expect(events).toEqual(['start', 'done']);
      expect(total).toBe(2, 'count = events seen (the after= cursor)');
    } finally {
      global.fetch = prevFetch;
    }
  });

  it('starts the cursor at after= and carries it into the count', async () => {
    const prevFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(sseResponse(['data: {"type":"step"}\n\n']));
    try {
      const total = await attachRunEvents({ runId: 'r', after: 5, backend: 'http://test', onEvent: () => {} });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test/api/agent/runs/r/events?after=5',
        expect.objectContaining({})
      );
      expect(total).toBe(6, 'after + replayed events');
    } finally {
      global.fetch = prevFetch;
    }
  });

  it('rejects honestly on HTTP errors', async () => {
    const prevFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, body: null });
    try {
      await expect(attachRunEvents({ runId: 'gone', backend: 'http://test' })).rejects.toThrow(/404/);
    } finally {
      global.fetch = prevFetch;
    }
  });
});

describe('P9 — eventToActions (pure reattach dispatcher)', () => {
  it('maps run_started to the latestRunId action', () => {
    expect(eventToActions({ type: 'run_started', runId: 'run-1' })).toEqual([
      { do: 'latestRunId', runId: 'run-1' },
    ]);
  });

  it('maps plan + director_plan to milestone tasks', () => {
    const plan = eventToActions({ type: 'plan', plan: { tasks: [{ title: 'Build UI' }, { id: 't2', title: 'API', status: 'in_progress' }] } });
    expect(plan[0].do).toBe('plan');
    expect(plan[0].tasks[0]).toEqual({ id: 'task-1', title: 'Build UI', status: 'pending' });
    expect(plan[0].tasks[1].status).toBe('in_progress');

    const dir = eventToActions({ type: 'director_plan', tasks: [{ objective: 'Ship it' }] });
    expect(dir[0].tasks[0].title).toBe('Ship it');
  });

  it('maps file events to file upsert + visible row', () => {
    const acts = eventToActions({ type: 'file_written', path: 'src/App.jsx', content: 'x' });
    expect(acts.map(a => a.do)).toEqual(['file', 'row']);
    expect(acts[0].path).toBe('src/App.jsx');
    expect(acts[1].row.kind).toBe('file');
    expect(eventToActions({ type: 'file_written' })).toEqual([], 'no path = no action');
  });

  it('done yields card + done terminal; error yields error row (no done)', () => {
    const done = eventToActions({ type: 'done', message: 'all good' });
    expect(done.map(a => a.do)).toEqual(['status', 'row', 'done']);
    expect(done[1].row.kind).toBe('aistudio_card');
    const err = eventToActions({ type: 'error', message: 'boom' });
    expect(err.map(a => a.do)).toEqual(['status', 'row']);
    expect(err[1].row.kind).toBe('error');
  });

  it('unknown/junk events map to [] (backend may grow new types)', () => {
    expect(eventToActions({ type: 'quantum_event' })).toEqual([]);
    expect(eventToActions(null)).toEqual([]);
    expect(eventToActions('nope')).toEqual([]);
    expect(eventToActions({ noType: true })).toEqual([]);
  });

  it('step/thinking/self_heal render with message content', () => {
    const step = eventToActions({ type: 'step', stepLog: { thought: 'thinking hard' } });
    expect(step[0].row.content).toBe('thinking hard');
    const think = eventToActions({ type: 'thinking', message: 'planning' });
    expect(think[1].row.content).toContain('planning');
    const heal = eventToActions({ type: 'self_heal', message: 'fixing build' });
    expect(heal[1].row.content).toContain('fixing build');
  });
});

describe('P9 — CopilotIDE wiring (static source contract)', () => {
  const fs = require('fs');
  const path = require('path');
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'views', 'CopilotIDE.jsx'),
    'utf8'
  );

  it('sends background: true only when the toggle is on', () => {
    const bodyIdx = SRC.indexOf('fetch(`${BACKEND}/api/agent/run`');
    expect(bodyIdx).toBeGreaterThan(0);
    const body = SRC.slice(bodyIdx, bodyIdx + 1600);
    expect(body).toContain('...(runInBackground ? { background: true } : {})');
  });

  it('persists the run on run_started and clears it on done', () => {
    expect(SRC).toMatch(/if \(runInBackground && data\.runId\) saveBgRun\(/);
    expect(SRC).toMatch(/clearBgRun\(latestRunIdRef\.current\)/);
  });

  it('auto-reattaches from the stored run via status probe + events stream', () => {
    expect(SRC).toContain('loadBgRun()');
    expect(SRC).toMatch(/\/api\/agent\/runs\/\$\{encodeURIComponent\(stored\.runId\)\}/);
    expect(SRC).toContain('attachRunEvents({');
    expect(SRC).toContain('eventToActions(data)');
  });

  it('exposes a background toggle in the composer', () => {
    expect(SRC).toContain('data-testid="background-toggle"');
    expect(SRC).toContain("localStorage.setItem('ai_dost_copilot_background'");
  });
});
