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
  const sandboxManager = require('../sandbox/SandboxManager');

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
    assert.equal(status.resourceQuotas.pidsLimit, 512);
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

// ── Verifier Service (Action & Integrity Verifiers) ─────────────────────
describe('verifierService', () => {
  const verifier = require('../services/verifierService');

  test('verifyCode passes on valid JS code', () => {
    const code = 'function add(a, b) { return a + b; }\nconsole.log(add(1, 2));';
    const result = verifier.verifyCode('utils.js', code);
    assert.equal(result.valid, true);
    assert.equal(result.diagnostics.length, 0);
  });

  test('verifyCode catches JS syntax error with line number', () => {
    const badCode = 'function broken() {\n  const x = {;\n}';
    const result = verifier.verifyCode('broken.js', badCode);
    assert.equal(result.valid, false);
    assert.equal(result.diagnostics.length > 0, true);
    assert.match(result.diagnostics[0].message, /(syntax|token|unexpected)/i);
  });

  test('verifyCode validates clean JSON and rejects malformed JSON', () => {
    const validJson = JSON.stringify({ name: 'ai-dost', version: '2.0.0' }, null, 2);
    const good = verifier.verifyCode('config.json', validJson);
    assert.equal(good.valid, true);

    const badJson = '{"name": "ai-dost", trailing: }';
    const bad = verifier.verifyCode('config.json', badJson);
    assert.equal(bad.valid, false);
    assert.match(bad.diagnostics[0].message, /(JSON|double-quoted|syntax|token)/i);
  });

  test('verifyCode detects leaked API keys and secrets', () => {
    const secretCode = 'const GEMINI_KEY = "AIzaSyD-123456789012345678901234567890";';
    const result = verifier.verifyCode('keys.js', secretCode);
    assert.equal(result.valid, false);
    assert.equal(result.secretLeaks.length, 1);
    assert.match(result.secretLeaks[0].type, /Google/i);
  });

  test('verifyDocument checks PDF and Office Open XML magic bytes', () => {
    // Valid PDF header
    const pdfBuf = Buffer.from('%PDF-1.5\n%EOF');
    const pdfCheck = verifier.verifyDocument('report.pdf', pdfBuf, 'pdf');
    assert.equal(pdfCheck.valid, true);

    // Corrupt PDF
    const corruptPdf = Buffer.from('NOT A PDF FILE');
    const corruptCheck = verifier.verifyDocument('broken.pdf', corruptPdf, 'pdf');
    assert.equal(corruptCheck.valid, false);

    // Valid DOCX zip signature (PK\x03\x04)
    const docxBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const docxCheck = verifier.verifyDocument('spec.docx', docxBuf, 'docx');
    assert.equal(docxCheck.valid, true);

    // Valid CSV
    const csvBuf = Buffer.from('id,name,score\n1,Alpha,100\n2,Beta,95');
    const csvCheck = verifier.verifyDocument('data.csv', csvBuf, 'csv');
    assert.equal(csvCheck.valid, true);
    assert.equal(csvCheck.metadata.rowCount, 2);
  });

  test('verifyAction checks write_file action payload', () => {
    const action = {
      action: 'write_file',
      parameters: {
        path: 'src/index.js',
        content: 'const safe = 42;'
      }
    };
    const check = verifier.verifyAction(action);
    assert.equal(check.valid, true);
  });
});

// ── Fullstack Trainer Creative Canvas Art ────────────────────────────────
describe('fullstackTrainer creative canvas art', () => {
  const { detectCategory, buildFullstackSystemPrompt, CATEGORIES } = require('../agent/fullstackTrainer');

  test('detects creative_canvas_art for animation, deity, or visual art keywords', () => {
    assert.equal(detectCategory('krishna ji ka animation banao'), CATEGORIES.CREATIVE_CANVAS_ART);
    assert.equal(detectCategory('Lord Krishna glowing canvas art'), CATEGORIES.CREATIVE_CANVAS_ART);
    assert.equal(detectCategory('neon particle animation with canvas'), CATEGORIES.CREATIVE_CANVAS_ART);
    assert.equal(detectCategory('interactive svg animation'), CATEGORIES.CREATIVE_CANVAS_ART);
  });

  test('buildFullstackSystemPrompt injects creative canvas directives', () => {
    const prompt = buildFullstackSystemPrompt('krishna ji animation', CATEGORIES.CREATIVE_CANVAS_ART);
    assert.ok(prompt.includes('CREATIVE CANVAS & VISUAL ART MANDATE'));
    assert.ok(prompt.includes('NEVER output crude stick figures'));
    assert.ok(prompt.includes('bezierCurveTo'));
  });
});

