'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createChatTaskAwareHandler } = require('../chatAgentRouteBridge');

test('chat route bridge delegates chatTaskPlan requests to canonical handler', async () => {
  let legacyCalls = 0;
  let chatCalls = 0;
  const response = { ok: true };
  const legacyHandler = () => {
    legacyCalls += 1;
    return 'legacy';
  };
  const canonicalHandler = async (req, res, next) => {
    chatCalls += 1;
    assert.equal(req.body.chatTaskPlan.intent.type, 'task');
    assert.equal(res, response);
    assert.equal(typeof next, 'function');
    return 'canonical';
  };

  const wrapped = createChatTaskAwareHandler(legacyHandler, canonicalHandler);
  const result = await wrapped({ body: { chatTaskPlan: { intent: { type: 'task' } } } }, response, () => {});

  assert.equal(result, 'canonical');
  assert.equal(chatCalls, 1);
  assert.equal(legacyCalls, 0);
});

test('chat route bridge preserves legacy agent requests', () => {
  let legacyCalls = 0;
  const wrapped = createChatTaskAwareHandler(() => {
    legacyCalls += 1;
    return 'legacy';
  }, () => {
    throw new Error('canonical handler must not run');
  });

  const result = wrapped({ body: { userPrompt: 'build an app' } }, {}, () => {});
  assert.equal(result, 'legacy');
  assert.equal(legacyCalls, 1);
});
