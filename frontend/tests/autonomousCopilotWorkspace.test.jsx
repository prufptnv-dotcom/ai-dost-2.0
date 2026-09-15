import { normalizeDirectorPlan } from '../components/views/AutonomousCopilotWorkspace';

describe('Autonomous Copilot Director', () => {
  it('keeps a valid adaptive task graph and removes unknown dependencies', () => {
    const plan = normalizeDirectorPlan({
      goal: 'Build dashboard',
      mode: 'NEW_PROJECT',
      confidence: 0.9,
      tasks: [
        { id: 'T1', role: 'REQUIREMENTS', title: 'Inspect', objective: 'Inspect requirements', dependsOn: [] },
        { id: 'T2', role: 'FRONTEND', title: 'Build UI', objective: 'Build UI', dependsOn: ['T1', 'UNKNOWN'] },
      ],
    }, 'Build dashboard');

    expect(plan.tasks).toHaveLength(2);
    expect(plan.tasks[1].dependsOn).toEqual(['T1']);
    expect(plan.tasks[0].status).toBe('queued');
  });

  it('falls back to one task for a simple request', () => {
    const plan = normalizeDirectorPlan(null, 'change button text to Save');
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].objective).toContain('change button text to Save');
  });

  it('falls back to multiple specialist tasks for a complex change', () => {
    const plan = normalizeDirectorPlan(null, 'Build a full-stack dashboard with authentication, PostgreSQL API, responsive frontend, Stripe integration, automated tests and visual verification');
    expect(plan.tasks.length).toBeGreaterThanOrEqual(4);
    expect(plan.tasks.some((task) => task.role === 'BACKEND')).toBe(true);
    expect(plan.tasks.some((task) => task.role === 'FRONTEND')).toBe(true);
    expect(plan.tasks.some((task) => task.role === 'VERIFIER' || task.role === 'VISUAL_QA')).toBe(true);
  });
});