// ── Copilot IDE Normalization & Deduplication ────────────────────────────
describe('copilot ide path normalization & deduplication', () => {
  const projectStore = require('../projectStore');

  test('normalizes mixed backslashes and leading slashes', () => {
    const p1 = 'src\\components\\Button.jsx';
    const p2 = './src//components/Button.jsx';
    const p3 = '/src/components/Button.jsx';
    
    // Test normalization via projectStore saving and retrieval
    const projId = 'test-dedup-proj-' + Date.now();
    projectStore.saveProjectFile(projId, p1, 'const Btn = () => null;', 'javascript');
    
    const files = projectStore.getProjectFiles(projId);
    assert.equal(files.length, 1);
    assert.equal(files[0].path, 'src/components/Button.jsx');
    
    // Saving same file with mixed slash format should update existing, NOT create duplicate
    projectStore.saveProjectFile(projId, p2, 'const Btn2 = () => null;', 'javascript');
    const updatedFiles = projectStore.getProjectFiles(projId);
    assert.equal(updatedFiles.length, 1);
    assert.equal(updatedFiles[0].content, 'const Btn2 = () => null;');
  });
});

// ── Project Intent: CREATE_NEW_PROJECT vs MODIFY_EXISTING_PROJECT ─────────
describe('Project Intent: CREATE_NEW_PROJECT vs MODIFY_EXISTING_PROJECT', () => {
  const agentRouter = require('../routes/agent');
  const { classifyProjectIntent } = agentRouter;

  test('greenfield prompt with empty workspace classifies as CREATE_NEW_PROJECT', () => {
    const intent = classifyProjectIntent('Build a weather dashboard app with React and Tailwind', false);
    assert.equal(intent, 'CREATE_NEW_PROJECT');
  });

  test('explicit new project prompt with existing files classifies as CREATE_NEW_PROJECT', () => {
    const intent = classifyProjectIntent('Create a brand new portfolio website from scratch', true);
    assert.equal(intent, 'CREATE_NEW_PROJECT');
  });

  test('SmartFinance upgrade scenario with existing files classifies as MODIFY_EXISTING_PROJECT', () => {
    const prompt = 'Upgrade this SmartFinance app: add a monthly spending trends chart and an export CSV button';
    const intent = classifyProjectIntent(prompt, true);
    assert.equal(intent, 'MODIFY_EXISTING_PROJECT');
  });

  test('feature addition, refactoring or bugfix on existing project classifies as MODIFY_EXISTING_PROJECT', () => {
    assert.equal(classifyProjectIntent('Add a dark mode toggle to the navbar', true), 'MODIFY_EXISTING_PROJECT');
    assert.equal(classifyProjectIntent('Fix broken authentication redirect in login.jsx', true), 'MODIFY_EXISTING_PROJECT');
    assert.equal(classifyProjectIntent('Refactor database query to use SQLite index', true), 'MODIFY_EXISTING_PROJECT');
    assert.equal(classifyProjectIntent('iss app me export button lagao', true), 'MODIFY_EXISTING_PROJECT');
  });

  test('SmartFinance existing project simulation preserves existing files and state', () => {
    const projectStore = require('../projectStore');
    const smartFinanceProjId = 'smart-finance-upgrade-test-' + Date.now();

    // 1. Seed existing SmartFinance application files
    projectStore.saveProjectFile(smartFinanceProjId, 'package.json', JSON.stringify({ name: 'smart-finance', version: '1.0.0' }), 'json');
    projectStore.saveProjectFile(smartFinanceProjId, 'src/App.jsx', 'export default function App() { return <div>SmartFinance v1</div>; }', 'javascript');
    projectStore.saveProjectFile(smartFinanceProjId, 'src/components/TransactionList.jsx', 'export function TransactionList() { return <ul><li>$50 Groceries</li></ul>; }', 'javascript');

    const initialFiles = projectStore.getProjectFiles(smartFinanceProjId);
    assert.equal(initialFiles.length, 3);

    // 2. Classify intent for upgrade prompt
    const prompt = 'Upgrade this SmartFinance app: add a monthly spending trends chart and an export CSV button';
    const intent = classifyProjectIntent(prompt, initialFiles.length > 0);
    assert.equal(intent, 'MODIFY_EXISTING_PROJECT');

    // 3. Verify that under MODIFY_EXISTING_PROJECT, existing files are preserved, and new features are integrated additively
    projectStore.saveProjectFile(smartFinanceProjId, 'src/components/SpendingTrendsChart.jsx', 'export function SpendingTrendsChart() { return <div className="chart">Trends</div>; }', 'javascript');
    
    // Update existing App.jsx to import new chart
    const updatedApp = 'import { SpendingTrendsChart } from "./components/SpendingTrendsChart";\nexport default function App() { return <div>SmartFinance v1.1 <SpendingTrendsChart /></div>; }';
    projectStore.saveProjectFile(smartFinanceProjId, 'src/App.jsx', updatedApp, 'javascript');

    const finalFiles = projectStore.getProjectFiles(smartFinanceProjId);
    assert.equal(finalFiles.length, 4);

    // Assert existing TransactionList.jsx was untouched
    const txList = finalFiles.find(f => f.path === 'src/components/TransactionList.jsx');
    assert.ok(txList, 'TransactionList.jsx must be preserved');
    assert.equal(txList.content, 'export function TransactionList() { return <ul><li>$50 Groceries</li></ul>; }');

    // Assert App.jsx was updated, not wiped
    const appFile = finalFiles.find(f => f.path === 'src/App.jsx');
    assert.ok(appFile.content.includes('SpendingTrendsChart'), 'App.jsx must integrate new feature');
    assert.ok(appFile.content.includes('SmartFinance'), 'Original branding and code must be preserved');
  });
});

