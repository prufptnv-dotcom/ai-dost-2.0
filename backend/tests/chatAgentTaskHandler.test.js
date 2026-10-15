'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');
const { handleChatTaskRequest } = require('../agent/runtime/chatAgentTaskHandler');

function createResponse() {
  const res = new EventEmitter();
  res.headers = {};
  res.statusCode = 200;
  res.writableEnded = false;
  res.writableFinished = false;
  res.body = '';
  res.setHeader = (name, value) => { res.headers[name] = value; };
  res.getHeader = (name) => res.headers[name];
  res.flushHeaders = () => {};
  res.write = (chunk) => { res.body += String(chunk); return true; };
  res.end = (chunk = '') => { res.body += String(chunk); res.writableEnded = true; res.writableFinished = true; res.emit('finish'); };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); return res; };
  return res;
}

function createRequest(body, userId = 'user-1', taskId = 'chat-task-1') {
  return {
    body,
    user: { id: userId },
    headers: { 'x-ai-dost-task-id': taskId },
    get(name) { return this.headers[String(name).toLowerCase()]; },
  };
}

test('ChatTaskGateway uses canonical TaskPlanner when available', async () => {
  const contextAssembler = {
    calls: 0,
    async assemble(projectId, userId, intent) {
      this.calls += 1;
      assert.equal(projectId, 'project-1');
      assert.equal(userId, 'user-1');
      assert.equal(intent, 'create a website');
      return { authorized: true };
    },
  };
  const taskPlanner = {
    calls: 0,
    async generatePlan(intent) {
      this.calls += 1;
      assert.equal(intent, 'create a website');
      return {
        version: 1,
        goal: 'create a website',
        steps: [{ id: 's1', tool: 'mock_tool', description: 'build', input: {} }],
      };
    },
  };
  const plannerExecutionLoop = {
    async runWithPlan(projectId, userId, plan, maxRepairs, isCanceled) {
      assert.equal(projectId, 'project-1');
      assert.equal(userId, 'user-1');
      assert.equal(plan.steps[0].tool, 'mock_tool');
      assert.equal(maxRepairs, 2);
      assert.equal(isCanceled(), false);
      return { status: 'SUCCEEDED', taskId: 'task-1', runId: 'run-1' };
    },
  };

  const gateway = new ChatTaskGateway({ plannerExecutionLoop, taskPlanner, contextAssembler });
  const events = [];
  const result = await gateway.run({
    projectId: 'project-1',
    userId: 'user-1',
    taskPlan: {
      type: 'task',
      intent: { type: 'task', requiresTool: true, originalMessage: 'create a website' },
      steps: [{ id: 'tool', kind: 'tool', action: 'create', target: 'code' }],
    },
    maxRepairs: 2,
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(contextAssembler.calls, 1);
  assert.equal(taskPlanner.calls, 1);
  assert.ok(events.some((event) => event.phase === 'planning'));
});

test('chatAgentTaskHandler fails closed on unauthorized projects', async () => {
  const req = createRequest({
    projectId: 'private-project',
    userPrompt: 'create a website',
    taskId: 'chat-task-2',
    chatTaskPlan: { intent: { type: 'task', requiresTool: true, originalMessage: 'create a website' } },
  }, 'attacker');
  const res = createResponse();

  let gatewayCalled = false;
  await handleChatTaskRequest(req, res, () => {
    throw new Error('next must not be called');
  }, {
    projectAuthorization: {
      authorize() {
        return { authorized: false, status: 403, error: 'Access denied' };
      },
    },
    gateway: { run: async () => { gatewayCalled = true; } },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(gatewayCalled, false);
  assert.match(res.body, /Access denied/);
});

test('chatAgentTaskHandler returns SSE task completion', async () => {
  const req = createRequest({
    projectId: 'project-1',
    userPrompt: 'search the web',
    taskId: 'chat-task-3',
    chatTaskPlan: {
      intent: { type: 'task', requiresTool: true, originalMessage: 'search the web' },
      steps: [{ id: 'tool', kind: 'tool', action: 'search', target: null }],
    },
  });
  const res = createResponse();

  await handleChatTaskRequest(req, res, () => {
    throw new Error('next must not be called');
  }, {
    projectAuthorization: {
      authorize(projectId, request) {
        assert.equal(projectId, 'project-1');
        assert.equal(request.user.id, 'user-1');
        return { authorized: true, user: { id: 'user-1' }, project: { id: 'project-1' } };
      },
    },
    gateway: {
      async run({ projectId, userId, taskPlan, onEvent }) {
        assert.equal(projectId, 'project-1');
        assert.equal(userId, 'user-1');
        assert.equal(taskPlan.intent.originalMessage, 'search the web');
        onEvent({ type: 'task_phase', phase: 'planning', status: 'Canonical plan validated' });
        return { status: 'SUCCEEDED', taskId: 'task-3', runId: 'run-3' };
      },
    },
  });

  assert.equal(res.writableEnded, true);
  assert.match(res.body, /task_complete/);
  assert.match(res.body, /chat-task-3/);
});