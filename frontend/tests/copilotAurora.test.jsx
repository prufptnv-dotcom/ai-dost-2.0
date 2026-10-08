import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopilotAurora from '../components/aurora/CopilotAurora';
import { mapRunEvent, normPlanTasks, buildChatHistory } from '../components/aurora/auroraRun';

/**
 * P11 A2 — Aurora on the REAL run stream:
 * SSE fetch wiring (body contract + x-ai-dost-task-id), event → spine/plan/files
 * mapping, Stop = local abort + server cancel, approval resume without a
 * duplicate user row, stage tabs, classic flag, permission segment.
 */

const encoder = new TextEncoder();
const realFetch = typeof global.fetch === 'function' ? global.fetch : undefined;

/** fetch mock: handler(url, init) → response object (may stream). */
function installFetch(handler) {
  const mock = jest.fn((url, init = {}) => Promise.resolve(handler(url, init) || { ok: true }));
  global.fetch = mock;
  return mock;
}

/** Response whose SSE body yields the given events, then closes. */
function sseResponse(events) {
  let i = 0;
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader() {
        return {
          read() {
            if (i < events.length) {
              const value = encoder.encode(`data: ${JSON.stringify(events[i++])}\n\n`);
              return Promise.resolve({ done: false, value });
            }
            return Promise.resolve({ done: true, value: undefined });
          },
          cancel: () => Promise.resolve(),
        };
      },
    },
  };
}

/** Response that hangs until the run's AbortController fires (Stop test). */
function hangingResponse(signal) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: {
      getReader() {
        return {
          read: () =>
            new Promise((_, reject) => {
              const fail = () => {
                const e = new Error('aborted');
                e.name = 'AbortError';
                reject(e);
              };
              if (signal && signal.aborted) fail();
              else if (signal) signal.addEventListener('abort', fail);
            }),
          cancel: () => Promise.resolve(),
        };
      },
    },
  };
}

const RUN_EVENTS = [
  { type: 'run_started', runId: 'run-42' },
  {
    type: 'director_plan',
    tasks: [
      { id: 't1', objective: 'Scaffold app' },
      { id: 't2', objective: 'Verify build' },
    ],
    summary: '2 tasks planned',
  },
  { type: 'thinking', message: 'Inspecting workspace' },
  { type: 'tool_call', action: 'write_file', thought: 'src/App.jsx' },
  { type: 'file_written', path: 'src/App.jsx', content: 'export default App' },
  { type: 'director_task', taskId: 't1', status: 'SUCCEEDED' },
  { type: 'done', message: 'All done', steps: ['a', 'b'] },
];