// ── Shared image-intent matcher (plural-safe Hinglish) ───────────────────────
describe('services/imageIntent', () => {
  const { isImageCreateRequest, extractImageSubject } = require('../services/imageIntent');

  const MATCH = [
    'ek cat ka images banao',
    'cat ki images banao',
    'meri photos banao',
    'logos banao',
    'cat ka images banado',
    'sunset over bihar ki image banao',
    'youtube thumbnail banao',
    'taasveer banao',
  ];
  const NO_MATCH = [
    'cat banao',
    'ek cute cat banao',
    'image ka python code do',
    'pillow se image banane ka code likho',
    'image generate karna kaise hai',
    'how to generate images',
    '3d cat animation banao',
    'pdf banao',
    'todo app banao',
    'meri images dikhao',
    'maine tumse image banane ko kaha to tum copilot ki tarah behave kyo karne lage?',
    '',
  ];

  test('plural and Hinglish phrasings match (the reported regression)', () => {
    // The old regex used \bimage\b, which cannot match "images".
    assert.equal(/\bimage\b/.test('images'), false);
    for (const phrase of MATCH) {
      assert.equal(isImageCreateRequest(phrase), true, `expected match: ${phrase}`);
    }
  });

  test('code asks, how-tos, 3D, docs and non-image nouns never match', () => {
    for (const phrase of NO_MATCH) {
      assert.equal(isImageCreateRequest(phrase), false, `expected no match: ${phrase}`);
    }
  });

  test('extractImageSubject strips Hinglish scaffolding', () => {
    assert.equal(extractImageSubject('ek cat ka images banao'), 'cat');
    assert.equal(extractImageSubject('sunset over bihar ki image banao'), 'sunset over bihar');
    assert.equal(extractImageSubject('picture of a cat'), 'cat');
    assert.equal(extractImageSubject(''), '');
  });

  test('matcher agrees with the frontend twin on every regex source line', () => {
    // Both runtimes ship their own copy; drift is a silent double-failure.
    const fs = require('fs');
    const path = require('path');
    const pick = (file) => fs.readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => /^\s*const (IMAGE_NOUN|MAKE_VERB|CODE_ASK|NON_STATIC|HOW_TO|SUBJECT_STOP) =/.test(l))
      .map((l) => l.trim());
    const backend = pick(path.resolve(__dirname, '../services/imageIntent.js'));
    const frontend = pick(path.resolve(__dirname, '../../frontend/lib/imageIntent.js'));
    assert.equal(backend.length, 6);
    assert.deepEqual(frontend, backend);
  });
});

// ── Orchestrator Security Boundary Tests ────────────────────────────────────
// Removed require('./orchestratorSecurityBoundary.test'); to avoid test-importing-test error.



// -- Phase 1d: Plan-mode override (approved plan replaces LLM plan) ----------
describe('CopilotDirector plan override', () => {
  const { normalizePlan, fallbackPlan } = require('../agent/runtime/CopilotDirector');

  test('approved preset plan passes through (objectives, ids, dependsOn chain)', () => {
    const plan = normalizePlan({
      summary: 'Approved by user',
      tasks: [
        { id: 'task-1', objective: 'Write auth module' },
        { id: 'task-2', objective: 'Wire routes', dependsOn: ['task-1'] },
      ],
    }, 'build todo app');
    assert.equal(plan.summary, 'Approved by user');
    assert.equal(plan.tasks.length, 2);
    assert.equal(plan.tasks[0].objective, 'Write auth module');
    assert.equal(plan.tasks[0].role, 'CODER');
    assert.equal(plan.tasks[0].specialty, 'integration');
    assert.deepEqual(plan.tasks[1].dependsOn, ['task-1']);
  });

  test('duplicate ids dropped, self/unknown deps filtered', () => {
    const plan = normalizePlan({
      tasks: [
        { id: 'a', objective: 'first' },
        { id: 'a', objective: 'duplicate dropped' },
        { id: 'b', objective: 'second', dependsOn: ['a', 'b', 'ghost'] },
      ],
    }, 'req');
    assert.equal(plan.tasks.length, 2);
    assert.deepEqual(plan.tasks[1].dependsOn, ['a']);
  });

  test('dependency cycle falls back to the generic plan (never crashes)', () => {
    const plan = normalizePlan({
      tasks: [
        { id: 'a', objective: 'x', dependsOn: ['b'] },
        { id: 'b', objective: 'y', dependsOn: ['a'] },
      ],
    }, 'req');
    assert.deepEqual(plan, fallbackPlan('req'));
  });

test('null / empty / garbage preset -> fallback plan', () => {
    // Semantic compare: normalizePlan re-normalizes a fallback input (adds
    // role fields), so raw deepEqual against fallbackPlan() is too strict.
    const strip = (p) => ({
      summary: p.summary,
      tasks: p.tasks.map(({ role, ...rest }) => rest),
    });
    assert.deepEqual(strip(normalizePlan(null, 'req')), strip(fallbackPlan('req')));
    assert.deepEqual(normalizePlan({ tasks: [] }, 'req'), fallbackPlan('req'));
    assert.deepEqual(strip(normalizePlan('not-an-object', 'req')), strip(fallbackPlan('req')));
  });

  test('preset tasks are capped at MAX_TASKS', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, objective: `step ${i}` }));
    const plan = normalizePlan({ tasks: many }, 'req');
    const { MAX_TASKS } = require('../agent/runtime/CopilotDirector');
    assert.equal(plan.tasks.length, MAX_TASKS);
  });
});

