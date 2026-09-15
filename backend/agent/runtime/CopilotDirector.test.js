'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// CopilotDirector's pure planning helpers should be testable without loading
// database, network, or model-provider dependencies from the runtime graph.
const originalLoad = Module._load;
Module._load = function isolatedRuntimeLoad(request, parent, isMain) {
  if (request === '../../services/openaiService') {
    return class OpenAIServiceMock {};
  }
  if (request === './AgentCoordinator') {
    return class AgentCoordinatorMock {};
  }
  if (request === './resultValidator') {
    return { ResultValidator: class ResultValidatorMock {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
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
