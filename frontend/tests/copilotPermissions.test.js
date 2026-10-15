/**
 * Phase 2a — Devin-style permission levels (Ask / Auto / Turbo) + ask-mode
 * approval resume for the Copilot IDE.
 * Mutation-verified: (a) drop permissionLevel/approvalToken from the run
 * body → body tests fail; (b) stop pushing kind:'approval' on
 * gate_approval_required → banner tests fail; (c) remove the approve/reject
 * banner wiring → static audit tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('permission level state (static audit)', () => {
  test('permissionLevel state defaults to auto and validates stored values', () => {
    expect(SRC).toMatch(/const \[permissionLevel, setPermissionLevel\] = useState\('auto'\)/);
    expect(SRC).toMatch(
      /savedPerm === 'ask' \|\| savedPerm === 'auto' \|\| savedPerm === 'turbo'\) setPermissionLevel\(savedPerm\)/
    );
  });

  test('permission switch UI persists to ai_dost_copilot_permissions', () => {
    expect(SRC).toContain('data-testid="permission-switch"');
    expect(SRC).toContain('aria-label="Agent permission level"');
    expect(SRC).toContain("localStorage.setItem('ai_dost_copilot_permissions'");
    const start = SRC.indexOf('data-testid="permission-switch"');
    const end = SRC.indexOf('Clear Conversation', start);
    const options = SRC.slice(start, end === -1 ? start + 1500 : end);
    for (const v of ["v: 'ask'", "v: 'auto'", "v: 'turbo'"]) {
      expect(options).toContain(v);
    }
  });
});

describe('run body carries permission + approval resume (static audit)', () => {
  const runBlock = SRC.slice(SRC.indexOf('const runCopilot'));
  const fetchBody = runBlock.slice(
    runBlock.indexOf('body: JSON.stringify'),
    runBlock.indexOf('signal: controller.signal')
  );

  test('permissionLevel is sent with every run', () => {
    expect(fetchBody).toContain('permissionLevel,');
  });

  test('approvalToken resume field is included only when provided', () => {
    expect(fetchBody).toMatch(/\.\.\.\(runOptions\.approvalToken \? \{ approvalToken: runOptions\.approvalToken \} : \{\}\)/);
  });

  test('runCopilot accepts runOptions and stores resume inputs in lastRunRef', () => {
    expect(SRC).toMatch(/const runCopilot = async \(prompt, attachedImages = \[\], planOverride = null, runOptions = \{\}\)/);
    expect(SRC).toMatch(/lastRunRef\.current = \{ mode: 'code', prompt, attachedImages, planOverride \}/);
    expect(SRC).toMatch(/const lastRunRef = useRef\(null\)/);
  });

  test('approval resume does not duplicate the user message row', () => {
    expect(SRC).toContain('if (!runOptions.approvalToken) {');
    expect(SRC).toContain("role: 'user', content: cleanDisplay, images: attachedImages");
  });
});

describe('ask-mode approval flow (static audit)', () => {
  test('gate_approval_required with a token pushes an actionable approval row', () => {
    expect(SRC).toContain("data.type === 'gate_approval_required' && data.gate && data.gate.approval_token");
    expect(SRC).toMatch(/kind: 'approval',\r?\n\s+token: data\.gate\.approval_token/);
  });

  test('approval banner renders Approve/Reject with testids', () => {
    expect(SRC).toContain('data-testid="approval-banner"');
    expect(SRC).toContain('data-testid="approval-approve-btn"');
    expect(SRC).toContain('data-testid="approval-reject-btn"');
    expect(SRC).toMatch(/onClick=\{\(\) => approveRun\(m\.token\)\}/);
    expect(SRC).toMatch(/onClick=\{\(\) => rejectApproval\(m\.token\)\}/);
  });

  test('approveRun resumes the paused run with the single-use token', () => {
    const fn = SRC.slice(SRC.indexOf('const approveRun'));
    const body = fn.slice(0, fn.indexOf('const rejectApproval'));
    expect(body).toContain("resolved: 'approved'");
    expect(body).toMatch(/runCopilot\(last\.prompt, last\.attachedImages \|\| \[\], last\.planOverride \|\| null, \{ approvalToken: token \}\)/);
  });

  test('rejectApproval resolves the banner without starting a run', () => {
    // Slice only rejectApproval itself — retryLastRun (Phase 2d) legitimately
    // follows it and calls runCopilot, but that is a separate user action.
    const fn = SRC.slice(SRC.indexOf('const rejectApproval'));
    const body = fn.slice(0, fn.indexOf('const retryLastRun'));
    expect(body).toContain("resolved: 'rejected'");
    expect(body).toMatch(/Run rejected by user/);
    expect(body).not.toContain('runCopilot(');
  });

  test('approved/rejected banners show resolved state instead of buttons', () => {
    const banner = SRC.slice(SRC.indexOf('data-testid="approval-banner"'));
    const end = banner.indexOf('data-testid="thought-row"');
    const block = banner.slice(0, end === -1 ? 4000 : end);
    expect(block).toMatch(/\{!resolved \? \(/);
    expect(block).toContain('✓ Approved — resuming run…');
    expect(block).toContain('✗ Rejected — run cancelled');
  });
});
