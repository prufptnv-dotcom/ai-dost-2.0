'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlan, fallbackPlan, SPECIALTY_TO_ROLE } = require('../agent/runtime/CopilotDirector');

describe('CopilotDirector', () => {
  test('keeps simple outcomes to one adaptive task', () => {
    const plan = fallbackPlan('fix the typo in the login button');
    assert.equal(plan.tasks.length, 1);
    assert.equal(plan.tasks[0].role, undefined);
  });

  test('maps UI/backend specialties to trusted runtime roles', () => {
    const plan = normalizePlan({
      summary: 'complex feature',
      tasks: [
        { id: 'requirements', specialty: 'requirements', objective: 'inspect the current implementation', dependsOn: [] },
        { id: 'frontend', specialty: 'frontend', objective: 'implement the UI change', dependsOn: ['requirements'] },
        { id: 'verify', specialty: 'verification', objective: 'verify the result', dependsOn: ['frontend'] },
      ],
    }, 'complex feature');
    assert.deepEqual(plan.tasks.map((task) => task.role), ['RESEARCHER', 'CODER', 'VERIFIER']);
    assert.equal(SPECIALTY_TO_ROLE.backend, 'CODER');
  });

  test('drops invalid and self dependencies during normalization', () => {
    const plan = normalizePlan({
      tasks: [
        { id: 'a', specialty: 'integration', objective: 'first', dependsOn: ['a', 'missing'] },
        { id: 'b', specialty: 'verification', objective: 'second', dependsOn: ['a'] },
      ],
    }, 'goal');
    assert.deepEqual(plan.tasks[0].dependsOn, []);
    assert.deepEqual(plan.tasks[1].dependsOn, ['a']);
  });

  test('caps planned tasks at defensive limit (MAX_TASKS = 32)', () => {
    const plan = normalizePlan({
      tasks: Array.from({ length: 40 }, (_, index) => ({
        id: `task-${index + 1}`,
        specialty: 'integration',
        objective: `objective ${index + 1}`,
        dependsOn: index ? [`task-${index}`] : [],
      })),
    }, 'goal');
    assert.ok(plan.tasks.length <= 32);
  });
});
