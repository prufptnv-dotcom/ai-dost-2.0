/**
 * AI-Dost Backend Integration Tests (node:test, zero external LLM calls)
 *
 * Boots the real Express app on an ephemeral port and verifies the HTTP
 * contract: status codes, error envelopes, deterministic routes only.
 * LLM-dependent routes (chat reply, agent run, eval run) are covered by
 * their own live harness scripts (tests/eval_harness.js etc.).
 *
 * Run: node --test tests/integration.test.js  (or: npm run test:integration)
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, server, db } = require('../server.js');

let base = '';

before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  try { server.close(); } catch {}
  try { db.close(); } catch {}
});

/** Minimal fetch helper returning { status, body } */
async function req(method, path, body) {
  const hasBody = body !== undefined && body !== null;
  const res = await fetch(base + path, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : {},
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try { parsed = await res.json(); } catch {}
  return { status: res.status, body: parsed, raw: res };
}

// ── Health & system ─────────────────────────────────────────────────────
test('GET /health -> 200 OK', async () => {
  const { status, body } = await req('GET', '/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'OK');
  assert.ok(body.timestamp);
});

test('GET /api/circuit-breaker -> 200 alias (circuitBreakers map)', async () => {
  const { status, body } = await req('GET', '/api/circuit-breaker');
  assert.equal(status, 200);
  assert.ok(body.circuitBreakers, 'should expose circuitBreakers map');
  assert.ok(Object.keys(body.circuitBreakers).length >= 1);
});

test('GET /api/quota-status -> 200 alias (circuitBreakers map)', async () => {
  const { status, body } = await req('GET', '/api/quota-status');
  assert.equal(status, 200);
  assert.ok(body.circuitBreakers, 'should expose circuitBreakers map');
});

// ── Error envelope ──────────────────────────────────────────────────────
test('unknown /api route -> 404 Endpoint not found', async () => {
  const { status, body } = await req('GET', '/api/does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.error, 'Endpoint not found');
});

test('malformed JSON body -> 400 BAD_JSON envelope', async () => {
  const res = await fetch(base + '/api/chat/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not valid json',
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.code, 'BAD_JSON');
});

// ── Chat ────────────────────────────────────────────────────────────────
test('POST /api/chat/ empty message -> 400 MISSING_MESSAGE', async () => {
  const { status, body } = await req('POST', '/api/chat/', { message: '   ' });
  assert.equal(status, 400);
  assert.equal(body.code, 'MISSING_MESSAGE');
});

test('GET /api/chat/history -> 200 (session list, no LLM)', async () => {
  const { status, body } = await req('GET', '/api/chat/history');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.messages));
});

test('POST /api/chat/save + GET round-trips messages (no LLM)', async () => {
  const { status } = await req('POST', '/api/chat/save', {
    session_id: 'test-session',
    messages: [{ role: 'user', content: 'integration test message' }],
  });
  assert.equal(status, 200);
  const { body } = await req('GET', '/api/chat/history?session_id=test-session');
  assert.ok(body.messages.some((m) => m.content === 'integration test message'));
});

// ── Agent ───────────────────────────────────────────────────────────────
test('POST /api/agent/plan empty prompt -> 400', async () => {
  const { status } = await req('POST', '/api/agent/plan', { userPrompt: '' });
  assert.equal(status, 400);
});

test('GET /api/agent/tasks -> 200 { success, tasks }', async () => {
  const { status, body } = await req('GET', '/api/agent/tasks');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.tasks));
});

// ── Eval harness ────────────────────────────────────────────────────────
test('GET /api/eval/status -> 200 with 5 scenarios', async () => {
  const { status, body } = await req('GET', '/api/eval/status');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.scenariosAvailable, 5);
});

test('POST /api/eval unknown scenario id -> 400', async () => {
  const { status, body } = await req('POST', '/api/eval', { scenarios: ['nope'] });
  assert.equal(status, 400);
  assert.match(body.error || '', /Unknown scenario/i);
});

// ── Documents ───────────────────────────────────────────────────────────
test('POST /api/document/generate bad type -> 400', async () => {
  const { status, body } = await req('POST', '/api/document/generate', { type: 'bogus', topic: 'x' });
  assert.equal(status, 400);
  assert.match(body.error || '', /docx|pptx|csv|pdf|xlsx/i);
});

test('POST /api/document/generate missing topic -> 400', async () => {
  const { status } = await req('POST', '/api/document/generate', { type: 'csv' });
  assert.equal(status, 400);
});

