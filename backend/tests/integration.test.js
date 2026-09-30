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
const { app, server, db, io } = require('../server.js');
const { getWorkflowEngine } = require('../services/workflowEngine');
const cacheService = require('../services/cacheService');

let base = '';

before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try { getWorkflowEngine()?.stop(); } catch {}
  try { io?.close(); } catch {}
  // Drop keep-alive sockets from fetch so server.close() can finish
  try { server.closeAllConnections?.(); } catch {}
  await new Promise((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 2000);
  });
  try { cacheService.redis?.disconnect(); } catch {}
  try { db.close(); } catch {}
});

/** Minimal fetch helper returning { status, body } */
async function req(method, path, body, headers = {}) {
  const hasBody = body !== undefined && body !== null;
  const res = await fetch(base + path, {
    method,
    headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...headers },
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
  const { status, body: saveBody } = await req('POST', '/api/chat/save', {
    session_id: 'test-session',
    messages: [{ role: 'user', content: 'integration test message' }],
  });
  if (status !== 200) console.log("SAVE ERROR:", saveBody);
  assert.equal(status, 200, JSON.stringify(saveBody));
  const { body } = await req('GET', '/api/chat/history?session_id=test-session');
  assert.ok(body.messages.some((m) => m.content === 'integration test message'));
});

// ── P1 #12/#13: identity + conversation ownership ─────────────────────────
// The test client connects from loopback, which Express trusts as a proxy
// (trust proxy = 'loopback'), so an X-Forwarded-For header here simulates a
// request forwarded by the Next.js proxy from a LAN/remote browser — exactly
// how identity is derived in production. Direct (non-loopback) clients'
// XFF is ignored by Express and cannot spoof (verified live: BUG_REPORT #11-#14).
const ANON_XFF = { 'X-Forwarded-For': '10.99.88.77' };

