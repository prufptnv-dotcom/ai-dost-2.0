/**
 * Phase 1d — Devin-style Ask / Plan / Code modes.
 *
 *  - Ask mode answers via POST /chat and never touches /agent/run
 *  - Plan mode shows an EDITABLE plan whose approved version is overridden
 *    into the run body (backend executes it instead of its own LLM plan)
 *  - Code mode = autonomous execution (old default)
 *  - planGate toggle fully removed
 *
 * Mutation-verified: drop the plan override key / re-add planGate /
 * bypass runAskMode → matching tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

const askStart = SRC.indexOf('const runAskMode = async');
const askEnd = SRC.indexOf('const handleSend = async', askStart);
const ASK = SRC.slice(askStart, askEnd);

const approveStart = SRC.indexOf('const approvePlan = ()');
const approveEnd = SRC.indexOf('const cancelPlan', approveStart);
const APPROVE = SRC.slice(approveStart, approveEnd);

const runStart = SRC.indexOf('const runCopilot = async');
const runEnd = SRC.indexOf('const handleStopRun', runStart + 10);
const RUN = SRC.slice(runStart, runEnd);

describe('agent mode state & switch', () => {
  test('planGate is fully replaced by agentMode', () => {
    expect(SRC).not.toContain('planGate');
    expect(SRC).toContain("const [agentMode, setAgentMode] = useState('code');");
  });

  test('mode hydrates from and persists to localStorage', () => {
    expect(SRC).toContain("window.localStorage.getItem('ai_dost_copilot_mode')");
    expect(SRC).toMatch(/savedMode === 'ask' \|\| savedMode === 'plan' \|\| savedMode === 'code'/);
    expect(SRC).toContain("window.localStorage.setItem('ai_dost_copilot_mode', opt.v)");
  });

  test('switch UI renders Ask/Plan/Code as a radiogroup with aria-checked', () => {
    const uiStart = SRC.indexOf('data-testid="agent-mode-switch"');
    expect(uiStart).toBeGreaterThan(-1);
    const UI = SRC.slice(uiStart - 200, uiStart + 1400);
    expect(UI).toContain('role="radiogroup"');
    expect(UI).toContain('aria-checked={agentMode === opt.v}');
    expect(UI).toContain("{ v: 'ask', l: 'Ask'");
    expect(UI).toContain("{ v: 'plan', l: 'Plan'");
    expect(UI).toContain("{ v: 'code', l: 'Code'");
  });
});

describe('Ask mode', () => {
  test('ask branch routes to runAskMode before any plan/run call', () => {
    const branchIdx = SRC.indexOf("if (agentMode === 'ask')");
    expect(branchIdx).toBeGreaterThan(-1);
    expect(branchIdx).toBeLessThan(SRC.indexOf("if (agentMode !== 'plan')"));
    expect(SRC.slice(branchIdx, branchIdx + 320)).toContain('runAskMode(');
  });

  test('runAskMode answers via POST /chat (never /agent/run)', () => {
    expect(askStart).toBeGreaterThan(0);
    expect(ASK).toContain("api.post('/chat', { message: prompt })");
    expect(ASK).not.toContain('/agent/run');
    expect(ASK).not.toContain('copilotDirector');
  });

  test('runAskMode shows user row, status, and empty-reply guard', () => {
    expect(ASK).toContain("role: 'user', content: prompt");
    expect(ASK).toContain('workspace untouched');
    expect(ASK).toMatch(/if \(!reply \|\| !String\(reply\)\.trim\(\)\) throw/);
    expect(ASK).toContain('Ask mode failed');
  });

  test('base64 image tags are never sent to Ask mode', () => {
    const branchIdx = SRC.indexOf("if (agentMode === 'ask')");
    const branch = SRC.slice(branchIdx, SRC.indexOf("if (agentMode !== 'plan')"));
    expect(branch).toContain('runAskMode(rawPrompt');
    expect(branch).not.toContain('finalPrompt');
  });
});

describe('Plan mode routing + editable plan', () => {
  test('non-plan modes go straight to runCopilot; plan mode still hits /agent/plan', () => {
    expect(SRC).toContain("if (agentMode !== 'plan')");
    expect(SRC).toContain("api.post('/agent/plan', { userPrompt: finalPrompt })");
  });

  test('plan card exposes editable step inputs', () => {
    expect(SRC).toContain('data-testid="plan-editor"');
    const inputCount = (SRC.match(/data-testid="plan-step-input"/g) || []).length;
    expect(inputCount).toBeGreaterThanOrEqual(1);
    expect(SRC).toContain('data-testid="plan-add-step"');
    expect(SRC).toMatch(/aria-label=\{`Plan step \$\{i \+ 1\}`\}/);
  });

  test('rows are removable and approve is disabled without non-empty titles', () => {
    expect(SRC).toContain('title="Remove step"');
    expect(SRC).toContain('disabled={!pendingPlan.tasks.some(t => (t.title || \'\').trim())}');
    expect(SRC).toContain('data-testid="plan-approve-btn"');
  });
});

describe('Plan override into the run', () => {
  test('runCopilot accepts planOverride and forwards it in the body', () => {
    expect(RUN).toContain('const runCopilot = async (prompt, attachedImages = [], planOverride = null, runOptions = {}) => {');
    expect(RUN).toContain('...(planOverride ? { plan: planOverride } : {}),');
    expect(RUN).toContain('copilotDirector: true');
  });

  test('approvePlan maps edited titles → normalized plan tasks', () => {
    expect(approveStart).toBeGreaterThan(0);
    expect(APPROVE).toContain("id: `task-${i + 1}`");
    expect(APPROVE).toContain('objective: String(t.title).trim()');
    expect(APPROVE).toContain("dependsOn: i > 0 ? [`task-${i}`] : []");
    expect(APPROVE).toContain('filter(t => (t.title || \'\').trim())');
  });

  test('approvePlan passes the preset to runCopilot (empty plan → null fallback)', () => {
    expect(APPROVE).toContain('runCopilot(prompt, images, presetPlan.tasks.length ? presetPlan : null)');
    expect(APPROVE).toContain('setPendingPlan(null)');
  });
});