describe('copilotDirectorHandler preset plan forwarding', () => {
  const { handleCopilotDirectorRequest } = require('../agent/runtime/copilotDirectorHandler');

  function makeRes() {
    return {
      writableEnded: false,
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      flushHeaders() {},
      writes: [],
      write(chunk) { this.writes.push(String(chunk)); },
      end() { this.writableEnded = true; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; this.writableEnded = true; return this; },
    };
  }

  const deps = (capture) => ({
    projectAuthorization: {
      authorize: () => ({ authorized: true, user: { id: 'u1' }, project: { id: 'p1' } }),
    },
    runtime: {
      director: {
        run: async (args) => { capture.push(args); return { status: 'COMPLETED' }; },
      },
    },
  });

  test('body.plan is forwarded to director.run', async () => {
    const runs = [];
    const req = {
      body: {
        copilotDirector: true,
        userPrompt: 'build todo app',
        plan: { summary: 'mine', tasks: [{ id: 'task-1', objective: 'do the thing' }] },
      },
      get: (h) => (h === 'x-ai-dost-task-id' ? 't-plan-1' : undefined),
    };
    const res = makeRes();
    await handleCopilotDirectorRequest(req, res, () => { throw new Error('should not fall through'); }, deps(runs));
    assert.equal(runs.length, 1);
    assert.equal(runs[0].plan.tasks[0].objective, 'do the thing');
    assert.equal(runs[0].plan.summary, 'mine');
    assert.ok(res.writableEnded);
  });

  test('absent/invalid body.plan ? director generates its own (no plan key)', async () => {
    for (const badPlan of [undefined, null, 'x', { tasks: [] }]) {
      const runs = [];
      const req = {
        body: { copilotDirector: true, userPrompt: 'build', ...(badPlan !== undefined ? { plan: badPlan } : {}) },
        get: (h) => (h === 'x-ai-dost-task-id' ? `t-bad-${typeof badPlan}` : undefined),
      };
      const res = makeRes();
      await handleCopilotDirectorRequest(req, res, () => {}, deps(runs));
      assert.equal(runs.length, 1);
      assert.equal('plan' in runs[0], false, `plan key must be absent for ${JSON.stringify(badPlan)}`);
    }
  });
});

// -- Devin-style permission levels (Ask / Auto / Turbo) --------------------
describe('CapabilityGatekeeper evaluateWithLevel (permission levels)', () => {
  const { CapabilityGatekeeper, DECISION } = require('../agent/policy/CapabilityGatekeeper');

  test('ask escalates an auto-allow capability to explicit approval + single-use token', () => {
    const g = new CapabilityGatekeeper();
    const gate = g.evaluateWithLevel(['coding.code_explanation'], { requestId: 'req-ask-1' }, 'ask');
    assert.equal(gate.decision, DECISION.REQUIRE_EXPLICIT_APPROVAL);
    assert.equal(gate.requires_user_action, true);
    assert.ok(gate.approval_token && gate.approval_token.length > 8);
    const v = g.validateApproval({
      token: gate.approval_token,
      requestId: 'req-ask-1',
      capabilityIds: (gate.capabilities || []).map(c => c.capability_id),
    });
    assert.equal(v.valid, true);
  });

  test('ask leaves conversational (empty capability) requests untouched', () => {
    const gate = new CapabilityGatekeeper().evaluateWithLevel([], { requestId: 'r' }, 'ask');
    assert.equal(gate.decision, DECISION.ALLOW);
    assert.equal(gate.requires_user_action, false);
    assert.equal(gate.approval_token, null);
  });

  test('ask passes canonical approval through (exactly one token minted, no double escalation)', () => {
    const g = new CapabilityGatekeeper();
    const before = g._approvalTokens.size;
    const gate = g.evaluateWithLevel(['devops.terminal'], { requestId: 'req-reuse' }, 'ask');
    assert.equal(gate.decision, DECISION.REQUIRE_EXPLICIT_APPROVAL);
    assert.equal(gate.requires_user_action, true);
    assert.ok(gate.approval_token);
    assert.equal(g._approvalTokens.size - before, 1, 'ask must not mint a second token on top of canonical approval');
  });

  test('turbo downgrades canonical approval to ALLOW (no token, no pause)', () => {
    const gate = new CapabilityGatekeeper().evaluateWithLevel(['devops.terminal'], {}, 'turbo');
    assert.equal(gate.decision, DECISION.ALLOW);
    assert.equal(gate.requires_user_action, false);
    assert.equal(gate.approval_token, null);
  });

  test('turbo NEVER overrides a hard BLOCK', () => {
    const gate = new CapabilityGatekeeper().evaluateWithLevel(['saas.payments'], {}, 'turbo');
    assert.equal(gate.decision, DECISION.BLOCK);
    assert.equal(gate.requires_user_action, false);
  });

  test('ask NEVER overrides a hard BLOCK either (no dead approval loop)', () => {
    const gate = new CapabilityGatekeeper().evaluateWithLevel(['saas.payments'], {}, 'ask');
    assert.equal(gate.decision, DECISION.BLOCK);
    assert.equal(gate.approval_token, null);
  });

  test('auto matches canonical evaluate(); unknown level falls back to auto', () => {
    const g = new CapabilityGatekeeper();
    const viaLevel = g.evaluateWithLevel(['coding.database_schema_generation'], {}, 'auto');
    const canonical = g.evaluate(['coding.database_schema_generation'], {});
    assert.equal(viaLevel.decision, canonical.decision);
    assert.equal(viaLevel.requires_user_action, canonical.requires_user_action);
    const garbage = g.evaluateWithLevel(['coding.code_explanation'], {}, 'banana');
    assert.equal(garbage.decision, DECISION.ALLOW);
    assert.equal(garbage.requires_user_action, false);
  });
});

