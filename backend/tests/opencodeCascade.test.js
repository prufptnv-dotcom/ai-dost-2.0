const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const OpenCodeService = require('../services/opencodeService');

/**
 * P10.1 — OpenCode free gateway provider + restored MoE failover.
 *
 * Everything runs against a local mock HTTP server that impersonates the
 * OpenCode API (state-file reuse makes ensureServer skip the real spawn), so
 * these tests are deterministic and network-free:
 *   POST /session {directory}                 -> {id}
 *   POST /session/:id/message {parts, model}  -> {info, parts[]}
 *   GET  /session                             -> []   (health probe)
 *
 * The wiring audit pins the routes/agent.js integration (callLLM position-3 +
 * scaffold last-resort entry + per-provider timeout) because that code only
 * runs inside a full agent run.
 */

const STATE_FILE = OpenCodeService._internals.STATE_FILE;
const SCRATCH_DIR = OpenCodeService._internals.SCRATCH_DIR;

let originalState = null;
const savedEnv = {};

function saveEnv(name) { savedEnv[name] = process.env[name]; }
function restoreEnv(name) {
  if (savedEnv[name] === undefined) delete process.env[name];
  else process.env[name] = savedEnv[name];
}

function saveStateFile() {
  try { originalState = fs.readFileSync(STATE_FILE, 'utf8'); } catch (_) { originalState = null; }
}
function restoreStateFile() {
  try {
    if (originalState === null) fs.rmSync(STATE_FILE, { force: true });
    else fs.writeFileSync(STATE_FILE, originalState);
  } catch (_) { /* best effort */ }
}

function writeState(baseUrl, password) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ baseUrl, password, pid: process.pid, startedAt: Date.now() }));
}

/**
 * Minimal OpenCode API impersonator. `handler` receives the parsed request and
 * the raw response object; requests carry a request log for assertions.
 */
