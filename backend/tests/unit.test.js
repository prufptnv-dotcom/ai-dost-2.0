/**
 * AI-Dost Backend Unit Tests (node:test, zero network)
 *
 * Pure-logic units: agent LLM action parser, circuit breaker + rate limiter,
 * error normalization, sandbox path-traversal guard, codebase search RAG.
 *
 * Run: node --test tests/unit.test.js  (or: npm run test:unit)
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// ── Agent action parser ─────────────────────────────────────────────────
describe('agent.parseLLMAction', () => {
  const router = require('../routes/agent.js');
  const parse = router.parseLLMAction;

  test('parses clean JSON tool call', () => {
    const out = parse(JSON.stringify({ thought: 't', action: 'write_file', parameters: { path: 'a.js', content: 'x' } }));
    assert.equal(out.action, 'write_file');
    assert.equal(out.parameters.path, 'a.js');
  });

  test('extracts JSON from prose prefix/suffix', () => {
    const raw = `Sure! Let me help.\n{"thought":"fixing","action":"apply_diff","parameters":{"path":"app.js","search":"old","replace":"new"}}\nDone!`;
    const out = parse(raw);
    assert.equal(out.action, 'apply_diff');
    assert.equal(out.parameters.path, 'app.js');
  });

  test('fallback: prose-only -> FINAL_ANSWER with text', () => {
    const out = parse('I will run a terminal command now.');
    assert.equal(out.action, 'FINAL_ANSWER');
    assert.match(out.answer, /terminal command/i);
  });

  test('fallback: empty input -> FINAL_ANSWER', () => {
    const out = parse('');
    assert.equal(out.action, 'FINAL_ANSWER');
  });

  test('fallback: corrupted JSON -> FINAL_ANSWER', () => {
    const out = parse('{"thought": "x", "action": ');
    assert.equal(out.action, 'FINAL_ANSWER');
  });

  test('multi-line markdown code fence JSON still parses', () => {
    const raw = '```json\n{"thought":"t","action":"run_terminal","parameters":{"command":"npm test"}}\n```';
    const out = parse(raw);
    assert.equal(out.action, 'run_terminal');
    assert.equal(out.parameters.command, 'npm test');
  });

  test('preserves prompt and targetDir for project generation', () => {
    const raw = JSON.stringify({
      thought: 'generate the project',
      action: 'generate_project_from_prompt',
      parameters: { prompt: 'full stack todo app', targetDir: 'todo-app' }
    });
    const out = parse(raw);
    assert.equal(out.action, 'generate_project_from_prompt');
    assert.equal(out.parameters.prompt, 'full stack todo app');
    assert.equal(out.parameters.targetDir, 'todo-app');
  });

  test('normalizes sandbox parameter keys', () => {
    const raw = JSON.stringify({
      thought: 'create sandbox',
      action: 'sandbox_create',
      parameters: { project_id: 'p1' }
    });
    const out = parse(raw);
    assert.equal(out.parameters.projectId, 'p1');
  });

  test('falls back to user prompt variants', () => {
    const raw = JSON.stringify({
      thought: 'generate',
      action: 'generate_project_from_prompt',
      parameters: { description: 'a resume site' }
    });
    const out = parse(raw);
    assert.equal(out.parameters.prompt, 'a resume site');
  });
});

// ── RAG codebase search ─────────────────────────────────────────────────
describe('agent codebase RAG search', () => {
  const router = require('../routes/agent.js');
  const search = router.searchCodebase;

  const files = [
    { path: 'src/app.js', content: 'function add(a, b) { return a + b; }\nexport default add;\n' },
    { path: 'src/utils/calc.js', content: 'const multiply = (a,b) => a*b;\nmodule.exports = { multiply };\n' },
    { path: 'README.md', content: 'This project is a calculator.\n' },
  ];

  test('finds relevant file by query word', () => {
    const out = search('multiply', files);
    assert.equal(out.success, true);
    assert.ok(out.results.length >= 1, 'should return results');
    assert.ok(out.results[0].score > 0);
    assert.ok(out.results.some((r) => r.file.includes('calc.js')));
  });

  test('returns empty results for no match', () => {
    const out = search('zzzqqq', files);
    assert.equal(out.success, true);
    assert.deepEqual(out.results, []);
    assert.match(out.message || '', /No matching/i);
  });

  test('handles null/empty inputs without crashing', () => {
    const out = search(null, null);
    assert.equal(out.success, true);
    assert.deepEqual(out.results, []);
  });
});

// ── Circuit breaker / rate limiter / API client ─────────────────────────
describe('services/apiClient', () => {
  const { RobustApiClient, CircuitBreaker, RateLimiter } = require('../services/apiClient');

  test('CircuitBreaker starts CLOSED', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    assert.equal(cb.getState(), 'CLOSED');
  });

  test('CircuitBreaker opens after failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, timeout: 1000 });
    for (let i = 0; i < 3; i++) {
      try { await cb.execute(() => { throw new Error('fail'); }); } catch {}
    }
    assert.equal(cb.getState(), 'OPEN');
  });

  test('CircuitBreaker recovers through HALF_OPEN to CLOSED', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, successThreshold: 2, timeout: 50 });
    try { await cb.execute(() => { throw new Error('f'); }); } catch {}
    try { await cb.execute(() => { throw new Error('f'); }); } catch {}
    assert.equal(cb.getState(), 'OPEN');
    await new Promise((r) => setTimeout(r, 120));
    await cb.execute(() => 'ok');
    await cb.execute(() => 'ok');
    assert.equal(cb.getState(), 'CLOSED');
  });

  test('RateLimiter tracks used/remaining', async () => {
    const rl = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) await rl.acquire();
    const s = rl.getStatus();
    assert.equal(s.used, 5);
    assert.equal(s.remaining, 0);
  });

  test('RateLimiter queues over-limit requests', async () => {
    const rl = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
    const start = Date.now();
    await Promise.all([rl.acquire(), rl.acquire(), rl.acquire()]);
    assert.ok(Date.now() - start >= 900, 'third request should wait');
  });

  test('RateLimiter resets after window', async () => {
    const rl = new RateLimiter({ maxRequests: 2, windowMs: 100 });
    await rl.acquire();
    await rl.acquire();
    assert.equal(rl.getStatus().remaining, 0);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(rl.getStatus().remaining, 2);
  });

  test('RobustApiClient retries 429 with backoff then succeeds', async () => {
    let attempts = 0;
    const origFetch = global.fetch;
    global.fetch = async () => {
      attempts++;
      if (attempts < 3) return { ok: false, status: 429, text: async () => 'rate limited', headers: new Headers() };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }), headers: new Headers() };
    };
    try {
      const client = new RobustApiClient({ baseUrl: 'https://api.test', serviceName: 'T', maxRetries: 3, retryDelay: 10 });
      const res = await client.post('/chat', { message: 'hi' });
      assert.equal(res.success, true);
      assert.equal(attempts, 3);
    } finally {
      global.fetch = origFetch;
    }
  });

  test('RobustApiClient does not retry 4xx', async () => {
    const origFetch = global.fetch;
    let attempts = 0;
    global.fetch = async () => { attempts++; return { ok: false, status: 400, text: async () => 'bad', headers: new Headers() }; };
    try {
      const client = new RobustApiClient({ baseUrl: 'https://api.test', serviceName: 'T', maxRetries: 3 });
      await assert.rejects(() => client.post('/chat', { message: 'hi' }), (err) => err.status === 400 && !err.retryable);
      assert.equal(attempts, 1);
    } finally {
      global.fetch = origFetch;
    }
  });

  test('RobustApiClient trips circuit breaker on repeated failures', async () => {
    const origFetch = global.fetch;
    global.fetch = async () => { throw new Error('net down'); };
    try {
      const client = new RobustApiClient({ baseUrl: 'https://api.test', serviceName: 'T', maxRetries: 0, retryDelay: 10, circuitBreaker: { failureThreshold: 2, timeout: 1000 } });
      try { await client.post('/chat', { message: 'hi' }); } catch {}
      try { await client.post('/chat', { message: 'hi' }); } catch {}
      await assert.rejects(() => client.post('/chat', { message: 'hi' }), /[Cc]ircuit [Bb]reaker/);
    } finally {
      global.fetch = origFetch;
    }
  });
});

// ── Error normalization ─────────────────────────────────────────────────
describe('utils/errors', () => {
  const { AppError, toAppError, withTimeout, TimeoutError } = require('../utils/errors');

  test('AppError carries status + code', () => {
    const e = new AppError('teapot', 418, 'TEAPOT');
    assert.equal(e.status, 418);
    assert.equal(e.code, 'TEAPOT');
    assert.equal(e.message, 'teapot');
  });

  test('toAppError wraps unknown errors as 500', () => {
    const out = toAppError(new Error('boom'));
    assert.equal(out.status, 500);
    assert.ok(out.code);
  });

  test('withTimeout rejects with TimeoutError on timeout', async () => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 50),
      (err) => err instanceof TimeoutError
    );
  });

  test('withTimeout resolves on fast promise', async () => {
    const v = await withTimeout(Promise.resolve(42), 1000);
    assert.equal(v, 42);
  });
});

// ── Sandbox path traversal guard ────────────────────────────────────────
describe('sandboxManager path safety', () => {
  const sandboxManager = require('../sandbox/sandboxManager');

  test('rejects path traversal (../)', () => {
    assert.throws(() => sandboxManager._resolveSafe('C:\\sandbox\\proj-123', '../evil.txt'), /traversal/i);
    assert.throws(() => sandboxManager._resolveSafe('C:\\sandbox\\proj-123', '..\\..\\etc\\passwd'), /traversal/i);
    assert.throws(() => sandboxManager._resolveSafe('C:\\sandbox\\proj-123', 'a/../../b'), /traversal/i);
  });

  test('accepts paths inside the sandbox root', () => {
    const out = sandboxManager._resolveSafe('C:\\sandbox\\proj-123', 'src/app.js');
    assert.ok(out.includes('src'));
    const root = sandboxManager._resolveSafe('C:\\sandbox\\proj-123', '');
    assert.equal(root, 'C:\\sandbox\\proj-123');
  });

  test('normalizes absolute-into-root paths', () => {
    const out = sandboxManager._resolveSafe('C:\\sandbox\\proj-123', 'sub\\dir\\file.txt');
    assert.ok(out.endsWith('sub\\dir\\file.txt'));
  });

  test('parseMemory caps memory at 2GB and computes units', () => {
    assert.equal(sandboxManager.parseMemory('512m'), 512 * 1024 * 1024);
    assert.equal(sandboxManager.parseMemory('1g'), 1024 * 1024 * 1024);
    assert.equal(sandboxManager.parseMemory('8g'), 2 * 1024 * 1024 * 1024);
  });

  test('validateCommandPolicy blocks destructive commands', () => {
    assert.equal(sandboxManager.validateCommandPolicy('rm -rf /').allowed, false);
    assert.equal(sandboxManager.validateCommandPolicy('format c:').allowed, false);
    assert.equal(sandboxManager.validateCommandPolicy('powershell Remove-Item -Recurse C:\\').allowed, false);
    assert.equal(sandboxManager.validateCommandPolicy('npm test').allowed, true);
    assert.equal(sandboxManager.validateCommandPolicy('node index.js').allowed, true);
  });

  test('sanitizeEnvironment filters secret credentials', () => {
    const origKey = process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
    try {
      const clean = sandboxManager.sanitizeEnvironment({ CUSTOM_FLAG: '1' });
      assert.equal(clean.AWS_SECRET_ACCESS_KEY, undefined);
      assert.equal(clean.CUSTOM_FLAG, '1');
      assert.ok(clean.NODE_ENV);
    } finally {
      if (origKey) process.env.AWS_SECRET_ACCESS_KEY = origKey;
      else delete process.env.AWS_SECRET_ACCESS_KEY;
    }
  });

  test('getHealthStatus returns engine and resource quotas', async () => {
    const status = await sandboxManager.getHealthStatus();
    assert.ok(status.engine);
    assert.ok(status.resourceQuotas);
    assert.equal(status.resourceQuotas.pidsLimit, 100);
  });

  test('runSelfTest completes diagnostic probe cleanly', async () => {
    const result = await sandboxManager.runSelfTest();
    assert.equal(result.success, true);
    assert.equal(result.probe, 'passed');
    assert.ok(typeof result.latencyMs === 'number');
  });
});

// ── Spec Wizard Service ──────────────────────────────────────────────────
describe('specService', () => {
  const SpecService = require('../services/specService');

  test('creates spec from intent with 5 steps', () => {
    const result = SpecService.createSpecFromIntent('Build a tourism website');
    assert.ok(result.specId);
    assert.equal(result.done, false);
    assert.equal(result.step.id, 'overview');
    assert.equal(result.step.stepNumber, 1);
    assert.equal(result.step.totalSteps, 5);
    assert.ok(result.step.fields.length >= 4);
  });

  test('detects category from intent keywords', () => {
    const spec1 = SpecService.createSpecFromIntent('Build an ecommerce shop');
    assert.ok(spec1.step.fields.some(f => f.key === 'category' && f.suggestions === 'E-commerce'));

    const spec2 = SpecService.createSpecFromIntent('Create a blog site');
    assert.ok(spec2.step.fields.some(f => f.key === 'category' && f.suggestions === 'Blog'));

    const spec3 = SpecService.createSpecFromIntent('Make a dashboard app');
    assert.ok(spec3.step.fields.some(f => f.key === 'category' && f.suggestions === 'Dashboard'));
  });

  test('submits steps sequentially and advances', () => {
    const start = SpecService.createSpecFromIntent('Tourism website');
    const specId = start.specId;

    const step1 = SpecService.submitStep(specId, 0, { name: 'Bihar Tourism', category: 'Tourism', purpose: 'Promote', audience: 'Tourists' });
    assert.equal(step1.step.id, 'features');
    assert.equal(step1.step.stepNumber, 2);

    const step2 = SpecService.submitStep(specId, 1, { core: ['Booking'], optional: ['Blog'], integrations: ['Maps'] });
    assert.equal(step2.step.id, 'tech');
    assert.equal(step2.step.stepNumber, 3);

    const step3 = SpecService.submitStep(specId, 2, { language: 'JavaScript', framework: 'React + Vite', database: 'Supabase', deploy: 'Vercel', styling: 'Tailwind CSS' });
    assert.equal(step3.step.id, 'design');
    assert.equal(step3.step.stepNumber, 4);

    const step4 = SpecService.submitStep(specId, 3, { style: 'Modern', colors: 'Green', pages: ['Home', 'Gallery'] });
    assert.equal(step4.step.id, 'constraints');
    assert.equal(step4.step.stepNumber, 5);

    const step5 = SpecService.submitStep(specId, 4, { budget: 'Free', timeline: '1 Week', team: 'Solo' });
    assert.equal(step5.done, true);
    assert.ok(step5.spec);
    assert.equal(step5.spec.status, 'review');
  });

  test('approves spec and generates plan', async () => {
    const start = SpecService.createSpecFromIntent('Simple blog');
    const specId = start.specId;

    SpecService.submitStep(specId, 0, { name: 'Blog', category: 'Blog', purpose: 'Write posts', audience: 'Readers' });
    SpecService.submitStep(specId, 1, { core: ['Blog/Articles'], optional: [], integrations: [] });
    SpecService.submitStep(specId, 2, { language: 'JavaScript', framework: 'React + Vite', database: 'None (Static)', deploy: 'Vercel', styling: 'Tailwind CSS' });
    SpecService.submitStep(specId, 3, { style: 'Minimal', colors: '', pages: ['Home', 'Blog', 'About'], mobileFirst: true });
    SpecService.submitStep(specId, 4, { budget: 'Free', timeline: '1 Week' });

    const { spec, plan } = await SpecService.approveSpec(specId);
    assert.equal(spec.status, 'approved');
    assert.ok(plan);
    assert.ok(plan.steps);
    assert.ok(plan.steps.length > 0);
    assert.equal(plan.specId, specId);
  });

  test('getSpec retrieves full spec', () => {
    const start = SpecService.createSpecFromIntent('Test project');
    const retrieved = SpecService.getSpec(start.specId);
    assert.ok(retrieved);
    assert.equal(retrieved.intent, 'Test project');
  });

  test('regenerateStep updates suggestions', () => {
    const start = SpecService.createSpecFromIntent('E-commerce site');
    const specId = start.specId;

    SpecService.submitStep(specId, 0, { name: 'Shop', category: 'E-commerce', purpose: 'Sell', audience: 'Buyers' });
    const result = SpecService.regenerateStep(specId, 'features', 'simple');
    assert.ok(result.suggestions);
    assert.ok(result.suggestions.fields.core);
  });

  test('listSpecs returns all specs', () => {
    const initialCount = SpecService.listSpecs().length;
    SpecService.createSpecFromIntent('New project 1');
    SpecService.createSpecFromIntent('New project 2');
    const specs = SpecService.listSpecs();
    assert.equal(specs.length, initialCount + 2);
  });

  test('deleteSpec removes spec', () => {
    const start = SpecService.createSpecFromIntent('To delete');
    const deleted = SpecService.deleteSpec(start.specId);
    assert.equal(deleted, true);
    assert.equal(SpecService.getSpec(start.specId), null);
  });

  test('specToPlan produces valid plan structure', async () => {
    const start = SpecService.createSpecFromIntent('Test app');
    const specId = start.specId;

    SpecService.submitStep(specId, 0, { name: 'Test', category: 'Other', purpose: 'Test', audience: 'Me' });
    SpecService.submitStep(specId, 1, { core: ['Contact Form'], optional: [], integrations: [] });
    SpecService.submitStep(specId, 2, { language: 'JavaScript', framework: 'React + Vite', database: 'None (Static)', deploy: 'Vercel', styling: 'Tailwind CSS' });
    SpecService.submitStep(specId, 3, { style: 'Modern', pages: ['Home', 'Contact'] });
    SpecService.submitStep(specId, 4, { budget: 'Free' });

    const { plan } = await SpecService.approveSpec(specId);
    assert.ok(plan.steps);
    assert.ok(plan.projectName);
    assert.ok(plan.framework);
  });
});
