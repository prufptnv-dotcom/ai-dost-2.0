import fs from 'node:fs';
import path from 'node:path';

describe('Autonomous Copilot Director contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/views/AutonomousCopilotDirector.jsx'),
    'utf8'
  ).replace(/\r\n/g, '\n');

  it('accepts a single user outcome and submits an autonomous chat task plan', () => {
    expect(source).toContain('const [input, setInput] = useState(\'\');');
    expect(source).toContain('chatTaskPlan: plan');
    expect(source).toContain("intent: {\n        type: 'task',");
    expect(source).toContain('requiresTool: true');
  });

  it('does not expose manual task selection or agent assignment controls', () => {
    expect(source).not.toContain('Select agent');
    expect(source).not.toContain('Assign task');
    expect(source).not.toContain('Choose role');
  });

  it('instructs the autonomous runtime to repair and verify instead of stopping at first error', () => {
    expect(source).toContain('diagnose the root cause, repair it, and re-run');
    expect(source).toContain('Continue until the requested outcome is working');
    expect(source).toContain('live preview');
    expect(source).toContain('browser tooling permits');
  });
});
