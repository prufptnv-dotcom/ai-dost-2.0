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
      runWithPlan: async (...args) => {
        if (String(args[5] || '').startsWith('copilot_verify_')) {
          return {
            status: verificationStatus,
            summary: 'Build and smoke test passed',
            artifact_refs: ['verification:build-pass'],
            result: { artifact_refs: [] }
          };
        }
        return { status: workerStatuses[workerIndex++] || 'SUCCEEDED', result: { artifact_refs: [] } };
      }
    },
    agentTaskDao: { updateStatus: (...args) => events.push(['taskStatus', ...args]) },
    agentRunDao: { updateStatus: (...args) => events.push(['runStatus', ...args]) }
  });
  director.createPlan = async () => plan;
  director._testEvents = events;
  director._testDelegatedTasks = delegatedTasks;
  return director;
}

test('createPlan forwards an explicit preferred model to the planner cascade', async () => {
  let callArgs = null;
  const director = new CopilotDirector({
    aiService: {
      chat: async (...args) => {
        callArgs = args;
        return JSON.stringify({
          summary: 'model preference plan',
          tasks: [{
            id: 'build-ui',
            specialty: 'frontend',
            role: 'CODER',
            objective: 'Build the requested UI',
            dependsOn: [],
            expectedOutput: 'Working UI',
          }],
        });
      },
    },
    coordinator: {},
  });

  const plan = await director.createPlan('Build a dashboard', { projectId: 'project-1' }, 'gemini');
  assert.equal(callArgs[2], 'planner');
  assert.match(callArgs[0], /AI-DOST CODE GENERATION STRATEGY/);
  assert.match(callArgs[0], /preserve the detected workspace stack|Choose a well-supported/i);
  assert.equal(callArgs[4], 'gemini');
  assert.equal(plan.tasks.length, 1);
});

test('createPlan preserves the existing cascade call when preferred model is auto', async () => {
  let callArgs = null;
  const director = new CopilotDirector({
    aiService: {
      chat: async (...args) => {
        callArgs = args;
        return JSON.stringify({
          summary: 'auto plan',
          tasks: [{
            id: 'build-ui',
            specialty: 'frontend',
            role: 'CODER',
            objective: 'Build the requested UI',
            dependsOn: [],
            expectedOutput: 'Working UI',
          }],
        });
      },
    },
    coordinator: {},
  });

  await director.createPlan('Build a dashboard', { projectId: 'project-1' }, 'auto');
  assert.equal(callArgs[2], 'planner');
  assert.equal(callArgs.length, 3);
});

test('run propagates explicit preferred model to plan creation and worker execution', async () => {
  const plan = {
    summary: 'model propagation',
    tasks: [{
      id: 'frontend',
      specialty: 'frontend',
      role: 'CODER',
      objective: 'Build UI',
      dependsOn: [],
      expectedOutput: 'Working UI',
    }],
  };
  const director = createExecutionHarness({ plan });
  let planArgs = null;
  let workerPreferredModel = null;
  director.createPlan = async (...args) => {
    planArgs = args;
    return plan;
  };
  director.executeWorker = async (args) => {
    workerPreferredModel = args.preferredModel;
    return { status: 'SUCCEEDED', result: { artifact_refs: [] } };
  };

  const result = await director.run({
    userId: 'user-1',
    projectId: 'project-1',
    request: 'Build a dashboard',
    preferredModel: 'groq',
  });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(planArgs[2], 'groq');
  assert.equal(workerPreferredModel, 'groq');
});

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