// ── Figma ───────────────────────────────────────────────────────────────
test('GET /api/figma/health without key -> 503 FIGMA_NO_KEY or 200', async () => {
  const { status } = await req('GET', '/api/figma/health');
  assert.ok(status === 503 || status === 200, `got ${status}`);
  if (status === 503) {
    const { body } = await req('GET', '/api/figma/health');
    assert.equal(body.code, 'FIGMA_NO_KEY');
  }
});

// ── Deploy ──────────────────────────────────────────────────────────────
test('GET /api/deploy/targets -> 200 with vercel/netlify/cloudflare/static', async () => {
  const { status, body } = await req('GET', '/api/deploy/targets');
  assert.equal(status, 200);
  const names = (body.targets || []).map((t) => String(t.id || t.name || t).toLowerCase());
  for (const expect of ['vercel', 'netlify', 'cloudflare', 'static']) {
    assert.ok(names.some((n) => n.includes(expect)), `missing target: ${expect}`);
  }
});

// ── Sandbox ─────────────────────────────────────────────────────────────
test('GET /api/sandbox unknown id -> 404', async () => {
  const { status } = await req('GET', '/api/sandbox/does-not-exist');
  assert.equal(status, 404);
});

test('POST /api/sandbox/:id/exec unknown id -> 404', async () => {
  const { status } = await req('POST', '/api/sandbox/does-not-exist/exec', { command: 'ls' });
  assert.equal(status, 404);
});

test('GET /api/sandbox files unknown id -> 404', async () => {
  const { status } = await req('GET', '/api/sandbox/does-not-exist/files/read?path=app.js');
  assert.equal(status, 404);
});

// ── JSON body parsing round-trip ────────────────────────────────────────
test('deep JSON body parses correctly (chat validation fires, not parser)', async () => {
  const { status, body } = await req('POST', '/api/chat/', { message: 'hi', history: [{ role: 'user', content: 'x' }] });
  // No key -> cascade may 500/503 or reply; anything but BAD_JSON proves parser OK.
  assert.notEqual(body && body.code, 'BAD_JSON');
  assert.ok(status === 400 || status === 200 || status === 500 || status === 503);
});

// ── Static file serving ─────────────────────────────────────────────────
test('GET / redirects to frontend (FRONTEND_URL)', async () => {
  const res = await fetch(base + '/', { redirect: 'manual' });
  assert.equal(res.status, 302);
  const loc = res.headers.get('location') || '';
  assert.match(loc, /localhost:\d+/);
  await res.body?.cancel?.();
});

// ── Copilot Agent Diffs, Rollback & Revert ───────────────────────────────
test('GET /api/agent/run-diffs missing runId -> 400', async () => {
  const { status, body } = await req('GET', '/api/agent/run-diffs');
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('GET /api/agent/run-diffs unknown runId -> 200 with empty diffs', async () => {
  const { status, body } = await req('GET', '/api/agent/run-diffs?runId=unknown-run-123');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.diffs, []);
});

test('POST /api/agent/rollback missing checkpoint -> 400', async () => {
  const { status, body } = await req('POST', '/api/agent/rollback', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/agent/rollback valid empty checkpoint -> 200', async () => {
  const { status, body } = await req('POST', '/api/agent/rollback', {
    checkpoint: { files: [] },
    projectId: 'test-project'
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.restoredFiles, 0);
});

test('POST /api/agent/revert-file missing parameters -> 400', async () => {
  const { status } = await req('POST', '/api/agent/revert-file', { runId: 'test-run' });
  assert.equal(status, 400);
});

test('POST /api/agent/revert-all missing runId -> 400', async () => {
  const { status } = await req('POST', '/api/agent/revert-all', {});
  assert.equal(status, 400);
});

test('POST /api/agent/rag-sync -> responds with success or warning', async () => {
  const { status, body } = await req('POST', '/api/agent/rag-sync', { directory: 'test-workspace' });
  assert.equal(status, 200);
  assert.ok(body.success !== undefined);
});

// ── Resume Endpoints (Validation & Error Handling) ───────────────────────
test('POST /api/v1/resume/regenerate-section missing body -> 400', async () => {
  const { status, body } = await req('POST', '/api/v1/resume/regenerate-section', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/v1/resume/ats-analyze missing resumeData or jobDescription -> 400', async () => {
  const { status, body } = await req('POST', '/api/v1/resume/ats-analyze', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

test('POST /api/v1/resume/auto-tailor missing resumeData or jobDescription -> 400', async () => {
  const { status, body } = await req('POST', '/api/v1/resume/auto-tailor', {});
  assert.equal(status, 400);
  assert.ok(body.error);
});