function startMock(handler) {
  return new Promise((resolve) => {
    const requests = [];
    const expectedAuth = 'Basic ' + Buffer.from('opencode:mock-pw', 'utf8').toString('base64');
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        let body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch (_) { body = null; }
        const entry = { method: req.method, url: req.url, auth: req.headers.authorization || '', body, raw };
        requests.push(entry);
        if (entry.auth !== expectedAuth) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end('{"error":"unauthorized"}');
          return;
        }
        handler(entry, res, requests);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}`, requests, expectedAuth });
    });
  });
}

function okJson(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

describe('opencodeService (OpenCode free gateway)', () => {
  before(() => {
    saveEnv('OPENCODE_ENABLED');
    saveEnv('OPENCODE_BIN');
    saveEnv('OPENCODE_MODEL');
    saveEnv('OPENCODE_TIMEOUT_MS');
    // Enabled + no spawn risk: binary exists (node) + state-file reuse points
    // at each test's mock server.
    process.env.OPENCODE_BIN = process.execPath;
    delete process.env.OPENCODE_ENABLED;
    saveStateFile();
  });

  after(() => {
    restoreEnv('OPENCODE_ENABLED');
    restoreEnv('OPENCODE_BIN');
    restoreEnv('OPENCODE_MODEL');
    restoreEnv('OPENCODE_TIMEOUT_MS');
    restoreStateFile();
    OpenCodeService._resetForTests();
  });

  afterEach(() => {
    OpenCodeService._resetForTests();
  });

  it('parseModel accepts provider/model and rejects malformed specs', () => {
    const { parseModel } = OpenCodeService._internals;
    assert.deepStrictEqual(parseModel('opencode/mimo-v2.6-flash-free'), {
      providerID: 'opencode',
      modelID: 'mimo-v2.6-flash-free',
    });
    assert.throws(() => parseModel('noslash'), /invalid model spec/);
    assert.throws(() => parseModel('/leading'), /invalid model spec/);
    assert.throws(() => parseModel('trailing/'), /invalid model spec/);
    // Default (no arg, no env) resolves to the known free gateway model.
    assert.strictEqual(parseModel(null).providerID, 'opencode');
  });

  it('formatHistory renders bounded transcript lines', () => {
    const { formatHistory } = OpenCodeService._internals;
    assert.strictEqual(formatHistory([]), '');
    assert.strictEqual(formatHistory(undefined), '');
    const out = formatHistory([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 42 }, // non-string content is tolerated
    ]);
    assert.match(out, /USER: hi\nASSISTANT: hello\nUSER: \n\n$/);
    // Only the last 8 entries are ever included.
    const many = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `m${i}` }));
    assert.ok(!formatHistory(many).includes('m0\n') || formatHistory(many).indexOf('m12') >= 0);
    assert.ok(formatHistory(many).split('\n').length <= 10);
  });

  it('assertSafeArgs rejects command-line metacharacters (Windows P0 rule)', () => {
    const { assertSafeArgs } = OpenCodeService._internals;
    assert.doesNotThrow(() => assertSafeArgs(['serve', '--port', '4789', 'abc-def_1.2']));
    assert.throws(() => assertSafeArgs(['ok', 'x & calc']), /unsafe spawn arg/);
    assert.throws(() => assertSafeArgs(['a\nb']), /unsafe spawn arg/);
    assert.throws(() => assertSafeArgs(['$(whoami)']), /unsafe spawn arg/);
  });

  it('isAvailable honors OPENCODE_ENABLED=false', () => {
    assert.strictEqual(OpenCodeService.isAvailable(), true);
    process.env.OPENCODE_ENABLED = 'false';
    try {
      assert.strictEqual(OpenCodeService.isAvailable(), false);
      assert.strictEqual(OpenCodeService._internals.isEnabled(), false);
    } finally {
      delete process.env.OPENCODE_ENABLED;
    }
  });

  it('chat() drives the full API contract: create session (scratch dir) → message → text parts', async () => {
    const mock = await startMock((req, res) => {
      if (req.method === 'GET' && req.url === '/session') return okJson(res, []);
      if (req.method === 'POST' && req.url === '/session') {
        return okJson(res, { id: 'ses_mock_1', directory: req.body.directory });
      }
      if (req.method === 'POST' && req.url === '/session/ses_mock_1/message') {
        return okJson(res, {
          info: { finish: 'stop', role: 'assistant', modelID: 'mimo-v2.6-flash-free', providerID: 'opencode' },
          parts: [
            { type: 'step-start', id: 'p1' },
            { type: 'text', text: 'MOCK_REPLY ' },
            { type: 'text', text: 'OK' },
            { type: 'step-finish', reason: 'stop' },
          ],
        });
      }
      if (req.method === 'DELETE' && req.url === '/session/ses_mock_1') {
        res.writeHead(204); return res.end();
      }
      return okJson(res, { error: 'not found' }, 404);
    });
    writeState(mock.baseUrl, 'mock-pw');
    OpenCodeService._resetForTests();

    try {
      const reply = await OpenCodeService.chat('say it', [{ role: 'user', content: 'ctx' }], 'agent');
      assert.strictEqual(reply, 'MOCK_REPLY OK');

      const create = mock.requests.find((r) => r.method === 'POST' && r.url === '/session');
      assert.ok(create, 'session create called');
      assert.strictEqual(create.body.directory, SCRATCH_DIR, 'sessions must run in the scratch dir, never the repo');
      assert.match(SCRATCH_DIR, /aidost-opencode-gen/);

      const msg = mock.requests.find((r) => r.url === '/session/ses_mock_1/message');
      assert.ok(msg, 'message called');
      assert.strictEqual(msg.body.agent, 'build');
      assert.strictEqual(msg.body.mode, 'primary');
      assert.strictEqual(msg.body.model.providerID, 'opencode');
      assert.strictEqual(msg.body.model.modelID, 'mimo-v2.6-flash-free');
      assert.match(msg.body.parts[0].text, /^USER: ctx\n\nsay it$/, 'history is prepended to the prompt');
      assert.strictEqual(msg.auth, mock.expectedAuth, 'basic auth sent');
    } finally {
      mock.server.close();
    }
  });

  it('chat() surfaces HTTP failures as thrown errors (cascade moves on)', async () => {
    const mock = await startMock((req, res) => {
      if (req.method === 'GET' && req.url === '/session') return okJson(res, []);
      if (req.method === 'POST' && req.url === '/session') return okJson(res, { id: 'ses_mock_2' });
      return okJson(res, { error: 'boom' }, 500);
    });
    writeState(mock.baseUrl, 'mock-pw');
    OpenCodeService._resetForTests();
    try {
      await assert.rejects(() => OpenCodeService.chat('hello'), /HTTP 500/);
    } finally {
      mock.server.close();
    }
  });

  it('chat() rejects an empty reply (never silently "succeeds")', async () => {
    const mock = await startMock((req, res) => {
      if (req.method === 'GET' && req.url === '/session') return okJson(res, []);
      if (req.method === 'POST' && req.url === '/session') return okJson(res, { id: 'ses_mock_3' });
      if (req.method === 'POST' && req.url === '/session/ses_mock_3/message') {
        return okJson(res, { info: { finish: 'error' }, parts: [{ type: 'step-start' }] });
      }
      return okJson(res, {}, 404);
    });
    writeState(mock.baseUrl, 'mock-pw');
    OpenCodeService._resetForTests();
    try {
      await assert.rejects(() => OpenCodeService.chat('hello'), /empty reply \(finish=error\)/);
    } finally {
      mock.server.close();
    }
  });

  it('chat() honors options.timeoutMs (hung server cannot wedge a cascade)', async () => {
    const mock = await startMock((req, res) => {
      if (req.method === 'GET' && req.url === '/session') return okJson(res, []);
      if (req.method === 'POST' && req.url === '/session') return okJson(res, { id: 'ses_mock_4' });
      if (req.method === 'POST' && req.url === '/session/ses_mock_4/message') {
        setTimeout(() => { try { okJson(res, { info: {}, parts: [] }); } catch (_) {} }, 5000);
        return;
      }
      return okJson(res, {}, 404);
    });
    writeState(mock.baseUrl, 'mock-pw');
    OpenCodeService._resetForTests();
    try {
      const t0 = Date.now();
      await assert.rejects(() => OpenCodeService.chat('hello', [], 'agent', null, { timeoutMs: 300 }));
      assert.ok(Date.now() - t0 < 2500, 'must abort near timeoutMs, not wait for the mock');
    } finally {
      mock.server.close();
    }
  });
});

describe('llmCascade.executeCascadingFailover (restored MoE contract)', () => {
  before(() => {
    saveEnv('OPENCODE_ENABLED');
    saveEnv('OPENCODE_BIN');
    process.env.OPENCODE_BIN = process.execPath;
    delete process.env.OPENCODE_ENABLED;
    // Guarantee no keyed provider is eligible: these tests must never hit the network.
    for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY']) {
      saveEnv(k);
      delete process.env[k];
    }
    saveStateFile();
  });

  after(() => {
    restoreEnv('OPENCODE_ENABLED');
    restoreEnv('OPENCODE_BIN');
    for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY']) restoreEnv(k);
    restoreStateFile();
    OpenCodeService._resetForTests();
  });

  it('is exported (moeRouterService destructures it — was undefined → TypeError)', () => {
    const cascade = require('../services/llmCascade');
    assert.strictEqual(typeof cascade.executeCascadingFailover, 'function');
    assert.strictEqual(typeof cascade.callLLM, 'function');
    // The exact import shape moeRouterService uses must resolve to a function:
    const { executeCascadingFailover } = require('../services/llmCascade');
    assert.strictEqual(typeof executeCascadingFailover, 'function');
  });

  it('returns a STRING and lands on OpenCode when every keyed provider is ineligible', async () => {
    const mock = await startMock((req, res) => {
      if (req.method === 'GET' && req.url === '/session') return okJson(res, []);
      if (req.method === 'POST' && req.url === '/session') return okJson(res, { id: 'ses_moe' });
      if (req.method === 'POST' && req.url === '/session/ses_moe/message') {
        return okJson(res, {
          info: { finish: 'stop' },
          parts: [{ type: 'text', text: 'FAILOVER_REPLY via OpenCode' }],
        });
      }
      return okJson(res, {}, 404);
    });
    writeState(mock.baseUrl, 'mock-pw');
    OpenCodeService._resetForTests();
    try {
      const { executeCascadingFailover } = require('../services/llmCascade');
      const out = await executeCascadingFailover(
        'general conversation prompt',
        'general conversation prompt',
        [{ role: 'user', content: 'x' }],
        null,
        'chat',
        null
      );
      assert.strictEqual(typeof out, 'string', 'MoE expects a raw string (calls .match on it)');
      assert.strictEqual(out, 'FAILOVER_REPLY via OpenCode');
      const msg = mock.requests.find((r) => r.method === 'POST' && r.url.includes('/message'));
      assert.ok(msg, 'OpenCode message actually sent');
    } finally {
      mock.server.close();
    }
  });

  it('degrades to the honest unavailable message when no tier can answer', async () => {
    // Break OpenCode (state points nowhere) and keep keyed providers off.
    writeState('http://127.0.0.1:1', 'wrong'); // closed port → probe/spawn fails fast
    OpenCodeService._resetForTests();
    const { executeCascadingFailover } = require('../services/llmCascade');
    const out = await executeCascadingFailover('hi', 'hi', [], null, 'chat', null);
    assert.strictEqual(typeof out, 'string');
    assert.match(out, /Sabhi AI providers temporarily unavailable/);
  });
});

describe('routes/agent.js wiring (P10.1 static audit)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'agent.js'), 'utf8');

  it('callLLM offers OpenCode as a preferred-able provider (key: opencode, position 3)', () => {
    assert.match(src, /\{\s*key:\s*'opencode',\s*name:\s*'OpenCode \(free gateway\)'[^}]*OpenCodeService\.chat\(agentPrompt/);
    // Position: after gemini, before nvidia (a keyless/rate-limited install reaches it early).
    const oc = src.indexOf("key: 'opencode'");
    const gem = src.indexOf("key: 'gemini'");
    const nvi = src.indexOf("key: 'nvidia'");
    assert.ok(oc > gem && oc < nvi, 'opencode sits between gemini and nvidia');
    // preferredModel rotation works via the generic findKey branch:
    assert.match(src, /providers\.findIndex\(p => p\.key === preferredModel\)/);
  });

  it('callScaffoldLLM appends OpenCode last-resort with its own timeout', () => {
    assert.match(src, /OpenCodeService\.isAvailable\(\)/);
    assert.match(src, /name:\s*'OpenCode \(free gateway\)'[\s\S]{0,400}?timeoutMs:\s*50000/);
    assert.match(src, /OpenCodeService\.chat\(scaffoldPrompt, \[\], 'agent', null, \{\s*timeoutMs:\s*45000\s*\}\)/);
    // The race honors per-provider budgets (fast providers keep 12s):
    assert.match(src, /withProviderTimeout\(provider\.fn\(\), provider\.timeoutMs \|\| 12000\)/);
  });

  it('requires the service exactly once with the canonical path', () => {
    const requires = src.match(/require\('\.\.\/services\/opencodeService'\)/g) || [];
    assert.strictEqual(requires.length, 1);
  });
});