test('run fails closed when a worker resolves with a non-success result', async () => {
  const plan = {
    summary: 'failed mutation',
    tasks: [{ id: 'change', specialty: 'frontend', role: 'CODER', objective: 'change UI', dependsOn: [], expectedOutput: 'updated UI' }]
  };
  const director = createExecutionHarness({ plan });
  const originalStartWorker = director.coordinator.startWorker.bind(director.coordinator);
  director.coordinator.startWorker = async (workerRunId, options = {}) => {
    if (workerRunId === 'worker-1') return { status: 'FAILED', error: 'Mutation did not apply' };
    return originalStartWorker(workerRunId, options);
  };

  await assert.rejects(
    director.run({ userId: 'user-1', projectId: 'project-1', request: 'change UI', onEvent: (event) => director._testEvents.push(event) }),
    /Mutation did not apply/
  );
  assert.equal(
    director._testEvents.some((event) => event.type === 'director_task' && event.status === 'FAILED'),
    true,
    'the failure must be streamed instead of being reported as a successful worker'
  );
});

test('run fails closed when final verification does not pass', async () => {
  const plan = {
    summary: 'verification failure',
    tasks: [{ id: 'change', specialty: 'frontend', role: 'CODER', objective: 'change UI', dependsOn: [], expectedOutput: 'change' }]
  };
  const director = createExecutionHarness({ plan });
  const originalStartWorker = director.coordinator.startWorker;
  director.coordinator.startWorker = async (workerRunId, options = {}) => {
    if (workerRunId === 'worker-2') return { status: 'FAILED' };
    return originalStartWorker(workerRunId, options);
  };

  await assert.rejects(
    director.run({ userId: 'user-1', projectId: 'project-1', request: 'change UI' }),
    /Final Director verification gate did not pass/
  );
  assert.equal(director._testEvents.some((event) => event[0] === 'taskStatus' && event[2] === 'FAILED'), true);
});


test('self-healing retries a failed build with the concrete failure in the repair prompt', async () => {
  const plan = {
    summary: 'self-healing regression',
    tasks: [{ id: 'build', specialty: 'frontend', role: 'CODER', objective: 'build the requested UI', dependsOn: [], expectedOutput: 'working UI' }]
  };
  const director = createExecutionHarness({ plan });
  const objectives = [];
  let executionAttempts = 0;
  director.taskPlanner.generatePlan = async (objective) => {
    objectives.push(objective);
    return { steps: [{ action: 'run_command', params: { command: 'npm run build' } }] };
  };
  director.plannerExecutionLoop.runWithPlan = async () => {
    executionAttempts += 1;
    if (executionAttempts === 1) {
      return { status: 'FAILED', error: 'Build failed: Cannot find module ./Button' };
    }
    return { status: 'SUCCEEDED', result: { artifact_refs: ['build:verified'] } };
  };

  const result = await director.executeWorker({
    task: plan.tasks[0],
    delegated: { workerRun: { id: 'worker-self-heal' } },
    projectId: 'project-1',
    userId: 'user-1',
    request: 'build the requested UI',
    maxRepairs: 1
  });

  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(executionAttempts, 2);
  assert.equal(objectives.length, 2);
  assert.match(objectives[1], /REPAIR ATTEMPT 2/);
  assert.match(objectives[1], /Cannot find module \.\/Button/);
});


test('successful completion preserves final verification evidence in terminal event and result', async () => {
  const plan = {
    summary: 'verified plan',
    tasks: [{ id: 'frontend', specialty: 'frontend', role: 'CODER', objective: 'build UI', dependsOn: [], expectedOutput: 'UI' }]
  };
  const director = createExecutionHarness({ plan });
  const events = [];
  const result = await director.run({
    userId: 'user-1',
    projectId: 'project-1',
    request: 'build UI',
    onEvent: (event) => events.push(event)
  });

  const completion = events.find((event) => event.type === 'director_complete');
  const verification = events.find((event) => event.type === 'director_verification' && event.status === 'SUCCEEDED');
  assert.equal(result.status, 'COMPLETED');
  assert.equal(completion.verification.status, 'SUCCEEDED');
  assert.equal(completion.verification.summary, 'Build and smoke test passed');
  assert.deepEqual(completion.verification.artifact_refs, ['verification:build-pass']);
  assert.equal(verification.summary, 'Build and smoke test passed');
  assert.ok(result.artifact_refs.includes('verification:build-pass'));
});