describe('copilotDirectorHandler ask-mode permission gate', () => {
  const { handleCopilotDirectorRequest } = require('../agent/runtime/copilotDirectorHandler');
  const { capabilityDiscovery } = require('../agent/registry/CapabilityDiscovery');

  function makeRes() {
    return {
      writableEnded: false,
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      flushHeaders() {},
      writes: [],
      write(chunk) { this.writes.push(String(chunk)); },
      end() { this.writableEnded = true; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; this.writableEnded = true; return this; },
    };
  }

  const deps = (capture) => ({
    projectAuthorization: {
      authorize: () => ({ authorized: true, user: { id: 'u1' }, project: { id: 'p1' } }),
    },
    runtime: {
      director: {
        run: async (args) => { capture.push(args); return { status: 'COMPLETED' }; },
      },
    },
  });

  const makeReq = (body, taskId) => ({
    body: { copilotDirector: true, ...body },
    get: (h) => (h === 'x-ai-dost-task-id' ? taskId : undefined),
  });

  const eventsOf = (res) => res.writes
    .map(w => w.split('\n').find(l => l.startsWith('data: ')))
    .filter(Boolean)
    .map(l => JSON.parse(l.slice(6)));

  test('ask without approval token pauses with a minted token (director.run never called)', async () => {
    // Precondition: this prompt discovers =1 non-BLOCK capability.
    const caps = capabilityDiscovery.discover('create production code for api');
    assert.ok((caps.matched || []).length + (caps.dependencies || []).length > 0);

    const runs = [];
    const res = makeRes();
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'create production code for api', permissionLevel: 'ask' }, 't-ask-1'),
      res,
      () => { throw new Error('must not fall through'); },
      deps(runs)
    );
    assert.equal(runs.length, 0, 'director.run must not execute before approval');
    assert.ok(res.writableEnded);
    const events = eventsOf(res);
    const gateEvent = events.find(e => e.type === 'gate_approval_required');
    assert.ok(gateEvent, 'gate_approval_required must be emitted');
    assert.ok(gateEvent.gate && gateEvent.gate.approval_token, 'a real approval token must be attached');
    assert.ok(events.some(e => e.type === 'done'));
  });

  test('ask resume with the exact token validates (gate_approved) and runs', async () => {
    const runs = [];
    const firstRes = makeRes();
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'create production code for api', permissionLevel: 'ask' }, 't-ask-2'),
      firstRes,
      () => {},
      deps(runs)
    );
    const token = eventsOf(firstRes).find(e => e.type === 'gate_approval_required')?.gate?.approval_token;
    assert.ok(token, 'first call must issue a token');

    const resumeRes = makeRes();
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'create production code for api', permissionLevel: 'ask', approvalToken: token }, 't-ask-2'),
      resumeRes,
      () => {},
      deps(runs)
    );
    const resumeEvents = eventsOf(resumeRes);
    assert.ok(resumeEvents.some(e => e.type === 'gate_approved'), 'valid token must be accepted');
    assert.equal(runs.length, 1, 'director.run executes exactly once after approval');
    assert.ok(resumeRes.writableEnded);
  });

  test('tampered/unknown approval token is rejected (no run)', async () => {
    const runs = [];
    const res = makeRes();
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'create production code for api', permissionLevel: 'ask', approvalToken: 'forged-token-123' }, 't-ask-3'),
      res,
      () => {},
      deps(runs)
    );
    const events = eventsOf(res);
    assert.ok(events.some(e => e.type === 'gate_approval_invalid'), 'forged token must fail validation');
    assert.equal(runs.length, 0);
    assert.ok(res.writableEnded);
  });

  test('hard BLOCK prompt short-circuits with gate_blocked (no dead approval loop)', async () => {
    const runs = [];
    const res = makeRes();
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'make a website with payments', permissionLevel: 'ask' }, 't-ask-4'),
      res,
      () => {},
      deps(runs)
    );
    const events = eventsOf(res);
    assert.ok(events.some(e => e.type === 'gate_blocked'), 'BLOCK capability must not enter the approval flow');
    assert.equal(runs.length, 0);
    assert.ok(res.writableEnded);
  });

  test('auto / turbo / missing permissionLevel runs without gating', async () => {
    for (const level of [undefined, 'auto', 'turbo']) {
      const runs = [];
      const res = makeRes();
      await handleCopilotDirectorRequest(
        makeReq({ userPrompt: 'create production code for api', ...(level ? { permissionLevel: level } : {}) }, `t-lvl-${level || 'none'}`),
        res,
        () => {},
        deps(runs)
      );
      const events = eventsOf(res);
      assert.equal(runs.length, 1, `${level} must run directly`);
      assert.ok(!events.some(e => e.type === 'gate_approval_required'), `${level} must not pause`);
    }
  });
});

