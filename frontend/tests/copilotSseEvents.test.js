/**
 * Phase 1b — CopilotIDE SSE event handler completeness.
 *
 * Every event the agent run may emit must be visible in the chat stream:
 * ReAct-loop events (start/error/terminal_output/self_heal/gate_*) get explicit
 * branches, and a catch-all ensures unknown types are never silently dropped
 * (first 2 rows per type, then a status counter).
 *
 * Mutation-verified: delete any branch or the catch-all → matching test fails.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

const HANDLER_START = SRC.indexOf('const data = JSON.parse(jsonStr)');
const HANDLER_END = SRC.indexOf('} catch (err)', HANDLER_START);
const HANDLER = SRC.slice(HANDLER_START, HANDLER_END);

describe('CopilotIDE SSE handler — ReAct-loop events', () => {
  test('handler slice extraction is sane', () => {
    expect(HANDLER_START).toBeGreaterThan(0);
    expect(HANDLER_END).toBeGreaterThan(HANDLER_START);
    expect(HANDLER).toContain("data.type === 'director_plan'");
    expect(HANDLER).toContain("data.type === 'done'");
  });

  test('start event shows analysis status + thought row', () => {
    expect(HANDLER).toMatch(/data\.type === 'start'/);
    const startBranch = HANDLER.slice(HANDLER.indexOf("data.type === 'start'"));
    expect(startBranch).toContain('Analyzing prompt');
    expect(startBranch).toContain('kind: \'thought\'');
  });

  test('error event → red row + in_progress plan task marked error', () => {
    const idx = HANDLER.indexOf("data.type === 'error'");
    expect(idx).toBeGreaterThan(-1);
    const errBranch = HANDLER.slice(idx, HANDLER.indexOf("data.type === 'terminal_output'"));
    expect(errBranch).toContain('tone: \'error\'');
    expect(errBranch).toContain('status: \'error\'');
  });

  test('terminal_output renders output (capped) as a step row', () => {
    expect(HANDLER).toMatch(/data\.type === 'terminal_output'/);
    expect(HANDLER).toContain("kind: 'step'");
    expect(HANDLER).toMatch(/out\.slice\(0, 2000\)/);
  });

  test('self_heal surfaces repair attempts', () => {
    expect(HANDLER).toMatch(/data\.type === 'self_heal'/);
    expect(HANDLER).toContain('Self-heal:');
  });

  test('all four approval gate events are handled', () => {
    ['gate_approval_required', 'gate_blocked', 'gate_approved', 'gate_approval_invalid']
      .forEach((g) => expect(HANDLER).toContain(`'${g}'`));
  });
});

describe('CopilotIDE SSE handler — catch-all fallback', () => {
  test('unknown event types fall through to a visible else branch', () => {
    expect(HANDLER).toMatch(/else \{\s*\n\s*const evtType = String\(data\.type \|\| 'event'\);/);
    expect(HANDLER).toContain('unknownEventCounts.get(evtType)');
  });

  test('dedupe: first 2 rows per type, then status counter only', () => {
    expect(HANDLER).toMatch(/if \(seen < 2\) \{/);
    expect(HANDLER).toMatch(/unknownEventCounts\.set\(evtType, seen \+ 1\);/);
    expect(HANDLER).toMatch(/×\$\{seen \+ 1\}/);
  });

  test('catch-all is the LAST branch (after done)', () => {
    const catchAllIdx = HANDLER.indexOf("const evtType = String(data.type || 'event')");
    const doneIdx = HANDLER.indexOf("data.type === 'done'");
    expect(catchAllIdx).toBeGreaterThan(doneIdx);
  });

  test('unknownEventCounts declared before handler use (TDZ guard)', () => {
    const declIdx = SRC.indexOf('const unknownEventCounts = new Map();');
    expect(declIdx).toBeGreaterThan(-1);
    expect(declIdx).toBeLessThan(HANDLER_START);
    expect(SRC.indexOf('const createdFilesTracker')).toBeLessThan(declIdx);
  });

  test('catch-all message detail extraction is defensive', () => {
    const catchAll = HANDLER.slice(HANDLER.indexOf("const evtType = String(data.type || 'event')"));
    expect(catchAll).toMatch(/data\.message \|\| data\.status \|\| data\.summary \|\| data\.error/);
    expect(catchAll).toMatch(/String\(detail\)\.slice\(0, 160\)/);
  });
});
