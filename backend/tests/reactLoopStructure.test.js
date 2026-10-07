const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

/**
 * P3 — True ReAct loop.
 *
 * P3's three structural guarantees, each one a regression that previously
 * existed in `routes/agent.js`:
 *   1. Neither step-0 short-circuit may hard-return before the loop runs.
 *   2. A provider error must never become a FINAL_ANSWER.
 *   3. The step ceiling must be a real, client-visible, clamped budget.
 *
 * These are static source audits plus behavioural checks of the pure helpers,
 * because the invariants are structural: a regex that proves the offending
 * `return` is gone fails the moment someone re-adds it.
 */

const AGENT_JS = path.join(__dirname, '..', 'routes', 'agent.js');
const source = fs.readFileSync(AGENT_JS, 'utf8');

/** Body of a block that starts at `startMarker`, ending at its matching close. */
function blockAfter(startMarker, endMarker = null) {
  const start = source.indexOf(startMarker);
  assert.notStrictEqual(start, -1, `marker not found: ${startMarker}`);
  if (endMarker) {
    const end = source.indexOf(endMarker, start);
    assert.notStrictEqual(end, -1, `end marker not found: ${endMarker}`);
    return source.slice(start, end);
  }
  return source.slice(start, start + 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('P3 — no step-0 short-circuit hard-returns any more', () => {
  it('the existing-project one-shot full-rewrite branch is GONE', () => {
    // It rewrote every file from a context dump, bypassed the guarded tool
    // path, and reported `done` with zero verification.
    assert.strictEqual(
      source.includes('callScaffoldLLM(editPrompt'),
      false,
      'one-shot full-rewrite call was reintroduced'
    );
    assert.strictEqual(
      source.includes('extractFiles(rawEditResp)'),
      false,
      'one-shot full-rewrite parsing was reintroduced'
    );
    assert.strictEqual(
      source.includes('Iterative Code Modification Engine'),
      false,
      'the dead one-shot block header is back'
    );
  });

  it('the greenfield branch returns only when the scaffold is verified', () => {
    const branch = blockAfter(
      '// Greenfield Full-Stack Project Generator',
      '// ── Existing-Project Modification (P3: real ReAct'
    );

    // The only `return` allowed inside the greenfield branch is the verified one.
    assert.match(branch, /if \(toolResult\.verified\)/,
      'greenfield must gate its return on real verification');

    const verifiedReturnIdx = branch.indexOf('if (toolResult.verified)');
    const unverifiedContinueIdx = branch.indexOf('continue;', verifiedReturnIdx);
    assert.ok(unverifiedContinueIdx > verifiedReturnIdx,
      'an unverified scaffold must fall through into the ReAct loop');

    assert.match(branch, /project was scaffolded but it does NOT pass verification/,
      'the unverified path must tell the model what actually failed');
  });

  it('an unverified scaffold never marks the plan completed', () => {
    const branch = blockAfter(
      '// Greenfield Full-Stack Project Generator',
      '// ── Existing-Project Modification (P3: real ReAct'
    );
    // `plan.tasks.forEach(t => t.status = 'completed')` must live inside the
    // verified branch only — assert it appears after the verified gate.
    const verifiedGate = branch.indexOf('if (toolResult.verified)');
    const completeCalls = [];
    let idx = branch.indexOf("t.status = 'completed'");
    while (idx !== -1) {
      completeCalls.push(idx);
      idx = branch.indexOf("t.status = 'completed'", idx + 1);
    }
    assert.ok(completeCalls.length > 0, 'expected the plan to be completed somewhere');
    for (const c of completeCalls) {
      assert.ok(c > verifiedGate,
        'plan tasks must not be marked completed outside the verified branch');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P3 — a provider error is never an answer', () => {
  it('the FINAL_ANSWER text fallback cannot swallow a provider error', () => {
    // `parseLLMAction` ends with `return { … action: 'FINAL_ANSWER', answer: raw }`.
    // The guard must therefore run BEFORE any JSON/text parsing, not after it.
    const guardIdx = source.indexOf('action: PROVIDER_ERROR_ACTION');
    const fallbackIdx = source.indexOf("action: 'FINAL_ANSWER', answer: raw");

    assert.ok(guardIdx > -1, 'parseLLMAction must have a PROVIDER_ERROR_ACTION guard');
    assert.ok(fallbackIdx > -1, 'the raw-text FINAL_ANSWER fallback is expected to still exist');
    assert.ok(guardIdx < fallbackIdx,
      'the provider-error guard must run before the raw-text fallback');
  });

  it('the loop aborts honestly instead of looping on a dead provider', () => {
    assert.match(source, /Every configured model provider is failing/,
      'must surface a real provider failure to the user');
    assert.match(source, /Run aborted — no model provider is available/,
      'must not report a completed run when no provider works');
  });

  it('provider failure is tracked, not silently retried forever', () => {
    assert.match(source, /const providerErrors = \[\]/);
    assert.match(source, /providerErrors\.length <= 2/,
      'consecutive provider failures must be bounded');
  });

  it('callLLM uses the shared error detector rather than its own list', () => {
    assert.match(source, /const isErrorResp = isProviderErrorResponse;/,
      'callLLM must share the single provider-error detector');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P3 — verification is gated on the run outcome', () => {
  it('FINAL_ANSWER runs the evidence gate before completing', () => {
    const finalAnswer = blockAfter("if (parsed.action === 'FINAL_ANSWER')");
    assert.match(finalAnswer, /verifyRunOutcome\(/,
      'FINAL_ANSWER must not report success without evidence');
    assert.match(finalAnswer, /verified: outcome\.verified/,
      'the done event must carry the real verified flag');
  });

  it('an unverified outcome does not mark plan tasks completed', () => {
    const finalAnswer = blockAfter("if (parsed.action === 'FINAL_ANSWER')");
    const gateIdx = finalAnswer.indexOf('verifyRunOutcome(');
    const completedIdx = finalAnswer.indexOf("t.status = 'completed'");
    assert.ok(completedIdx > gateIdx,
      'task completion must be decided by the gate, not before it');
  });

  it('the loop-exhaustion path also gathers evidence', () => {
    const tail = source.slice(source.indexOf('P1 + P3: an exhausted loop is NOT a success'));
    assert.ok(tail.includes('verifyRunOutcome('),
      'an exhausted run must still report what state the project is in');
  });

  it('changed files are tracked so the gate knows there is something to build', () => {
    assert.match(source, /const runChangedFiles = new Set\(\)/);
    assert.match(source, /runChangedFiles\.add\(changedPath\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P3 — the step budget is real and clamped', () => {
  it('MAX_STEPS comes from the request with a hard bound', () => {
    assert.match(source, /const MAX_STEPS = requestedMaxSteps \?\? 50;/);
    assert.match(source, /Math\.max\(1, Math\.min\(100, Math\.floor\(Number\(req\.body\.maxSteps\)\)\)\)/,
      'maxSteps must be clamped so a client cannot request an unbounded loop');
  });

  it('repair attempts are clamped too', () => {
    assert.match(source, /Math\.max\(0, Math\.min\(5, Math\.floor\(Number\(req\.body\.maxRepairAttempts\)\)\)\)/);
  });

  it('the budget is advertised to the client, not just logged', () => {
    const started = blockAfter("type: 'run_started'");
    assert.match(started, /budget: \{ maxSteps:/,
      'run_started must carry the budget so the UI meter is honest');
    assert.match(started, /context: contextStats/,
      'run_started must carry retrieval stats');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P3 — a repaired manifest forces a dependency re-install', () => {
  it('the repair loop re-installs when package.json is rewritten', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'routes', 'agent.js'), 'utf8');
    assert.match(src, /projectRepair\.manifestChanged\(written\)/,
      'the repair loop must ask whether the dependency manifest changed');
    assert.match(src, /package\.json changed — re-installing dependencies before the next build/);
    assert.match(src, /runtimeBridge\.installDependencies\(dir/,
      'it must actually re-install, not just log');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P3 — the gate reports UNVERIFIED honestly', () => {
  it('verifyRunOutcome skips when there is nothing to build', () => {
    const fn = blockAfter('async function verifyRunOutcome');
    assert.match(fn, /no code files were changed, so there is nothing to build or run/);
    assert.match(fn, /skipped: true/);
  });

  it('verifyRunOutcome emits a structured verification event', () => {
    const fn = blockAfter('async function verifyRunOutcome');
    assert.match(fn, /type: 'verification'/);
    assert.match(fn, /describeVerification/);
  });

  it('a greenfield run that reaches FINAL_ANSWER unverified does not claim success', () => {
    const finalAnswer = blockAfter("if (parsed.action === 'FINAL_ANSWER')");
    assert.match(finalAnswer, /Not verified/,
      'the message must state plainly that it is unverified');
  });
});