test('P1#12 anonIdentity mints an ad_uid cookie on API responses', async () => {
  const { raw } = await req('GET', '/health');
  const setCookie = raw.headers.get('set-cookie') || '';
  assert.match(setCookie, /ad_uid=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.match(setCookie, /HttpOnly/i);
});

test('P1#13 conversation ownership: proxied non-local identity is isolated', async () => {
  const sid = `p13_it_${Date.now()}`;

  // Local caller (no XFF → loopback → local-user) saves
  const save = await req('POST', '/api/chat/save', {
    session_id: sid,
    messages: [{ role: 'user', content: 'local-only-secret' }],
  });
  assert.equal(save.status, 200, JSON.stringify(save.body));

  // Non-local identity (XFF from trusted loopback = forwarded by proxy) → 403
  const anonRead = await req('GET', `/api/chat/history?session_id=${sid}`, undefined, ANON_XFF);
  assert.equal(anonRead.status, 403);

  // Non-local identity cannot delete the conversation
  const anonDelete = await req('DELETE', `/api/chat/history?session_id=${sid}`, undefined, ANON_XFF);
  assert.equal(anonDelete.status, 403);

  // Local caller still reads it (legacy continuity)
  const localRead = await req('GET', `/api/chat/history?session_id=${sid}`);
  assert.equal(localRead.status, 200);
  assert.ok(localRead.body.messages.some((m) => m.content === 'local-only-secret'));

  // 'all' listing: non-local identity sees no local content
  const anonAll = await req('GET', '/api/chat/history?session_id=all', undefined, ANON_XFF);
  assert.equal(anonAll.status, 200);
  assert.ok(!JSON.stringify(anonAll.body).includes('local-only-secret'),
    "anon 'all' listing must not leak local-user messages");

  // Local caller owns it → cleanup
  const del = await req('DELETE', `/api/chat/history?session_id=${sid}`);
  assert.equal(del.status, 200);
});

test('P1#12 assessment history identity: loopback=local-user, XFF=anon-<uuid>', async () => {
  const local = await req('GET', '/api/assessment/history');
  assert.equal(local.status, 200);
  assert.equal(local.body.userId, 'local-user');

  const anon = await req('GET', '/api/assessment/history', undefined, ANON_XFF);
  assert.equal(anon.status, 200);
  assert.match(anon.body.userId, /^anon-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
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

test('POST /api/agent/heal missing parameters -> 400', async () => {
  const { status, body } = await req('POST', '/api/agent/heal', {});
  assert.equal(status, 400);
  assert.ok(body.error);
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
  assert.equal(body.resourceQuotas.pidsLimit, 512);
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

// ── P2 #15/#16/#17: database routes (containment, HMAC approval, handles) ────
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const p2DestructivePlan = {
  engine: 'sqlite',
  tables: [{ name: 'p2_users', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }],
  destructiveOperations: ['DROP TABLE legacy_users'],
};

test('P2 #15: migration/apply dbPath outside allowed roots -> 400 DBPATH_FORBIDDEN', async () => {
  const { status, body } = await req('POST', '/api/database/migration/apply', {
    plan: { engine: 'sqlite', tables: [{ name: 'p2_t', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }] },
    dbPath: path.join(os.homedir(), 'p2-evil.db'),
  });
  assert.equal(status, 400);
  assert.equal(body.error?.code, 'DBPATH_FORBIDDEN');
});

test('P2 #16: migration/history dbPath outside allowed roots -> 400 DBPATH_FORBIDDEN', async () => {
  const outside = encodeURIComponent(path.join(os.homedir(), 'p2-evil.db'));
  const { status, body } = await req('GET', `/api/database/migration/history?dbPath=${outside}`);
  assert.equal(status, 400);
  assert.equal(body.error?.code, 'DBPATH_FORBIDDEN');
});

test('P2 #16: schema/drift dbPath outside allowed roots -> 400 DBPATH_FORBIDDEN', async () => {
  const outside = encodeURIComponent(path.join(os.homedir(), 'p2-evil.db'));
  const { status, body } = await req('GET', `/api/database/schema/drift?dbPath=${outside}`);
  assert.equal(status, 400);
  assert.equal(body.error?.code, 'DBPATH_FORBIDDEN');
});

test('P2 #15: destructive apply without/garbage token -> 403 + plan-bound approvalToken', async () => {
  const noToken = await req('POST', '/api/database/migration/apply', { plan: p2DestructivePlan });
  assert.equal(noToken.status, 403);
  assert.ok(noToken.body.approvalToken, '403 response must issue an approval token');

  const garbage = await req('POST', '/api/database/migration/apply', {
    plan: p2DestructivePlan,
    approvalToken: 'i-am-not-an-hmac',
  });
  assert.equal(garbage.status, 403, 'arbitrary non-empty token must be rejected');
});

test('P2 #15: dry-run issues token; apply accepts it and executes', async () => {
  const dry = await req('POST', '/api/database/migration/dry-run', { plan: p2DestructivePlan });
  assert.equal(dry.status, 200);
  assert.ok(dry.body.approvalToken, 'destructive dry-run must issue an approval token');

  const applied = await req('POST', '/api/database/migration/apply', {
    plan: p2DestructivePlan,
    approvalToken: dry.body.approvalToken,
  });
  assert.equal(applied.status, 200, JSON.stringify(applied.body));
  assert.equal(applied.body.success, true);
});

test('P2 #15: non-destructive apply succeeds without any token', async () => {
  const plan = {
    engine: 'sqlite',
    tables: [{ name: 'p2_plain', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }],
  };
  const { status, body } = await req('POST', '/api/database/migration/apply', { plan });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
});

test('P2 #17: query endpoint gates SQL, opens read-only for SELECT, stays usable after errors', async () => {
  const workspaceManager = require('../services/workspaceManager');
  const wsDir = workspaceManager.getWorkspacePath('p2-db-query');
  fs.mkdirSync(wsDir, { recursive: true });
  const dbFile = path.join(wsDir, 'app.db');
  const { DatabaseSync } = require('node:sqlite');
  const setup = new DatabaseSync(dbFile);
  setup.exec('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
  setup.exec("INSERT INTO items(name) VALUES ('one')");
  setup.close();

  try {
    const ok = await req('POST', '/api/database/p2-db-query/query', { sql: 'SELECT name FROM items' });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.count, 1);

    const multi = await req('POST', '/api/database/p2-db-query/query', { sql: 'SELECT 1; DROP TABLE items' });
    assert.equal(multi.status, 400);

    const attach = await req('POST', '/api/database/p2-db-query/query', { sql: "ATTACH DATABASE 'x.db' AS x" });
    assert.equal(attach.status, 400);

    // Error path (old code returned 400 while leaking the read-write handle)
    const bad = await req('POST', '/api/database/p2-db-query/query', { sql: 'SELECT * FROM does_not_exist' });
    assert.equal(bad.status, 400);

    const again = await req('POST', '/api/database/p2-db-query/query', { sql: 'SELECT name FROM items' });
    assert.equal(again.status, 200, 'route must remain usable after a query error');
    assert.equal(again.body.count, 1);
  } finally {
    try { fs.rmSync(wsDir, { recursive: true, force: true }); } catch {}
  }
});

test('P2 #9: static deploy validate rejects targetDir outside allowed roots', async () => {
  const outside = await req('POST', '/api/deploy/validate', {
    target: 'static',
    options: { targetDir: path.join(os.homedir(), 'evil-static') },
  });
  assert.equal(outside.status, 200);
  assert.equal(outside.body.valid, false);

  const inside = await req('POST', '/api/deploy/validate', {
    target: 'static',
    options: { targetDir: path.join(os.tmpdir(), 'ai-dost-static-ok') },
  });
  assert.equal(inside.status, 200);
  assert.equal(inside.body.valid, true);
});
