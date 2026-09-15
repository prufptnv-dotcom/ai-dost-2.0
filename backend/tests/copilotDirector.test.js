'use strict';

const { normalizePlan, fallbackPlan, SPECIALTY_TO_ROLE } = require('../agent/runtime/CopilotDirector');

describe('CopilotDirector', () => {
  test('keeps simple outcomes to one adaptive task', () => {
    const plan = fallbackPlan('fix the typo in the login button');
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].role).toBeUndefined();
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
    expect(plan.tasks.map((task) => task.role)).toEqual(['RESEARCHER', 'CODER', 'VERIFIER']);
    expect(SPECIALTY_TO_ROLE.backend).toBe('CODER');
  });

  test('drops forward/self dependencies during normalization', () => {
    const plan = normalizePlan({
      tasks: [
        { id: 'a', specialty: 'integration', objective: 'first', dependsOn: ['b', 'a', 'missing'] },
        { id: 'b', specialty: 'verification', objective: 'second', dependsOn: ['a'] },
      ],
    }, 'goal');
    expect(plan.tasks[0].dependsOn).toEqual([]);
    expect(plan.tasks[1].dependsOn).toEqual(['a']);
  });

  test('never emits more than five planned tasks', () => {
    const plan = normalizePlan({
      tasks: Array.from({ length: 8 }, (_, index) => ({
        id: `task-${index + 1}`,
        specialty: 'integration',
        objective: `objective ${index + 1}`,
        dependsOn: index ? [`task-${index}`] : [],
      })),
    }, 'goal');
    expect(plan.tasks.length).toBeLessThanOrEqual(5);
  });
});
