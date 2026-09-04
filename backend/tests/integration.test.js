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

// ── Workflow Endpoints (Milestone 2 P8 Automations) ─────────────────────
test('GET /api/workflows -> 200 with workflows array', async () => {
  const { status, body } = await req('GET', '/api/workflows');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.workflows));
});

test('POST /api/workflows missing name or actionType -> 400', async () => {
  const { status, body } = await req('POST', '/api/workflows', { name: 'Test' });
  assert.equal(status, 400);
  assert.equal(body.success, false);
});

test('POST /api/workflows valid workflow -> 201 and lifecycle roundtrip', async () => {
  // 1. Create
  const { status: createStatus, body: createBody } = await req('POST', '/api/workflows', {
    name: 'CI Integration Test Watcher',
    description: 'Automated test watcher',
    triggerType: 'schedule',
    triggerConfig: { intervalMinutes: 60 },
    actionType: 'repo_health_check',
    actionConfig: { checks: ['git_status'] },
    notifyChannels: ['in_app']
  });
  assert.equal(createStatus, 201);
  assert.equal(createBody.success, true);
  assert.ok(createBody.workflow?.id);

  const wfId = createBody.workflow.id;

  // 2. Get details
  const { status: getStatus, body: getBody } = await req('GET', `/api/workflows/${wfId}`);
  assert.equal(getStatus, 200);
  assert.equal(getBody.workflow.name, 'CI Integration Test Watcher');
  assert.ok(Array.isArray(getBody.runs));

  // 3. Update status to paused
  const { status: updateStatus, body: updateBody } = await req('PUT', `/api/workflows/${wfId}`, {
    status: 'paused'
  });
  assert.equal(updateStatus, 200);
  assert.equal(updateBody.workflow.status, 'paused');

  // 4. Manual execution
  const { status: runStatus, body: runBody } = await req('POST', `/api/workflows/${wfId}/run`);
  assert.equal(runStatus, 200);
  assert.equal(runBody.success, true);
  assert.equal(runBody.run.status, 'success');

  // 5. Recent runs
  const { status: recentStatus, body: recentBody } = await req('GET', '/api/workflows/recent-runs');
  assert.equal(recentStatus, 200);
  assert.ok(Array.isArray(recentBody.runs));
  assert.ok(recentBody.runs.some(r => r.workflow_id === wfId));

  // 6. Delete
  const { status: delStatus } = await req('DELETE', `/api/workflows/${wfId}`);
  assert.equal(delStatus, 200);
});

// ── Sandbox Hardening, Health & Self-Test (P0.2) ─────────────────────────
test('GET /api/sandbox/health -> 200 with engine and resource quotas', async () => {
  const { status, body } = await req('GET', '/api/sandbox/health');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.engine);
  assert.ok(body.resourceQuotas);
  assert.equal(body.resourceQuotas.pidsLimit, 100);
});

test('POST /api/sandbox/test -> 200 with probe success', async () => {
  const { status, body } = await req('POST', '/api/sandbox/test');
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.probe, 'passed');
  assert.ok(typeof body.latencyMs === 'number');
});

test('POST /api/sandbox/create with local fallback -> 200 and lifecycle roundtrip', async () => {
  const { status, body } = await req('POST', '/api/sandbox/create', {
    projectId: 'ci-sandbox-test',
    options: { allowFallback: true }
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.ok(body.sandbox?.id);
  const sbId = body.sandbox.id;

  // File write
  const { status: writeStatus } = await req('POST', `/api/sandbox/${sbId}/files/write`, {
    filePath: 'test.js',
    content: 'console.log("hello sandbox");'
  });
  assert.equal(writeStatus, 200);

  // File read
  const { status: readStatus, body: readBody } = await req('GET', `/api/sandbox/${sbId}/files/read?path=test.js`);
  assert.equal(readStatus, 200);
  assert.equal(readBody.content, 'console.log("hello sandbox");');

  // Command exec
  const { status: execStatus, body: execBody } = await req('POST', `/api/sandbox/${sbId}/exec`, {
    command: 'node test.js'
  });
  assert.equal(execStatus, 200);
  assert.equal(execBody.success, true);
  assert.match(execBody.result.stdout, /hello sandbox/);

  // Destroy
  const { status: delStatus } = await req('DELETE', `/api/sandbox/${sbId}`);
  assert.equal(delStatus, 200);
});

// ── Verifier Endpoints (Milestone 4 / P0.3) ─────────────────────────────
test('GET /api/verify/health -> 200 OK with capabilities', async () => {
  const { status, body } = await req('GET', '/api/verify/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'OK');
  assert.equal(body.engine, 'ActionVerifier');
  assert.ok(Array.isArray(body.capabilities));
});

test('POST /api/verify/code -> verifies syntax and passes clean code', async () => {
  const { status, body } = await req('POST', '/api/verify/code', {
    filePath: 'index.js',
    code: 'const a = 10; const b = 20; console.log(a + b);'
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.result.valid, true);
  assert.equal(body.result.diagnostics.length, 0);
});

test('POST /api/verify/code -> detects syntax error and secret leak', async () => {
  const { status, body } = await req('POST', '/api/verify/code', {
    filePath: 'auth.js',
    code: 'const token = "AIzaSyDummySecretTokenForTesting123456";\nconst bad = {;'
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.result.valid, false);
  assert.equal(body.result.secretLeaks.length > 0, true);
});

test('POST /api/verify/document -> verifies CSV document integrity', async () => {
  const csvContent = Buffer.from('name,score,status\nAlice,100,pass\nBob,90,pass').toString('base64');
  const { status, body } = await req('POST', '/api/verify/document', {
    fileName: 'grades.csv',
    contentBase64: csvContent,
    fileType: 'csv'
  });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.result.valid, true);
  assert.equal(body.result.metadata.rowCount, 2);
});