function assertCancelledPersistence(director) {
  assert.equal(
    director._testEvents.some((event) => event[0] === 'taskStatus' && event[2] === 'CANCELLED'),
    true,
    'the supervisor task must be persisted as CANCELLED'
  );
  assert.equal(
    director._testEvents.some((event) =>
      event[0] === 'runStatus' &&
      event[2] === 'CANCELLED' &&
      typeof event[5] === 'string' &&
      !Number.isNaN(Date.parse(event[5]))
    ),
    true,
    'the supervisor run must be persisted as CANCELLED with a completion timestamp'
  );
  assert.equal(
    director._testEvents.some((event) => event[0] === 'taskStatus' && event[2] === 'FAILED'),
    false,
    'cancellation must not be persisted as failure'
  );
}

test('run persists cancellation when the signal is already aborted before execution', async () => {
  const plan = {
    summary: 'cancel before execution',
    tasks: [{ id: 'change', specialty: 'frontend', role: 'CODER', objective: 'change UI', dependsOn: [], expectedOutput: 'change' }]
  };
  const director = createExecutionHarness({ plan });
  const controller = new AbortController();
  controller.abort();
  const streamEvents = [];

  const result = await director.run({
    userId: 'user-1',
    projectId: 'project-1',
    request: 'change UI',
    signal: controller.signal,
    onEvent: (event) => streamEvents.push(event)
  });

  assert.equal(result.status, 'CANCELLED');
  assertCancelledPersistence(director);
  assert.equal(streamEvents.some((event) => event.type === 'director_complete'), false);
});

test('run persists cancellation when a worker returns CANCELLED', async () => {
  const plan = {
    summary: 'cancel in worker',
    tasks: [{ id: 'change', specialty: 'frontend', role: 'CODER', objective: 'change UI', dependsOn: [], expectedOutput: 'change' }]
  };
  const director = createExecutionHarness({ plan });
  director.executeWorker = async () => ({ status: 'CANCELLED' });

  const result = await director.run({
    userId: 'user-1',
    projectId: 'project-1',
    request: 'change UI'
  });

  assert.equal(result.status, 'CANCELLED');
  assertCancelledPersistence(director);
});

test('run treats TASK_CANCELED worker errors as cancellation without retrying or marking failure', async () => {
  const plan = {
    summary: 'cancel via worker error',
    tasks: [{ id: 'change', specialty: 'frontend', role: 'CODER', objective: 'change UI', dependsOn: [], expectedOutput: 'change' }]
  };
  const director = createExecutionHarness({ plan });
  let attempts = 0;
  director.executeWorker = async () => {
    attempts += 1;
    throw Object.assign(new Error('Task canceled by user'), { code: 'TASK_CANCELED' });
  };

  const result = await director.run({
    userId: 'user-1',
    projectId: 'project-1',
    request: 'change UI'
  });

  assert.equal(result.status, 'CANCELLED');
  assert.equal(attempts, 1, 'a cancellation should not consume a retry');
  assertCancelledPersistence(director);
});


