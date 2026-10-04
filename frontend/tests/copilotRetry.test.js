/**
 * Phase 2d — message retry: failed runs render as kind:'error' rows with a
 * Retry button that re-runs the last prompt (code or ask mode).
 * Mutation-verified: flip one error push back to kind:'thought' OR delete the
 * retry wiring → the corresponding static audit tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('error rows (static audit)', () => {
  test('all four failure paths push kind:\'error\' rows', () => {
    // SSE error event, director_error, runCopilot catch, runAskMode catch.
    expect(SRC.match(/kind: 'error'/g) || []).toHaveLength(4);
    expect(SRC).not.toMatch(/type === 'error'[\s\S]{0,300}kind: 'thought'/);
    expect(SRC).not.toMatch(/type === 'director_error'[\s\S]{0,300}kind: 'thought'/);
  });

  test('runCopilot catch pushes a chat row (AbortError excluded)', () => {
    const catchBlock = SRC.slice(SRC.indexOf('} catch (err) {', SRC.indexOf('const runCopilot')));
    const body = catchBlock.slice(0, catchBlock.indexOf('} finally {'));
    expect(body).toContain("err.name !== 'AbortError'");
    expect(body).toContain("kind: 'error'");
  });
});

describe('retry wiring (static audit)', () => {
  test('retryLastRun re-dispatches ask vs code runs with guards', () => {
    const fn = SRC.slice(SRC.indexOf('const retryLastRun'));
    const body = fn.slice(0, fn.indexOf('const handleSendRef'));
    expect(body).toContain('if (running) return;');
    expect(body).toContain("showToast('No previous run to retry'");
    expect(body).toContain("if (last.mode === 'ask') return runAskMode(last.prompt);");
    expect(body).toContain('runCopilot(last.prompt, last.attachedImages || [], last.planOverride || null);');
  });

  test('lastRunRef records the mode for both run kinds', () => {
    expect(SRC).toMatch(/lastRunRef\.current = \{ mode: 'code', prompt, attachedImages, planOverride \}/);
    expect(SRC).toMatch(/lastRunRef\.current = \{ mode: 'ask', prompt \}/);
  });

  test('error rows render a Retry button (hidden while running)', () => {
    expect(SRC).toContain('data-testid="error-row"');
    expect(SRC).toContain('data-testid="msg-retry-btn"');
    expect(SRC).toMatch(/onClick=\{retryLastRun\}/);
    expect(SRC).toMatch(/\{!running && lastRunRef\.current && \(/);
  });
});
