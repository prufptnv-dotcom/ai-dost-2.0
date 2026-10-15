const test = require('node:test');
const assert = require('node:assert/strict');
const ExecutionController = require('./ExecutionController');

function createHarness() {
  const toolCalls = new Map();
  const updates = [];
  let sequence = 0;

  const controller = new ExecutionController({
    toolCallDao: {
      create(record) {
        const stored = { ...record };
        toolCalls.set(stored.id, stored);
        return stored;
      },
      update(id, patch) {
        const stored = toolCalls.get(id);
        Object.assign(stored, patch);
        updates.push({ id, ...patch });
        return stored;
      }
    },
    gatekeeper: {
      evaluate() {
        return { decision: 'ALLOW', capabilities: [] };
      }
    }
  });

  controller.generateId = prefix => `${prefix}_${++sequence}`;

  return { controller, toolCalls, updates };
}

test('executeTool succeeds before timeout', async () => {
  const { controller, toolCalls, updates } = createHarness();
  const result = await controller.executeTool(
    'step_1',
    'fast_tool',
    { value: 1 },
    { toolTimeoutMs: 100 },
    { get: () => ({ execute: async () => 'ok' }) }
  );

  assert.equal(result, 'ok');
  assert.equal(toolCalls.get('toolcall_1').status, 'SUCCEEDED');
  assert.equal(updates.filter(update => update.status === 'SUCCEEDED').length, 1);
});

test('executeTool fails with TOOL_TIMEOUT and records failed tool call', async () => {
  const { controller, toolCalls, updates } = createHarness();
  await assert.rejects(
    controller.executeTool(
      'step_1',
      'slow_tool',
      {},
      { toolTimeoutMs: 20 },
      { get: () => ({ execute: () => new Promise(() => {}) }) }
    ),
    error => {
      assert.equal(error.code, 'TOOL_TIMEOUT');
      assert.equal(error.timeoutMs, 20);
      return true;
    }
  );

  const call = toolCalls.get('toolcall_1');
  assert.equal(call.status, 'FAILED');
  assert.equal(call.timingMeta.errorCode, 'TOOL_TIMEOUT');
  assert.equal(call.timingMeta.timeoutMs, 20);
  assert.equal(updates.filter(update => update.status === 'SUCCEEDED').length, 0);
});

test('late tool resolution cannot overwrite timeout failure', async () => {
  const { controller, toolCalls, updates } = createHarness();
  let resolveTool;
  const promise = new Promise(resolve => {
    resolveTool = resolve;
  });

  await assert.rejects(
    controller.executeTool(
      'step_1',
      'late_tool',
      {},
      { toolTimeoutMs: 15 },
      { get: () => ({ execute: () => promise }) }
    ),
    error => error.code === 'TOOL_TIMEOUT'
  );

  resolveTool('late success');
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(toolCalls.get('toolcall_1').status, 'FAILED');
  assert.equal(updates.filter(update => update.status === 'SUCCEEDED').length, 0);
  assert.equal(updates.filter(update => update.status === 'FAILED').length, 1);
});

test('executeTool returns TOOL_CANCELLED when parent signal aborts', async () => {
  const { controller, toolCalls } = createHarness();
  const abortController = new AbortController();

  const execution = controller.executeTool(
    'step_1',
    'cancellable_tool',
    {},
    { toolTimeoutMs: 1000, signal: abortController.signal },
    { get: () => ({ execute: ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true });
    }) }) }
  );

  setTimeout(() => abortController.abort(new Error('user cancelled')), 10);

  await assert.rejects(execution, error => {
    assert.equal(error.code, 'TOOL_CANCELLED');
    return true;
  });
  assert.equal(toolCalls.get('toolcall_1').status, 'FAILED');
});

test('already aborted signal does not execute the tool', async () => {
  const { controller, toolCalls } = createHarness();
  const abortController = new AbortController();
  abortController.abort();
  let executed = false;

  await assert.rejects(
    controller.executeTool(
      'step_1',
      'blocked_tool',
      {},
      { signal: abortController.signal, toolTimeoutMs: 100 },
      { get: () => ({ execute: async () => { executed = true; } }) }
    ),
    error => error.code === 'TOOL_CANCELLED'
  );

  assert.equal(executed, false);
  assert.equal(toolCalls.get('toolcall_1').status, 'FAILED');
});
