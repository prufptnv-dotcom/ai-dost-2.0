/**
 * Phase 1a — Devin-style Stop for the Copilot IDE run loop.
 * Mutation-verified: (a) remove cancelAgentRun → behavioral tests fail;
 * (b) drop taskId from /api/agent/run body OR the stop button/Esc wiring in
 * CopilotIDE.jsx → static audit tests fail.
 */
import fs from 'fs';
import path from 'path';

import { cancelAgentRun } from '../lib/copilotStop';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('cancelAgentRun (lib/copilotStop)', () => {
  test('aborts controller and posts server cancel for the taskId', async () => {
    const controller = { abort: jest.fn() };
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const attempted = cancelAgentRun({
      backend: '',
      taskId: 'copilot-abc123',
      controller,
      fetchImpl,
    });

    expect(attempted).toBe(true);
    expect(controller.abort).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/chat/tasks/copilot-abc123/cancel');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
  });

  test('backend prefix is joined and taskId is URL-encoded', () => {
    const fetchImpl = jest.fn().mockResolvedValue({});
    cancelAgentRun({
      backend: 'http://localhost:5000',
      taskId: 'id with spaces',
      controller: { abort: jest.fn() },
      fetchImpl,
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'http://localhost:5000/api/chat/tasks/id%20with%20spaces/cancel'
    );
  });

  test('without taskId no server call happens (returns false)', () => {
    const fetchImpl = jest.fn();
    const controller = { abort: jest.fn() };
    const attempted = cancelAgentRun({ taskId: undefined, controller, fetchImpl });
    expect(attempted).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
    // Local abort still fires — dropping the stream alone must always work.
    expect(controller.abort).toHaveBeenCalledTimes(1);
  });

  test('controller abort throwing never breaks the stop path', () => {
    const controller = { abort: jest.fn(() => { throw new Error('dead'); }) };
    const fetchImpl = jest.fn().mockResolvedValue({});
    expect(() => cancelAgentRun({ taskId: 't1', controller, fetchImpl })).not.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('rejected/throwing fetch is swallowed (best-effort cancel)', async () => {
    const rejecting = jest.fn().mockRejectedValue(new Error('offline'));
    expect(() => cancelAgentRun({ taskId: 't1', controller: null, fetchImpl: rejecting }))
      .not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // let the .catch attach+run
    expect(rejecting).toHaveBeenCalledTimes(1);

    const throwing = jest.fn(() => { throw new Error('sync fail'); });
    expect(() => cancelAgentRun({ taskId: 't1', controller: null, fetchImpl: throwing }))
      .not.toThrow();
  });

  test('no fetch available → local abort only (returns false)', () => {
    const origFetch = global.fetch;
    global.fetch = null;
    try {
      const controller = { abort: jest.fn() };
      const attempted = cancelAgentRun({ taskId: 't1', controller });
      expect(attempted).toBe(false);
      expect(controller.abort).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = origFetch;
    }
  });
});

describe('CopilotIDE.jsx stop wiring (static audit)', () => {
  test('run body carries taskId and task id header', () => {
    expect(SRC).toMatch(/x-ai-dost-task-id['"]:\s*runTaskId/);
    expect(SRC).toMatch(/taskId:\s*runTaskId\b/);
    expect(SRC).toMatch(/runTaskIdRef\.current\s*=\s*`copilot-/);
  });

  test('handleStopRun delegates to cancelAgentRun + stops local state', () => {
    const fn = SRC.slice(SRC.indexOf('const handleStopRun'));
    const body = fn.slice(0, fn.indexOf('}, [setCopilotMessages]'));
    expect(body).toContain('cancelAgentRun({');
    expect(body).toContain('controller: abortRef.current');
    expect(body).toContain('setRunning(false)');
    expect(body).toContain('Stopped by user');
  });

  test('composer send button swaps to a Stop button while running', () => {
    expect(SRC).toContain('data-testid="copilot-stop-btn"');
    expect(SRC).toMatch(/onClick=\{handleStopRun\}/);
    expect(SRC).toContain('Stop run (Esc)');
  });

  test('Esc stops the run but defers to open overlays', () => {
    expect(SRC).toMatch(/e\.key === 'Escape' && running && !paletteOpen && !quickOpenOpen && !searchOpen/);
    expect(SRC).toMatch(/e\.preventDefault\(\);\s*\n\s*handleStopRun\(\);/);
  });

  test('a stopped run cannot kill a newer run (finally guard)', () => {
    expect(SRC).toMatch(/if \(abortRef\.current === controller\) \{\s*\n\s*setRunning\(false\);/);
  });
});