describe('copilotDirectorHandler contextFiles priority (@file mentions)', () => {
  const { handleCopilotDirectorRequest } = require('../agent/runtime/copilotDirectorHandler');

  function makeRes() {
    return {
      writableEnded: false,
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      flushHeaders() {},
      writes: [],
      write(chunk) { this.writes.push(String(chunk)); },
      end() { this.writableEnded = true; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; this.writableEnded = true; return this; },
    };
  }

  const deps = (capture) => ({
    projectAuthorization: {
      authorize: () => ({ authorized: true, user: { id: 'u1' }, project: { id: 'p1' } }),
    },
    runtime: {
      director: {
        run: async (args) => { capture.push(args); return { status: 'COMPLETED' }; },
      },
    },
  });

  const makeReq = (body, taskId) => ({
    body: { copilotDirector: true, ...body },
    get: (h) => (h === 'x-ai-dost-task-id' ? taskId : undefined),
  });

  test('@-mentioned files are appended to the director request', async () => {
    const runs = [];
    const res = makeRes();
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'refactor this', contextFiles: ['src/App.jsx', 'lib/util.js'] }, 't-mf-1'),
      res,
      () => {},
      deps(runs)
    );
    assert.equal(runs.length, 1);
    assert.match(runs[0].request, /@-mentioned files/);
    assert.match(runs[0].request, /src\/App\.jsx/);
    assert.match(runs[0].request, /lib\/util\.js/);
    assert.ok(runs[0].request.startsWith('refactor this'), 'original prompt stays first');
  });

  test('traversal / non-string / blank / oversize entries are filtered', async () => {
    const runs = [];
    await handleCopilotDirectorRequest(
      makeReq({
        userPrompt: 'go',
        contextFiles: ['../secrets.env', 42, '   ', 'a'.repeat(500), 'ok.js'],
      }, 't-mf-2'),
      makeRes(),
      () => {},
      deps(runs)
    );
    assert.equal(runs.length, 1);
    assert.ok(!runs[0].request.includes('secrets.env'), 'path traversal must be dropped');
    assert.ok(!runs[0].request.includes('a'.repeat(50)), 'oversize entries must be dropped');
    assert.match(runs[0].request, /ok\.js/);
  });

  test('absent or empty contextFiles leaves the request untouched', async () => {
    for (const cf of [undefined, [], 'not-an-array']) {
      const runs = [];
      await handleCopilotDirectorRequest(
        makeReq({ userPrompt: 'plain request', ...(cf !== undefined ? { contextFiles: cf } : {}) }, `t-mf-${typeof cf}`),
        makeRes(),
        () => {},
        deps(runs)
      );
      assert.equal(runs.length, 1);
      assert.equal(runs[0].request, 'plain request');
    }
  });

  test('contextFiles list is capped at 20 entries', async () => {
    const runs = [];
    const many = Array.from({ length: 30 }, (_, i) => `f${i}.js`);
    await handleCopilotDirectorRequest(
      makeReq({ userPrompt: 'x', contextFiles: many }, 't-mf-4'),
      makeRes(),
      () => {},
      deps(runs)
    );
    const mentioned = runs[0].request.split('User @-mentioned files (prioritize reading/editing these): ')[1] || '';
    assert.equal(mentioned.split(', ').length, 20);
  });
});

