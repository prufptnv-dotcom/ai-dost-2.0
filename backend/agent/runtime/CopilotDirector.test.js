'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Isolate the Director from database, network, and model-provider dependencies.
const originalLoad = Module._load;
Module._load = function isolatedRuntimeLoad(request, parent, isMain) {
  if (request === '../../services/openaiService') return class OpenAIServiceMock {};
  if (request === './AgentCoordinator') return class AgentCoordinatorMock {};
  if (request === './resultValidator') {
    return { ResultValidator: { validate: (value) => ({ ...value, validated: true }) } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  CopilotDirector,
  normalizePlan,
  fallbackPlan,
  SPECIALTY_TO_ROLE,
  MAX_TASKS,
  hasDependencyCycle
} = require('./CopilotDirector');

Module._load = originalLoad;

test('normalizePlan removes duplicate ids and invalid dependencies', () => {
  const plan = normalizePlan({
    summary: 'test',
    tasks: [
      { id: 'a', specialty: 'frontend', objective: 'build UI', dependsOn: ['missing', 'a'] },
      { id: 'a', specialty: 'backend', objective: 'duplicate' },
      { id: 'b', specialty: 'testing', objective: 'test', dependsOn: ['a'] }
    ]
  }, 'request');

  assert.equal(plan.tasks.length, 2);
  assert.deepEqual(plan.tasks[0].dependsOn, []);
  assert.equal(plan.tasks[0].role, 'CODER');
  assert.equal(plan.tasks[1].role, 'VERIFIER');
  assert.deepEqual(plan.tasks[1].dependsOn, ['a']);
});

test('normalizePlan replaces cyclic plans with a safe fallback', () => {
  const plan = normalizePlan({
    tasks: [
      { id: 'a', specialty: 'backend', dependsOn: ['b'] },
      { id: 'b', specialty: 'frontend', dependsOn: ['a'] }
    ]
  }, 'simple request');

  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].id, 'task-1');
});

test('hasDependencyCycle detects cycles and accepts acyclic graphs', () => {
  assert.equal(hasDependencyCycle([
    { id: 'a', dependsOn: ['b'] },
    { id: 'b', dependsOn: ['a'] }
  ]), true);
  assert.equal(hasDependencyCycle([
    { id: 'a', dependsOn: [] },
    { id: 'b', dependsOn: ['a'] }
  ]), false);
});

test('fallbackPlan adapts task count to request complexity', () => {
  assert.equal(fallbackPlan('rename a button').tasks.length, 1);
  assert.equal(fallbackPlan('build a production backend with database and security').tasks.length, 3);
});

test('specialty roles and defensive task ceiling are defined', () => {
  assert.equal(SPECIALTY_TO_ROLE.frontend, 'CODER');
  assert.equal(SPECIALTY_TO_ROLE.browser_qa, 'VERIFIER');
  assert.equal(MAX_TASKS, 32);
});

function createExecutionHarness({ plan, workerStatuses = ['SUCCEEDED'], verificationStatus = 'SUCCEEDED' }) {
  const events = [];
  const delegatedTasks = [];
  let workerIndex = 0;
  let delegateIndex = 0;
  const coordinator = {
    async createSupervisorTask() {
      return { task: { id: 'supervisor-1' }, run: { id: 'supervisor-run-1' } };
    },
    async delegate(input) {
      delegateIndex += 1;
      const workerRun = { id: `worker-${delegateIndex}` };
      delegatedTasks.push({ ...input, workerRun });
      return { workerRun };
    },
    async startWorker(workerRunId, options = {}) {
      if (workerRunId === 'worker-verify') return { status: verificationStatus };
      return options.runner ? options.runner() : { status: workerStatuses[workerIndex++] || 'SUCCEEDED' };
    }
  };
  const director = new CopilotDirector({
    aiService: { chat: async () => JSON.stringify(plan) },
    coordinator,
    taskPlanner: {
      generatePlan: async () => ({ steps: [] }),
      generateVerificationPlan: async () => ({ steps: [] })
    },
    plannerExecutionLoop: {
      runWithPlan: async () => ({ status: workerStatuses[workerIndex++] || 'SUCCEEDED', result: { artifact_refs: [] } })
    },
    agentTaskDao: { updateStatus: (...args) => events.push(['taskStatus', ...args]) },
    agentRunDao: { updateStatus: (...args) => events.push(['runStatus', ...args]) }
  });
  director.createPlan = async () => plan;
  director._testEvents = events;
  director._testDelegatedTasks = delegatedTasks;
  return director;
}

test('run executes dependency-ordered tasks and emits completion events', async () => {
  const order = [];
  const plan = {
    summary: 'ordered plan',
    tasks: [
      { id: 'frontend', specialty: 'frontend', role: 'CODER', objective: 'UI', dependsOn: [], expectedOutput: 'UI' },
      { id: 'tests', specialty: 'testing', role: 'VERIFIER', objective: 'test UI', dependsOn: ['frontend'], expectedOutput: 'evidence' }
    ]
  };
  const director = createExecutionHarness({ plan });
  const originalExecuteWorker = director.executeWorker.bind(director);
  director.executeWorker = async (args) => {
    order.push(args.task.id);
    return originalExecuteWorker(args);
  };
  const result = await director.run({ userId: 'user-1', projectId: 'project-1', request: 'build and test UI', onEvent: (event) => director._testEvents.push(event) });

  assert.equal(result.status, 'COMPLETED');
  assert.deepEqual(order, ['frontend', 'tests']);
  assert.equal(director._testEvents.some((event) => event.type === 'director_complete' && event.status === 'SUCCEEDED'), true);
});

test('run retries a failed worker and succeeds without duplicating completed tasks', async () => {
  const plan = {
    summary: 'retry plan',
    tasks: [{ id: 'backend', specialty: 'backend', role: 'CODER', objective: 'implement API', dependsOn: [], expectedOutput: 'API' }]
  };
  const director = createExecutionHarness({ plan });
  let attempts = 0;
  director.executeWorker = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('transient worker failure');
    return { status: 'SUCCEEDED', result: { artifact_refs: [] } };
  };
  const result = await director.run({ userId: 'user-1', projectId: 'project-1', request: 'implement API' });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(attempts, 2);
});

test('run fails closed when final verification does not pass', async () => {
  const plan = {
    summary: 'verification failure',
    tasks: [{ id: 'change', specialty: 'frontend', role: 'CODER', objective: 'change UI', dependsOn: [], expectedOutput: 'change' }]
  };
  const director = createExecutionHarness({ plan });
  director.coordinator.startWorker = async (workerRunId, options = {}) => {
    if (options.runner) return options.runner();
    return { status: 'FAILED' };
  };

  await assert.rejects(
    director.run({ userId: 'user-1', projectId: 'project-1', request: 'change UI' }),
    /Final Director verification gate did not pass/
  );
  assert.equal(director._testEvents.some((event) => event[0] === 'taskStatus' && event[2] === 'FAILED'), true);
});