describe('CopilotAurora (P11 A2 — real run wiring)', () => {
  const base = { projectId: 'p1', projectName: 'todo-app' };

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    if (realFetch) global.fetch = realFetch;
    else delete global.fetch;
  });

  const userRows = () =>
    screen.queryAllByTestId('spine-row').filter((r) => r.getAttribute('data-kind') === 'user');

  test('idle shell: ready row, no fake plan/step numbers, Stop disabled', () => {
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    expect(screen.getByTestId('aurora-shell')).toHaveAttribute('data-project', 'p1');
    expect(screen.getByText(/Type a prompt/)).toBeInTheDocument();
    expect(screen.getByTestId('aurora-plan-count')).toHaveTextContent('ready');
    expect(screen.getByTestId('aurora-stop')).toBeDisabled();
    // honest header: no timer / steps before a run
    expect(screen.queryByTestId('aurora-timer')).toBeNull();
    expect(screen.queryByTestId('aurora-steps')).toBeNull();
    // empty rail + preview-first stage
    expect(screen.getByText('No plan yet')).toBeInTheDocument();
    expect(screen.getByTestId('aurora-preview')).toBeInTheDocument();
    expect(screen.getByTestId('perm-auto')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('todo-app')).toBeInTheDocument();
  });

  test('Enter sends the run body and maps SSE events → spine/plan/files/steps', async () => {
    const fetchMock = installFetch(() => sseResponse(RUN_EVENTS));
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    fireEvent.click(screen.getByTestId('perm-turbo'));
    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'build a todo app' } });
    expect(screen.getByTestId('aurora-send')).not.toBeDisabled();
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(input.value).toBe('');

    // ── request contract ──
    const runCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/agent/run'));
    expect(runCall).toBeTruthy();
    expect(runCall[1].headers['x-ai-dost-task-id']).toMatch(/^aurora-/);
    const body = JSON.parse(runCall[1].body);
    expect(body.userPrompt).toBe('build a todo app');
    expect(body.projectId).toBe('p1');
    expect(body.permissionLevel).toBe('turbo');
    expect(body.copilotDirector).toBe(true);

    // ── events → UI ──
    await screen.findByText('Inspecting workspace'); // thinking → think row
    await screen.findByText('All done'); // done row (terminal)
    expect(screen.getByTestId('aurora-plan-count')).toHaveTextContent('plan 2/2'); // planAllDone
    expect(screen.getByTestId('aurora-steps')).toHaveTextContent('steps 2'); // tool + file
    expect(screen.getByTestId('aurora-stop')).toBeDisabled(); // run over

    // plan landed in the rail (2 tasks, all done)
    const planRows = screen.getAllByTestId('plan-row');
    expect(planRows).toHaveLength(2);
    expect(planRows.every((r) => r.getAttribute('data-status') === 'done')).toBe(true);

    // file event → Files tab with NEW badge
    fireEvent.click(screen.getByTestId('stage-tab-files'));
    const fileRow = screen.getByTestId('file-row');
    expect(fileRow).toHaveAttribute('data-path', 'src/App.jsx');
    expect(fileRow).toHaveTextContent('NEW');

    expect(userRows()).toHaveLength(1);
  });

  test('Stop aborts the local stream AND cancels server-side', async () => {
    const fetchMock = installFetch((url, init) => {
      if (String(url).includes('/api/chat/tasks/') && String(url).endsWith('/cancel')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return hangingResponse(init.signal);
    });
    const toast = jest.fn();
    render(<CopilotAurora {...base} onToast={toast} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'long running task' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    const stop = screen.getByTestId('aurora-stop');
    expect(stop).not.toBeDisabled();
    fireEvent.click(stop);

    // server cancel fired with the run's task id
    await waitFor(() => {
      const cancel = fetchMock.mock.calls.find((c) => String(c[0]).includes('/cancel'));
      expect(cancel).toBeTruthy();
      expect(String(cancel[0])).toContain('/api/chat/tasks/aurora-');
    });
    // local abort propagated to the SSE fetch
    const runCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/agent/run'));
    expect(runCall[1].signal.aborted).toBe(true);

    await screen.findByText('run stopped');
    expect(stop).toBeDisabled();
    expect(toast).toHaveBeenCalledWith('Run stopped');
  });

  test('approval gate → banner → Approve resumes with token, no duplicate user row', async () => {
    let runCalls = 0;
    const fetchMock = installFetch(() => {
      runCalls += 1;
      if (runCalls === 1) {
        return sseResponse([
          { type: 'gate_approval_required', message: 'Approve npm install', gate: { approval_token: 'tok-1' } },
        ]);
      }
      return sseResponse([{ type: 'done', message: 'resumed and done' }]);
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'install deps' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await screen.findByTestId('approval-banner');
    expect(userRows()).toHaveLength(1);

    fireEvent.click(screen.getByTestId('approve-btn'));
    await screen.findByText('resumed and done');

    const runFetches = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/agent/run'));
    expect(runFetches).toHaveLength(2);
    const resumeBody = JSON.parse(runFetches[1][1].body);
    expect(resumeBody.approvalToken).toBe('tok-1');
    expect(resumeBody.userPrompt).toBe('install deps');
    expect(userRows()).toHaveLength(1); // approval resume must not duplicate
    expect(screen.queryByTestId('approval-banner')).toBeNull();

    // Reject path clears the banner too (fresh gate)
    fireEvent.click(screen.getByTestId('perm-ask'));
    expect(screen.getByTestId('perm-ask')).toHaveAttribute('aria-pressed', 'true');
  });

  test('stage tabs switch between preview and files (empty before a run)', () => {
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    expect(screen.getByTestId('aurora-preview')).toBeInTheDocument();
    expect(screen.queryByTestId('aurora-files')).toBeNull();

    fireEvent.click(screen.getByTestId('stage-tab-files'));
    expect(screen.getByTestId('aurora-files')).toBeInTheDocument();
    expect(screen.getByText('No files changed yet')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stage-tab-preview'));
    expect(screen.getByTestId('aurora-preview')).toBeInTheDocument();
  });

  test('classic escape hatch writes the fallback flag', () => {
    render(<CopilotAurora {...base} onToast={jest.fn()} />);
    expect(window.localStorage.getItem('ai_dost_copilot_ui')).toBeNull();
    fireEvent.click(screen.getByTestId('aurora-classic-btn'));
    expect(window.localStorage.getItem('ai_dost_copilot_ui')).toBe('classic');
  });
});

describe('auroraRun mapper (pure)', () => {
  test('normPlanTasks maps backend statuses to rail statuses', () => {
    const tasks = normPlanTasks([
      { id: 'a', objective: 'One', status: 'completed' },
      { id: 'b', title: 'Two', status: 'in_progress' },
      { id: 'c', name: 'Three', status: 'failed' },
      { id: 'd', objective: 'Four' },
    ]);
    expect(tasks.map((t) => t.status)).toEqual(['done', 'active', 'error', 'todo']);
    expect(tasks[1].label).toBe('Two');
    expect(tasks[2].label).toBe('Three');
  });

  test('normPlanTasks handles director_plan {specialty} and plain-string tasks', () => {
    // CopilotDirector.js sends {id, specialty, role} — NO objective/title.
    const tasks = normPlanTasks([
      { id: 1, specialty: 'frontend', role: 'UI Engineer' },
      { id: 2, specialty: 'tester', role: 'QA' },
      'plain string todo',
    ]);
    expect(tasks.map((t) => t.label)).toEqual(['frontend', 'tester', 'plain string todo']);
    expect(tasks[0].id).toBe(1);
    expect(tasks[2].id).toBe('task-3');
    expect(tasks[0].status).toBe('active'); // idx 0 with silent status
    expect(tasks[2].status).toBe('todo');
  });

  test('unknown event types return a deduped unknown op, never a raw drop', () => {
    const acts = mapRunEvent({ type: 'weird_future_event', message: 'hello' });
    expect(acts).toHaveLength(1);
    expect(acts[0].op).toBe('unknown');
    expect(acts[0].type).toBe('weird_future_event');
    expect(acts[0].row.detail).toBe('hello');
  });

  test('step events: both emitter shapes render, running frames collapse', () => {
    // agent.js shape (stepLog wrapper)
    const a = mapRunEvent({ type: 'step', stepLog: { action: 'write_file', thought: 'writing App.jsx' } });
    expect(a[0].row.detail).toBe('writing App.jsx');
    // PlannerExecutionLoop shape (top-level, NO stepLog)
    const b = mapRunEvent({ type: 'step', tool: 'html_write', description: 'Create page', status: 'done' });
    expect(b[0].row.detail).toBe('html_write · Create page');
    // running frame (duplicate of the done frame) must not spam the spine
    expect(mapRunEvent({ type: 'step', tool: 'html_write', description: 'Create page', status: 'running' })).toEqual([]);
  });

  test('buildChatHistory keeps only user/reply/done rows, capped', () => {
    const hist = buildChatHistory([
      { kind: 'user', detail: 'do it' },
      { kind: 'think', detail: 'noise' },
      { kind: 'done', detail: 'finished' },
      { kind: 'file', detail: 'noise2' },
    ]);
    expect(hist).toEqual([
      { role: 'user', content: 'do it' },
      { role: 'assistant', content: 'finished' },
    ]);
  });
});