// -- Phase 3a: real run history store (GET /api/agent/tasks) -------------
describe('runHistory (agent_tasks + agent_runs ? GET /tasks)', () => {
  const { DatabaseSync } = require('node:sqlite');
  const { STATUS_TO_COLUMN, mapTaskRow, listRunHistory } = require('../services/runHistory');
  const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
  const AgentRunDAO = require('../db/dao/AgentRunDAO');

  function makeDb() {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE agent_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_id TEXT,
        user_id TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        failed_at DATETIME
      );
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        attempt INTEGER DEFAULT 1,
        started_at DATETIME,
        completed_at DATETIME,
        error_info TEXT,
        runtime_metadata TEXT
      );
    `);
    return db;
  }

  test('STATUS_TO_COLUMN maps every agent_tasks status to a Kanban column', () => {
    assert.equal(STATUS_TO_COLUMN.PENDING, 'planned');
    assert.equal(STATUS_TO_COLUMN.RUNNING, 'running');
    assert.equal(STATUS_TO_COLUMN.VERIFYING, 'running');
    assert.equal(STATUS_TO_COLUMN.COMPLETED, 'done');
    assert.equal(STATUS_TO_COLUMN.SUCCEEDED, 'done');
    assert.equal(STATUS_TO_COLUMN.FAILED, 'review');
    assert.equal(STATUS_TO_COLUMN.CANCELLED, 'backlog');
  });

  test('listRunHistory returns newest tasks with latest-run details', () => {
    const db = makeDb();
    const taskDao = new AgentTaskDAO(db);
    const runDao = new AgentRunDAO(db);

    taskDao.create({ id: 't1', projectId: 'p1', title: 'Build API', status: 'RUNNING' });
    runDao.create({ id: 'r1', taskId: 't1', status: 'RUNNING', attempt: 1, metadata: { goal: 'Build REST API' } });

    taskDao.create({ id: 't2', projectId: 'p1', title: 'Ship it', status: 'FAILED' });
    runDao.create({ id: 'r2a', taskId: 't2', status: 'FAILED', attempt: 1, metadata: null });
    runDao.updateStatus('r2a', 'FAILED', 'provider exploded');
    runDao.create({ id: 'r2b', taskId: 't2', status: 'SUCCEEDED', attempt: 2 });

    taskDao.create({ id: 't3', projectId: 'p2', title: 'No runs yet', status: 'COMPLETED' });

    const all = listRunHistory({ db });
    assert.equal(all.length, 3);
    // Newest first (t3 created last ? first).
    assert.equal(all[0].id, 't3');
    assert.equal(all[0].column, 'done');
    assert.equal(all[0].runCount, 0);
    assert.equal(all[0].runStatus, null);

    const t1 = all.find(x => x.id === 't1');
    assert.equal(t1.column, 'running');
    assert.equal(t1.runStatus, 'RUNNING');
    assert.equal(t1.attempt, 1);
    assert.equal(t1.runCount, 1);
    assert.equal(t1.description, 'Build REST API');
    assert.equal(t1.projectId, 'p1');

    const t2 = all.find(x => x.id === 't2');
    // Latest attempt (2) wins; task column still reflects task status.
    assert.equal(t2.runStatus, 'SUCCEEDED');
    assert.equal(t2.attempt, 2);
    assert.equal(t2.runCount, 2);
    assert.equal(t2.column, 'review');
    // Error comes from the LATEST attempt (attempt 2 succeeded → none),
    // not from the older failed attempt.
    assert.equal(t2.error, null);

    // projectId + limit filters.
    const p2Only = listRunHistory({ db, projectId: 'p2' });
    assert.equal(p2Only.length, 1);
    assert.equal(p2Only[0].id, 't3');
    const limited = listRunHistory({ db, limit: 1 });
    assert.equal(limited.length, 1);
    db.close();
  });

  test('mapTaskRow survives corrupt metadata/error JSON', () => {
    const row = {
      id: 'tx', project_id: 'p1', title: 'Title fallback',
      status: 'PENDING', created_at: '2026-01-01', updated_at: '2026-01-01',
      completed_at: null,
    };
    const runs = [{
      id: 'r', attempt: 1, status: 'FAILED',
      started_at: null, completed_at: null,
      runtime_metadata: '{not json',
      error_info: '{broken',
    }];
    const mapped = mapTaskRow(row, runs);
    assert.equal(mapped.description, 'Title fallback');
    assert.equal(mapped.error, '{broken');
    assert.equal(mapped.column, 'planned');
    assert.equal(mapped.runCount, 1);
  });

  test('listRunHistory without a db returns [] (never throws)', () => {
    assert.deepEqual(listRunHistory({ db: null }), []);
  });
});

// -- Phase 3b: workspace change bus (watch mode event push) --------------
describe('workspace change bus (projectStore onWorkspaceChange)', () => {
  const { onWorkspaceChange, notifyWorkspaceChange } = require('../projectStore');

  test('subscribers receive notify events with projectId/path/action', () => {
    const seen = [];
    const off = onWorkspaceChange((evt) => seen.push(evt));
    notifyWorkspaceChange('p-watch', 'src/App.jsx', 'write');
    notifyWorkspaceChange('p-watch', 'old.js', 'delete');
    off();
    assert.equal(seen.length, 2);
    assert.equal(seen[0].projectId, 'p-watch');
    assert.equal(seen[0].path, 'src/App.jsx');
    assert.equal(seen[0].action, 'write');
    assert.equal(seen[1].action, 'delete');
    assert.equal(typeof seen[0].at, 'number');
  });

  test('unsubscribe stops delivery; later emits do not reach it', () => {
    const seen = [];
    const off = onWorkspaceChange((evt) => seen.push(evt));
    off();
    notifyWorkspaceChange('p-watch', 'a.txt', 'write');
    assert.equal(seen.length, 0);
  });

  test('multiple subscribers all receive the same event', () => {
    const a = [];
    const b = [];
    const offA = onWorkspaceChange((evt) => a.push(evt));
    const offB = onWorkspaceChange((evt) => b.push(evt));
    notifyWorkspaceChange('p2', 'x.js', 'write');
    offA();
    offB();
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
  });

  test('a throwing subscriber never propagates to the caller', () => {
    const off = onWorkspaceChange(() => { throw new Error('boom'); });
    assert.doesNotThrow(() => notifyWorkspaceChange('p3', 'y.js', 'write'));
    off();
  });

  test('unsubscribing twice is safe (idempotent teardown)', () => {
    const seen = [];
    const off = onWorkspaceChange((evt) => seen.push(evt));
    off();
    assert.doesNotThrow(() => off());
    notifyWorkspaceChange('p4', 'z.js', 'write');
    assert.equal(seen.length, 0);
  });
});

// -- Self-learning: durable copilot notes (survive project deletion) -----
describe('copilotMemory (self-learning notes)', () => {
  const { DatabaseSync } = require('node:sqlite');
  const migration010 = require('../db/migrations/010_copilot_memory');
  const CopilotNoteDAO = require('../db/dao/CopilotNoteDAO');
  const { learnNotes, retrieveNotes, formatNotes, extractRunNotes } = require('../services/copilotMemory');

  function makeDb() {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT)');
    migration010.up(db);
    return db;
  }

  test('learnNotes saves, dedupes by content, bumps success_count, caps batch at 10', () => {
    const db = makeDb();
    const r1 = learnNotes([{ kind: 'lesson', content: 'Use vite for react apps', tags: ['react'] }], { projectId: 'p1', db });
    assert.deepEqual(r1, { saved: 1, deduped: 0, failed: 0 });
    const r2 = learnNotes([{ content: 'Use vite for react apps' }], { db });
    assert.equal(r2.deduped, 1);
    assert.equal(r2.saved, 0);
    const dao = new CopilotNoteDAO(db);
    assert.equal(dao.count('local-user'), 1);
    assert.equal(dao.listByUser('local-user')[0].success_count, 2);
    const many = Array.from({ length: 15 }, (_, i) => ({ content: `distinct note ${i}` }));
    const r3 = learnNotes(many, { db });
    assert.equal(r3.saved + r3.deduped, 10);
    db.close();
  });

  test('retrieveNotes ranks prompt-overlap + same-project, excludes unrelated noise', () => {
    const db = makeDb();
    learnNotes([
      { content: 'React dashboard chart layout worked well', tags: ['react', 'dashboard'], projectId: 'pA' },
      { content: 'Express api jwt auth pattern', tags: ['express'], projectId: 'pB' },
      { content: 'Totally unrelated gardening tips', tags: ['garden'], projectId: 'pC' },
    ], { db });
    const hit = retrieveNotes({ prompt: 'make a react dashboard with charts', projectId: 'pA', db });
    assert.ok(hit.length >= 1);
    assert.match(hit[0].content, /React dashboard/);
    assert.ok(!hit.some(r => r.content.includes('gardening')), 'unrelated note excluded');
    // Same-project note surfaces even when the prompt shares no keywords.
    learnNotes([{ content: 'zzz qqq unique-only-here', projectId: 'pA' }], { db });
    const same = retrieveNotes({ prompt: 'completely different words xyz', projectId: 'pA', db });
    assert.ok(same.some(r => r.content.includes('unique-only-here')));
    db.close();
  });

  test('notes survive project deletion (NO foreign key cascade)', () => {
    const db = makeDb();
    db.prepare("INSERT INTO projects (id, name) VALUES ('proj_gone', 'Temp')").run();
    learnNotes([{ content: 'PWA service worker caching lesson', projectId: 'proj_gone' }], { db });
    db.prepare("DELETE FROM projects WHERE id = 'proj_gone'").run();
    const after = retrieveNotes({ prompt: 'pwa service worker offline app', projectId: 'proj_gone', db });
    assert.ok(after.some(r => r.content.includes('PWA service worker')));
    assert.equal(new CopilotNoteDAO(db).count('local-user'), 1);
    db.close();
  });

  test('extractRunNotes builds deterministic success/error/heal notes with tags', () => {
    const ok = extractRunNotes({ prompt: 'banao react express todo app', status: 'success', filesTouched: 12 });
    assert.equal(ok.length, 1);
    assert.equal(ok[0].kind, 'lesson');
    assert.match(ok[0].content, /12 files/);
    assert.ok(ok[0].tags.includes('react'));
    const bad = extractRunNotes({
      prompt: 'create docker deploy',
      status: 'error',
      message: 'port 5000 busy',
      heals: [{ error: 'EADDRINUSE 5000' }, { error: '' }],
    });
    assert.equal(bad.length, 2); // failure note + one non-empty heal note
    assert.equal(bad[0].kind, 'fix');
    assert.match(bad[0].content, /port 5000 busy/);
    assert.match(bad[1].content, /EADDRINUSE/);
    assert.deepEqual(extractRunNotes({ prompt: '   ' }), []);
  });

  test('formatNotes keeps injected prompt block compact (<=700 chars)', () => {
    const notes = Array.from({ length: 20 }, (_, i) => ({ kind: 'lesson', content: `x${i} `.repeat(60) }));
    const out = formatNotes(notes);
    assert.ok(out.length <= 700);
    assert.ok(out.split('\n').length < 20);
    assert.equal(formatNotes([]), '');
    assert.equal(formatNotes(null), '');
  });
});
