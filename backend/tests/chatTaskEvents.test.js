const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTaskRuntimeEvents } = require('../security-hardening');

test('maps web search lifecycle to structured task phases', () => {
  const searching = buildTaskRuntimeEvents({
    type: 'web_search_start',
    intent: 'WEB_SEARCH',
    status: 'Searching live web...',
    query: 'latest AI news',
  });
  assert.equal(searching[0].type, 'task_phase');
  assert.equal(searching[0].phase, 'searching');
  assert.equal(searching[0].query, 'latest AI news');

  const sources = buildTaskRuntimeEvents({
    type: 'web_search_sources',
    sources: [{ title: 'one' }, { title: 'two' }],
  });
  assert.deepEqual(sources[0], {
    type: 'task_phase',
    phase: 'reading',
    status: 'Reading 2 sources',
  });
});

test('maps first generated chunk and completion to execution lifecycle', () => {
  const state = { generatingStarted: false };
  const firstChunk = buildTaskRuntimeEvents({ chunk: 'hello' }, state);
  assert.equal(firstChunk[0].phase, 'generating');
  assert.equal(state.generatingStarted, true);

  const secondChunk = buildTaskRuntimeEvents({ chunk: ' world' }, state);
  assert.equal(secondChunk.length, 0);

  const complete = buildTaskRuntimeEvents({ done: true, model: 'groq (gpt-oss-120b)' }, state);
  assert.equal(complete[0].phase, 'verifying');
  assert.deepEqual(complete[1], {
    type: 'task_tool',
    tool: 'model',
    name: 'groq (gpt-oss-120b)',
    status: 'completed',
  });
});

test('maps backend errors to an explicit error phase', () => {
  const events = buildTaskRuntimeEvents({ type: 'web_search_error', error: 'provider unavailable' });
  assert.deepEqual(events[0], {
    type: 'task_phase',
    phase: 'error',
    status: 'provider unavailable',
  });
});