test('run fails closed when a required planned task is skipped after delegation failure', async () => {
  const plan = {
    summary: 'required task cannot be delegated',
    tasks: [
      { id: 'required', specialty: 'frontend', role: 'CODER', objective: 'required implementation', dependsOn: [], expectedOutput: 'working implementation' },
      { id: 'independent', specialty: 'backend', role: 'CODER', objective: 'independent task', dependsOn: [], expectedOutput: 'working backend' }
    ]
  };
  const director = createExecutionHarness({ plan });
  const originalDelegate = director.coordinator.delegate.bind(director.coordinator);
  director.coordinator.delegate = async (input) => {
    if (input.objective === 'required implementation') {
      throw new Error('worker capacity reached');
    }
    return originalDelegate(input);
  };
  const streamEvents = [];

  const result = await director.run({
    userId: 'user-1',
    projectId: 'project-1',
    request: 'complete both tasks',
    onEvent: (event) => streamEvents.push(event)
  });

  assert.equal(result.status, 'FAILED');
  assert.equal(result.verification_status, 'PASSED');
  assert.match(result.summary, /1 planned task\(s\) did not succeed: required \(SKIPPED\)/);
  assert.equal(result.errors[0].code, 'INCOMPLETE_PLAN');

  assert.equal(
    streamEvents.some((event) => event.type === 'director_task' && event.status === 'SKIPPED' && event.taskId === 'required'),
    true,
    'the skipped required task must be visible in the event stream'
  );
  assert.equal(
    streamEvents.some((event) => event.type === 'director_complete' && event.status === 'SUCCEEDED'),
    false,
    'a partially executed plan must never emit a success terminal event'
  );
  assert.equal(
    streamEvents.some((event) => event.type === 'director_complete' && event.status === 'FAILED'),
    true,
    'verification may finish, but overall completion must report the incomplete plan as failed'
  );
  assert.equal(
    director._testEvents.some((event) => event[0] === 'taskStatus' && event[2] === 'FAILED'),
    true,
    'the supervisor task must be persisted as FAILED when the plan is incomplete'
  );
});


test('fallbackPlan recognizes Hindi full-app requests and preserves verification work', () => {
  const plan = fallbackPlan('एक पूरा डैशबोर्ड ऐप बनाओ');
  assert.equal(plan.tasks.length, 3);
  assert.match(plan.summary, /multi-specialist/i);
  assert.equal(plan.tasks[2].specialty, 'testing');
  assert.deepEqual(plan.tasks[2].dependsOn, ['task-2']);
});

test('fallbackPlan keeps a small Hinglish code request fast', () => {
  const plan = fallbackPlan('ek date formatting function likho');
  assert.equal(plan.tasks.length, 1);
});

test('worker receives framework guidance from an existing nested workspace manifest', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-stack-context-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'frontend'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'frontend', 'package.json'), JSON.stringify({ dependencies: { next: '^16.0.0', react: '^19.0.0' } }));
    fs.writeFileSync(path.join(tempDir, 'frontend', 'src.js'), 'export default 1;');
    const plannerCalls = [];
    const workerDirector = new CopilotDirector({
      aiService: { chat: async () => '{}' },
      coordinator: {
        async createSupervisorTask() { return { task: { id: 'supervisor-1' }, run: { id: 'supervisor-run-1' } }; },
        async delegate() { return { workerRun: { id: 'worker-1' } }; },
        async startWorker(_id, options) { return options.runner(); },
      },
      workspaceManager: { getWorkspaceMetadata: () => ({ fileCount: 2, diskPath: tempDir }) },
      taskPlanner: {
        async generatePlan(objective, context) { plannerCalls.push({ objective, context }); return { steps: [] }; },
        async generateVerificationPlan() { return { steps: [] }; },
      },
      plannerExecutionLoop: {
        async runWithPlan(_projectId, _userId, _plan, _repairs, _cancel, runId) {
          return String(runId).startsWith('copilot_verify_') ? { status: 'SUCCEEDED' } : { status: 'SUCCEEDED' };
        },
      },
      agentTaskDao: { updateStatus() {} },
      agentRunDao: { updateStatus() {} },
    });
    const result = await workerDirector.run({ userId: 'u1', projectId: 'p1', request: 'Add a settings page to the existing app', plan: {
      summary: 'stack preservation',
      tasks: [{ id: 'edit', specialty: 'frontend', objective: 'Add settings page', dependsOn: [], expectedOutput: 'Page works' }],
    } });
    assert.equal(result.status, 'COMPLETED');
    assert.match(plannerCalls[0].objective, /Next\.js/);
    assert.match(plannerCalls[0].objective, /preserve the detected workspace stack/);
    assert.equal(plannerCalls[0].context.existingFiles.includes('frontend/package.json'), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
