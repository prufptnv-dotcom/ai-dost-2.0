import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CopilotAurora from '../components/aurora/CopilotAurora';
import AuroraPalette, { filterActions } from '../components/aurora/AuroraPalette';
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
    // Default fetch: harmless preview-status probe (the hook probes on mount
    // for a P7-persisted dev server). Tests override via installFetch.
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) })
    );
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
    const fetchMock = installFetch((url) => {
      const u = String(url);
      if (u.includes('/api/chat/tasks/') && u.endsWith('/cancel')) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      if (u.includes('/api/agent/run')) {
        runCalls += 1;
        if (runCalls === 1) {
          return sseResponse([
            { type: 'gate_approval_required', message: 'Approve npm install', gate: { approval_token: 'tok-1' } },
          ]);
        }
        return sseResponse([{ type: 'done', message: 'resumed and done' }]);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) }; // status probe
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
    expect(screen.queryByTestId('aurora-frame')).toBeNull(); // no fake preview
    expect(screen.queryByTestId('aurora-files')).toBeNull();

    fireEvent.click(screen.getByTestId('stage-tab-files'));
    expect(screen.getByTestId('aurora-files')).toBeInTheDocument();
    expect(screen.getByText('No files changed yet')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stage-tab-preview'));
    expect(screen.getByTestId('aurora-preview')).toBeInTheDocument();
  });

  test('dev_server READY flips the stage to the live proxy frame', async () => {
    installFetch(() =>
      sseResponse([
        { type: 'file_written', path: 'src/App.jsx', content: 'export default App' },
        { type: 'dev_server', state: 'READY', url: 'http://localhost:5199', hostPort: 5199, framework: 'vite' },
        { type: 'done', message: 'served' },
      ])
    );
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'serve it' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await screen.findByText('served');
    const frame = screen.getByTestId('aurora-frame');
    expect(frame).toHaveAttribute('data-mode', 'live');
    expect(frame.getAttribute('src')).toContain('/api/preview/p1');
    expect(screen.getByTestId('preview-chip')).toHaveTextContent('Live · :5199');
    await screen.findByText('live preview on :5199'); // spine row
  });

  test('static preview renders generated files; file row expands a unified diff', async () => {
    installFetch((url) => {
      if (String(url).includes('/dev/start')) {
        // A4 auto-start fires after a file-writing run; a static project
        // refuses honestly and the stage KEEPS the static srcdoc fallback.
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: false, error: 'No dev server configuration detected (static project)' }),
        };
      }
      if (String(url).includes('/api/agent/run')) {
        return sseResponse([
          {
            type: 'file_written',
            path: 'index.html',
            content: '<!doctype html><html><body><h1>Hello Aurora</h1></body></html>',
          },
          { type: 'done', message: 'built' },
        ]);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'single html page' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await screen.findByText('built');

    // A4 auto-start tries to go live on finish; the refusal lands in the chip
    // and the static srcdoc fallback survives it.
    await waitFor(() =>
      expect(screen.getByTestId('preview-chip')).toHaveTextContent('Preview server failed')
    );
    const frame = screen.getByTestId('aurora-frame');
    expect(frame).toHaveAttribute('data-mode', 'static');
    expect(frame.getAttribute('srcdoc')).toContain('Hello Aurora');

    // file row → inline unified diff (NEW file = all additions)
    fireEvent.click(screen.getByTestId('stage-tab-files'));
    const row = screen.getByTestId('file-row');
    expect(row).toHaveAttribute('data-path', 'index.html');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByTestId('diff-panel');
    expect(panel.querySelector('[data-type="add"]')).toBeTruthy();
    expect(panel.textContent).toContain('Hello Aurora');
    expect(panel.textContent).toContain('+1'); // +add −del header

    fireEvent.click(row);
    expect(screen.queryByTestId('diff-panel')).toBeNull();
  });

  test('mount probe adopts a P7-persisted dev server (live before first run)', async () => {
    installFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ success: true, running: true, state: 'READY', url: 'http://localhost:5222', hostPort: 5222 }),
      })
    );
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('preview-chip')).toHaveTextContent('Live · :5222'));
    const frame = screen.getByTestId('aurora-frame');
    expect(frame).toHaveAttribute('data-mode', 'live');
    expect(frame.getAttribute('src')).toContain('/api/preview/p1');
    expect(screen.getByTestId('aurora-stop')).toBeDisabled(); // no run needed
  });

  test('Start preview button boots the dev server via /dev/start → Live', async () => {
    const fetchMock = installFetch((url) => {
      if (String(url).includes('/dev/start')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, ok: true, url: 'http://localhost:5432', hostPort: 5432, framework: 'vite' }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    // idle + no server → empty state carries the labeled Start action
    const startBtn = await screen.findByTestId('preview-start');
    expect(startBtn).toHaveTextContent('Start preview');
    expect(screen.queryByTestId('preview-chip')).toBeNull(); // no fake chip

    fireEvent.click(startBtn);
    await screen.findByText('live preview on :5432'); // spine row
    expect(screen.getByTestId('preview-chip')).toHaveTextContent('Live · :5432');
    const frame = screen.getByTestId('aurora-frame');
    expect(frame).toHaveAttribute('data-mode', 'live');
    expect(frame.getAttribute('src')).toContain('/api/preview/p1');

    // same contract CopilotIDE ships with
    const startCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/dev/start'));
    expect(startCall).toBeTruthy();
    expect(startCall[1].method).toBe('POST');
    expect(JSON.parse(startCall[1].body).projectPath).toBe('.');
    // start button swaps for stop
    expect(screen.queryByTestId('preview-start')).toBeNull();
    expect(screen.getByTestId('preview-stop')).toBeInTheDocument();
  });

  test('Stop preview posts /dev/stop and falls back to empty (no fake live chip)', async () => {
    const fetchMock = installFetch((url, init) => {
      if (String(url).includes('/dev/stop')) {
        return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, running: true, state: 'READY', url: 'http://localhost:5240', hostPort: 5240 }),
      };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    // probe adopts the persisted server → live + stop control
    await waitFor(() => expect(screen.getByTestId('preview-chip')).toHaveTextContent('Live · :5240'));
    const stopBtn = screen.getByTestId('preview-stop');
    expect(screen.queryByTestId('preview-start')).toBeNull();

    fireEvent.click(stopBtn);
    await waitFor(() => expect(screen.queryByTestId('preview-chip')).toBeNull()); // no server → honest empty
    expect(screen.getByTestId('preview-start')).toBeInTheDocument();
    expect(screen.getByText('No preview yet')).toBeInTheDocument();

    const stopCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/dev/stop'));
    expect(stopCall).toBeTruthy();
    expect(stopCall[1].method).toBe('POST');
  });

  test('failed start surfaces the honest reason in the empty state (not just spine)', async () => {
    installFetch((url) => {
      if (String(url).includes('/dev/start')) {
        return { ok: true, status: 500, json: async () => ({ success: false, error: 'No dev server configuration detected (static project)' }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const startBtn = await screen.findByTestId('preview-start');
    fireEvent.click(startBtn);

    // empty state now carries the failure line — no fake chip, no silent swallow.
    // scoped to the stage: the same sentence also lives in the spine row (by design).
    await waitFor(() =>
      expect(
        within(screen.getByTestId('aurora-preview')).getByText(/preview server failed — No dev server configuration detected/)
      ).toBeInTheDocument()
    );
    expect(screen.queryByTestId('preview-chip')).toBeNull();
    expect(screen.queryByTestId('aurora-frame')).toBeNull();
    // retry stays available (STARTING is the only state that hides Start)
    expect(screen.getByTestId('preview-start')).toBeInTheDocument();
  });

  test('batched SSE events get unique row keys (no React duplicate-key warnings)', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    installFetch(() =>
      sseResponse([
        { type: 'thinking', message: 'one' },
        { type: 'thinking', message: 'two' },
        { type: 'tool_call', action: 'read_file', thought: 'a' },
        { type: 'tool_call', action: 'write_file', thought: 'b' },
        { type: 'step', tool: 'list_directory', description: 'scan', status: 'done' },
        { type: 'step', tool: 'write_file', description: 'w', status: 'done' },
        { type: 'file_written', path: 'x.js', content: '1' },
        { type: 'done', message: 'batched done' },
      ])
    );
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'batch' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await screen.findByText('batched done');

    // ids are minted OUTSIDE the state updater — React batching used to make
    // queued updaters read the same final seqRef value → duplicate `r7` keys.
    const keyWarnings = errSpy.mock.calls.filter((c) => String(c[0] || '').includes('same key'));
    errSpy.mockRestore();
    expect(keyWarnings).toHaveLength(0);
  });

  test('Ctrl+K opens the palette, filters, Enter executes (permission switch)', async () => {
    installFetch(() => ({ ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) }));
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const palette = await screen.findByTestId('aurora-palette');
    expect(within(palette).getByTestId('palette-input')).toBeInTheDocument();

    // filter narrows to the turbo permission row…
    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'turbo' } });
    const items = within(palette).getAllByTestId('palette-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Permission: turbo');

    // …Enter runs it: palette closes, segment flips, no palette left behind
    fireEvent.keyDown(screen.getByTestId('palette-input'), { key: 'Enter' });
    expect(screen.queryByTestId('aurora-palette')).toBeNull();
    expect(screen.getByTestId('perm-turbo')).toHaveAttribute('aria-pressed', 'true');

    // Esc closes without executing anything — turbo (from Enter) stays active
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await screen.findByTestId('aurora-palette');
    fireEvent.keyDown(screen.getByTestId('palette-input'), { key: 'Escape' });
    expect(screen.queryByTestId('aurora-palette')).toBeNull();
    expect(screen.getByTestId('perm-turbo')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('perm-auto')).toHaveAttribute('aria-pressed', 'false');
  });

  test('palette file entry jumps to the Files tab with the diff open', async () => {
    installFetch(() =>
      sseResponse([
        { type: 'file_written', path: 'src/timer.js', content: 'export const t = 1;' },
        { type: 'done', message: 'file done' },
      ])
    );
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'write timer file' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await screen.findByText('file done');

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await screen.findByTestId('aurora-palette');
    fireEvent.change(screen.getByTestId('palette-input'), { target: { value: 'timer' } });
    const entry = within(screen.getByTestId('aurora-palette')).getAllByTestId('palette-item')[0];
    expect(entry).toHaveTextContent('src/timer.js');
    expect(entry).toHaveTextContent('NEW');
    fireEvent.click(entry);

    expect(screen.queryByTestId('aurora-palette')).toBeNull();
    expect(screen.getByTestId('stage-tab-files')).toHaveAttribute('aria-selected', 'true');
    const row = screen.getByTestId('file-row');
    expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
  });

  test('Alt+P / Alt+F switch stage tabs; Alt+S boots the preview server', async () => {
    const fetchMock = installFetch((url) => {
      if (String(url).includes('/dev/start')) {
        return { ok: true, status: 200, json: async () => ({ success: true, ok: true, url: 'http://localhost:8410', hostPort: 8410, framework: 'vite' }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    fireEvent.keyDown(window, { key: 'f', altKey: true });
    expect(screen.getByTestId('stage-tab-files')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(window, { key: 'p', altKey: true });
    expect(screen.getByTestId('stage-tab-preview')).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(window, { key: 's', altKey: true });
    await screen.findByText('live preview on :8410');
    expect(screen.getByTestId('preview-chip')).toHaveTextContent('Live · :8410');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/dev/start'))).toBe(true);

    // second Alt+S while live → STOP (toggle), not a second start
    fireEvent.keyDown(window, { key: 's', altKey: true });
    await waitFor(() => expect(screen.queryByTestId('preview-chip')).toBeNull());
  });

  test('run-finish auto-starts the preview when the run wrote files', async () => {
    const fetchMock = installFetch((url) => {
      if (String(url).includes('/dev/start')) {
        return { ok: true, status: 200, json: async () => ({ success: true, ok: true, url: 'http://localhost:8311', hostPort: 8311, framework: 'vite' }) };
      }
      if (String(url).includes('/api/agent/run')) {
        return sseResponse([
          { type: 'file_written', path: 'src/App.jsx', content: 'export default App' },
          { type: 'done', message: 'autostart done' },
        ]);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'build it' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // director runs never emit dev_server — the hook boots the server itself
    await screen.findByText('live preview on :8311');
    expect(screen.getByTestId('preview-chip')).toHaveTextContent('Live · :8311');
    const startCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/dev/start'));
    expect(startCalls).toHaveLength(1); // exactly once per run
  });

  test('no auto-start when the run wrote nothing', async () => {
    const fetchMock = installFetch((url) => {
      if (String(url).includes('/api/agent/run')) {
        return sseResponse([
          { type: 'thinking', message: 'hmm' },
          { type: 'done', message: 'no files done' },
        ]);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'just talk' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await screen.findByText('no files done');

    await new Promise((r) => setTimeout(r, 60)); // let any stray auto-start land
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/dev/start'))).toBe(false);
    expect(screen.queryByTestId('preview-chip')).toBeNull();
  });

  test('Stage toggle opens the narrow overlay (backdrop + Esc)', async () => {
    installFetch(() => ({ ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) }));
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const shell = screen.getByTestId('aurora-shell');
    expect(shell).toHaveAttribute('data-stage-open', 'false');

    fireEvent.click(screen.getByTestId('stage-toggle'));
    expect(shell).toHaveAttribute('data-stage-open', 'true');
    expect(screen.getByTestId('stage-backdrop')).toBeInTheDocument();

    // backdrop click closes
    fireEvent.click(screen.getByTestId('stage-backdrop'));
    expect(shell).toHaveAttribute('data-stage-open', 'false');

    // Esc closes too
    fireEvent.click(screen.getByTestId('stage-toggle'));
    expect(shell).toHaveAttribute('data-stage-open', 'true');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(shell).toHaveAttribute('data-stage-open', 'false');
  });

  test('A5 model picker: shared localStorage → chip label + preferredModel in run body', async () => {
    window.localStorage.clear();
    window.localStorage.setItem('ai_dost_copilot_model', 'groq');
    const fetchMock = installFetch((url) => {
      if (String(url).includes('/api/agent/run')) {
        return sseResponse([{ type: 'done', message: 'model done' }]);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    // post-mount read of the key BOTH UIs share
    await waitFor(() => expect(screen.getByTestId('model-chip-label')).toHaveTextContent('Groq first'));

    // open menu → pick OpenRouter first → persisted + label swaps + menu closes
    fireEvent.click(screen.getByTestId('model-chip'));
    const menu = await screen.findByTestId('model-menu');
    expect(within(menu).getAllByTestId('model-opt-auto').length).toBe(1);
    fireEvent.click(screen.getByTestId('model-opt-openrouter'));
    expect(window.localStorage.getItem('ai_dost_copilot_model')).toBe('openrouter');
    expect(screen.getByTestId('model-chip-label')).toHaveTextContent('OpenRouter first');
    expect(screen.queryByTestId('model-menu')).toBeNull();

    // run → body carries the chosen preferredModel (was hardcoded 'auto')
    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await screen.findByText('model done');
    const runCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/agent/run'));
    expect(JSON.parse(runCall[1].body).preferredModel).toBe('openrouter');
    window.localStorage.clear();
  });

  test('A5 @file mentions: dropdown inserts path, run sends contextFiles + mentioned-first projectFiles', async () => {
    const fetchMock = installFetch((url) => {
      const u = String(url);
      if (u.includes('/api/v1/memory/project')) {
        return {
          ok: true,
          status: 200,
          json: async () => [
            { path: 'package.json', content: '{}' },
            { path: 'src/App.jsx', content: 'export default App' },
            { path: 'src/App.jsx', content: 'dup ignored' },
          ],
        };
      }
      if (u.includes('/api/agent/run')) return sseResponse([{ type: 'done', message: 'mention done' }]);
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/v1/memory/project'))).toBe(true)
    );

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'fix @App' } });
    // workspace list loaded → pop matches src/App.jsx once (path dedup)
    const pop = await screen.findByTestId('mention-pop');
    expect(within(pop).getAllByTestId('mention-item')).toHaveLength(1);

    // Enter inserts the path — it does NOT send yet (prefix "fix " preserved)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(screen.queryByTestId('mention-pop')).toBeNull();
    expect(input.value).toBe('fix @src/App.jsx ');

    // Enter again sends: contextFiles + projectFiles (mentioned first)
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    await screen.findByText('mention done');
    const runCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/agent/run'));
    const body = JSON.parse(runCall[1].body);
    expect(body.contextFiles).toEqual(['src/App.jsx']);
    expect(body.projectFiles.map((f) => f.path)).toEqual(['src/App.jsx', 'package.json']);
  });

  test('A5 error row: failed run shows Retry; click re-sends the same prompt', async () => {
    let runCalls = 0;
    const fetchMock = installFetch((url) => {
      const u = String(url);
      if (u.includes('/api/agent/run')) {
        runCalls += 1;
        if (runCalls === 1) return { ok: false, status: 500, statusText: 'boom', json: async () => ({}) };
        return sseResponse([{ type: 'done', message: 'retry ok' }]);
      }
      return { ok: true, status: 200, json: async () => ({ success: true, state: 'STOPPED' }) };
    });
    render(<CopilotAurora {...base} onToast={jest.fn()} />);

    const input = screen.getByTestId('aurora-composer-input');
    fireEvent.change(input, { target: { value: 'first try' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // HTTP 500 → error row with a Retry button (no button while running)
    const retry = await screen.findByTestId('retry-btn');
    fireEvent.click(retry);

    await screen.findByText('retry ok');
    const calls = fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/agent/run'));
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1][1].body).userPrompt).toBe('first try');
  });

  test('classic escape hatch writes the fallback flag', () => {
    render(<CopilotAurora {...base} onToast={jest.fn()} />);
    expect(window.localStorage.getItem('ai_dost_copilot_ui')).toBeNull();
    fireEvent.click(screen.getByTestId('aurora-classic-btn'));
    expect(window.localStorage.getItem('ai_dost_copilot_ui')).toBe('classic');
  });
});

describe('auroraRun mapper (pure)', () => {
  test('filterActions: multi-token AND over label/hint/group (A4 palette)', () => {
    const acts = [
      { id: 'a', label: 'Preview: start dev server', hint: 'alt+S', group: 'preview' },
      { id: 'b', label: 'src/timer.js', hint: 'NEW', group: 'file' },
      { id: 'c', label: 'Permission: turbo', group: 'permission' },
    ];
    expect(filterActions(acts, '')).toHaveLength(3); // empty → passthrough
    expect(filterActions(acts, 'prev').map((a) => a.id)).toEqual(['a']);
    expect(filterActions(acts, 'NEW timer').map((a) => a.id)).toEqual(['b']); // hint + label
    expect(filterActions(acts, 'permission').map((a) => a.id)).toEqual(['c']); // group
    expect(filterActions(acts, 'zzz')).toHaveLength(0);
    expect(filterActions(undefined, 'x')).toHaveLength(0); // degenerate input
  });

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

  test('dev_server events → preview row + devServer op (READY/FAILED)', () => {
    const ok = mapRunEvent({ type: 'dev_server', state: 'READY', url: 'http://x', hostPort: 5199 });
    expect(ok[0].row).toMatchObject({ label: 'preview', tone: 'ok' });
    expect(ok[0].row.detail).toContain(':5199');
    expect(ok[1]).toEqual({
      op: 'devServer',
      server: expect.objectContaining({ state: 'READY', hostPort: 5199, url: 'http://x' }),
    });
    const fail = mapRunEvent({ type: 'dev_server', state: 'FAILED', reason: 'port busy' });
    expect(fail[0].row.tone).toBe('err');
    expect(fail[0].row.detail).toContain('port busy');
    expect(fail[1].server.state).toBe('FAILED');
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
