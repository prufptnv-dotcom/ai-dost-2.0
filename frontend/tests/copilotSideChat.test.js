/**
 * Phase 2c — Devin-style /btw side question: ask a background question
 * WITHOUT interrupting the running agent (only /chat is called).
 * Mutation-verified: remove the running-guard bypass or the /btw branch →
 * the corresponding static audit tests fail.
 */
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/views/CopilotIDE.jsx'),
  'utf8'
);

describe('/btw side chat (static audit)', () => {
  test('/btw branch fires before the running guard in handleSend', () => {
    const send = SRC.slice(SRC.indexOf('const handleSend = async'));
    const head = send.slice(0, send.indexOf('isImageCreateRequest'));
    expect(head).toContain("rawPrompt.startsWith('/btw')");
    expect(head).toContain('rawPrompt.replace(/^\\/btw\\s*/, \'\')');
    expect(head).toContain('return askSideChat(question);');
    // The generic running-guard must come AFTER the /btw short-circuit.
    expect(head.indexOf("rawPrompt.startsWith('/btw')")).toBeLessThan(
      head.indexOf('|| running) return')
    );
  });

  test('askSideChat posts ONLY to /chat and pushes a sidechat row', () => {
    const fn = SRC.slice(SRC.indexOf('const askSideChat = async'));
    const body = fn.slice(0, fn.indexOf('// ── @file mentions'));
    expect(body).toContain("api.post('/chat', { message: question })");
    expect(body).toContain("kind: 'sidechat'");
    expect(body).not.toContain('runCopilot(');
    expect(body).not.toContain('/agent/run');
  });

  test('Enter sends /btw even while running (other sends still blocked)', () => {
    expect(SRC).toContain("const sideAsk = raw.startsWith('/btw');");
    expect(SRC).toMatch(/if \(\(raw && \(!running \|\| sideAsk\)\) \|\| \(pastedImages\.length > 0 && !running\)\) handleSend\(\)/);
  });

  test('sidechat renders as a distinct non-run row', () => {
    expect(SRC).toContain('data-testid="sidechat-row"');
    expect(SRC).toContain('BTW — side question (run uninterrupted)');
    expect(SRC).toMatch(/if \(m\.kind === 'sidechat'\)/);
  });
});
