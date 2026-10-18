#!/usr/bin/env node
'use strict';

/**
 * Live six-case evaluator. Captures source files and the actual server-emitted
 * TrustedExecutionService-backed quality-gate outcome. Missing evidence never passes.
 * Run on the same machine as the local AI Dost backend.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ContainerExecutionAdapter } = require('../quality-evaluation/containerExecutionAdapter');

const CASES_PATH = path.join(__dirname, '..', 'quality-evaluation', 'canonicalCases.json');
const REPO_ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    if (key === 'help') { args.help = true; continue; }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --' + key);
    args[key] = value;
    i += 1;
  }
  return args;
}

function ensureLocalUrl(raw) {
  if (!raw) throw new Error('Set --base-url or AI_DOST_BASE_URL, e.g. http://127.0.0.1:5000.');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error('For artifact safety, only a loopback AI Dost backend URL is allowed.');
  }
  return url.toString().replace(/\/+$/, '');
}

function assertOutsideRepo(dir) {
  const rel = path.relative(REPO_ROOT, dir);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    throw new Error('Artifacts directory must be outside the repository.');
  }
}

function parseSseFrame(frame) {
  const data = [];
  let eventName = null;
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  const raw = data.join('\n');
  if (raw === '[DONE]') return { type: eventName || 'done', raw };
  try {
    const event = JSON.parse(raw);
    if (eventName && !event.type) event.type = eventName;
    return event;
  } catch (_) {
    return { type: eventName || 'unparsed', raw };
  }
}

async function collectSse(response, onEvent) {
  if (!response.body) throw new Error('Generation endpoint returned no body.');
  const decoder = new TextDecoder();
  let pending = '';
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = pending.search(/\r?\n\r?\n/)) !== -1) {
      const frame = pending.slice(0, boundary);
      const sep = pending.slice(boundary).match(/^\r?\n\r?\n/)[0];
      pending = pending.slice(boundary + sep.length);
      const event = parseSseFrame(frame);
      if (event) onEvent(event);
    }
  }
  pending += decoder.decode();
  if (pending.trim()) {
    const event = parseSseFrame(pending);
    if (event) onEvent(event);
  }
}

function safeProjectFilePath(projectDir, rawPath) {
  if (typeof rawPath !== 'string' || !rawPath.trim()) throw new Error('Missing generated relative path.');
  const normalized = rawPath.replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || /^[a-zA-Z]:/.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('Unsafe generated path rejected: ' + rawPath);
  }
  const root = path.resolve(projectDir);
  const destination = path.resolve(root, normalized);
  if (destination === root || !destination.startsWith(root + path.sep)) {
    throw new Error('Generated path escapes project workspace: ' + rawPath);
  }
  return destination;
}

function writeCapturedFile(projectDir, rawPath, fileContent) {
  if (typeof fileContent !== 'string') return false;
  const destination = safeProjectFilePath(projectDir, rawPath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const rootReal = fs.realpathSync(projectDir);
  const parentReal = fs.realpathSync(path.dirname(destination));
  if (!parentReal.startsWith(rootReal + path.sep)) throw new Error('Generated file parent escaped workspace.');
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('Generated file targets a symlink.');
  fs.writeFileSync(destination, fileContent, 'utf8');
  return true;
}

function assertContainerRuntimeAvailable() {
  const adapter = new ContainerExecutionAdapter({ strictIsolation: true });
  const probe = adapter.probeRuntime();
  if (!probe.available) {
    throw new Error('Benchmark requires an active Docker or Podman daemon. Start the container runtime before generating any model outputs.');
  }
  return probe.runtime;
}

function loadCanonicalCases() {
  const doc = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  if (!Array.isArray(doc.cases) || doc.cases.length !== 6) throw new Error('Expected exactly six canonical cases.');
  const ids = new Set();
  for (const c of doc.cases) {
    if (!c.id || !c.prompt || !Array.isArray(c.requiredCapabilities)) throw new Error('Malformed canonical case.');
    if (ids.has(c.id)) throw new Error('Duplicate canonical case ID: ' + c.id);
    ids.add(c.id);
  }
  return doc.cases;
}

function getSeedFiles(caseId) {
  if (caseId !== 'multi-step-repair') return {};
  return {
    'package.json': JSON.stringify({
      name: 'aidost-canonical-repair-fixture',
      version: '1.0.0',
      private: true,
      scripts: { build: 'node scripts/check-build.js', test: 'node --test tests/repair.test.js' }
    }, null, 2) + '\n',
    'src/state.js': [
      "'use strict';",
      'function addItem(state, item) {',
      '  state.items.push(item); return state;',
      '}',
      'module.exports = { addItem };',
      ''
    ].join('\n'),
    'src/api.js': [
      "'use strict';",
      'async function callApi(url, payload) {',
      "  return fetch(url, { method: 'GET', body: JSON.stringify(payload) });",
      '}',
      'module.exports = { callApi };',
      ''
    ].join('\n'),
    'tests/repair.test.js': [
      "'use strict';",
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const { addItem } = require('../src/state');",
      "const { callApi } = require('../src/api');",
      "test('addItem preserves original state', () => {",
      '  const original = { items: [1, 2] };',
      '  const updated = addItem(original, 3);',
      '  assert.equal(original.items.length, 2);',
      '  assert.equal(updated.items.length, 3);',
      '  assert.notEqual(updated.items, original.items);',
      '});',
      "test('callApi forwards the request as POST', async () => {",
      "  const response = await callApi('/api/data', { key: 'testValue' });",
      '  assert.ok(response);',
      '});',
      ''
    ].join('\n'),
    'scripts/check-build.js': "'use strict';\nrequire('../src/state');\nrequire('../src/api');\nconsole.log('Repair fixture syntax/load check passed.');\n"
  };
}

function writeSeedFiles(projectDir, seedFiles) {
  for (const [relativePath, fileContent] of Object.entries(seedFiles)) {
    const target = safeProjectFilePath(projectDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fileContent, 'utf8');
  }
}

function listProjectFiles(projectDir) {
  const result = [];
  const walk = (current, relative) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const abs = path.join(current, entry.name);
      const rel = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile()) result.push({ path: rel, bytes: fs.statSync(abs).size });
    }
  };
  walk(projectDir, '');
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

function getGateEvidence(events) {
  const all = events.filter((e) => e && e.type === 'quality_gate_evaluation');
  const latest = all.length ? all[all.length - 1] : null;
  const withResult = all.slice().reverse().find((e) => e && e.gateResult);
  const gate = withResult && withResult.gateResult;
  const layers = gate && gate.layers || {};
  return {
    eventCount: all.length,
    status: latest && latest.status ? String(latest.status).toUpperCase() : gate && gate.status ? String(gate.status).toUpperCase() : 'NOT_EVALUATED',
    score: Number.isFinite(gate && gate.score) ? gate.score : null,
    coveragePercent: Number.isFinite(gate && gate.coveragePercent) ? gate.coveragePercent : null,
    artifactHash: gate && gate.artifactHash || null,
    receipt: layers.executionReceipt || { executed: false, verified: false, reason: 'NO_QUALITY_GATE_RESULT' },
    build: layers.buildExecution || { executed: false, passed: false },
    tests: layers.unitTests || { executed: false, passed: false },
    runtime: layers.runtimeStartup || { executed: false, passed: false },
    acceptanceFlows: layers.acceptanceFlows || { executed: false, passed: false },
    defects: gate && Array.isArray(gate.defects) ? gate.defects : [],
    errors: gate && Array.isArray(gate.errors) ? gate.errors : [],
    latestMessage: latest && (latest.error || latest.reason) || null
  };
}

function deriveRunResult(events, requestError, terminalError, captureErrors, files, elapsedMs) {
  const terminal = events.filter((e) => e && ['director_complete', 'done'].includes(e.type));
  const completion = terminal.slice().reverse().find((e) => e.type === 'director_complete') || terminal[terminal.length - 1] || null;
  const directorStarted = events.some((e) => e && e.type === 'director_start');
  const gate = getGateEvidence(events);
  const generationCompleted = !requestError && !terminalError && directorStarted &&
    Boolean(completion) && completion.status === 'SUCCEEDED' && files.length > 0 && captureErrors.length === 0;
  const runtimeVerified = gate.status === 'VERIFIED_PASS' && gate.receipt.verified === true &&
    gate.acceptanceFlows.passed === true && gate.build.passed === true;
  const caseStatus = generationCompleted && runtimeVerified ? 'VERIFIED_PASS' : gate.status;
  const acceptanceStatus = generationCompleted && runtimeVerified ? 'PASSED' :
    caseStatus === 'NOT_EVALUATED' ? 'NOT_EVALUATED' : 'FAILED_OR_PARTIAL';
  return {
    generationCompleted,
    generationCompletionStatus: completion && completion.status || 'MISSING',
    generationCompletionReason: requestError ? 'request-failed' : terminalError ? 'generation-emitted-error' :
      !directorStarted ? 'director-path-not-observed' : !completion ? 'no-director-terminal-event' :
      completion.status !== 'SUCCEEDED' ? 'director-not-succeeded' : files.length === 0 ? 'no-generated-files-captured' :
      captureErrors.length ? 'generated-file-capture-errors' : 'director-terminal-event-and-generated-files-observed',
    caseStatus,
    acceptanceStatus,
    gate,
    elapsedMs
  };
}

function markdownSummary(summary) {
  const out = [
    '# AI Dost Canonical Generated-Application Benchmark', '',
    '- Benchmark run: ' + summary.benchmarkRunId,
    '- Revision: ' + summary.revision,
    '- Requested model route: ' + summary.preferredModel,
    '- Started: ' + summary.startedAt,
    '- Finished: ' + summary.finishedAt,
    '- Repetitions per case: ' + summary.runsPerCase,
    '- Cases selected: ' + summary.caseCount + '/6',
    '- Runtime verified passes: ' + summary.verifiedPassCount + '/' + summary.totalRuns,
    '- Runtime status: **' + summary.runtimeStatus + '**', '',
    '## Results', '',
    '| Canonical case | Run | Acceptance | Gate status | Score | Coverage | Files | Duration (s) |',
    '|---|---:|---|---|---:|---:|---:|---:|'
  ];
  for (const r of summary.results) {
    out.push('| ' + r.caseId + ' | ' + r.runNumber + ' | ' + r.acceptanceStatus + ' | ' + r.caseStatus +
      ' | ' + (r.gateScore == null ? 'n/a' : r.gateScore) + ' | ' +
      (r.coveragePercent == null ? 'n/a' : r.coveragePercent + '%') + ' | ' +
      r.fileCount + ' | ' + (r.elapsedMs / 1000).toFixed(1) + ' |');
  }
  out.push('', '## Evidence and limitations', '',
    '- Raw SSE events, generated project files, and per-run metadata are preserved in each run directory.',
    '- PASSED requires a successful Director terminal event, captured files, VERIFIED_PASS quality-gate status, a verified trusted execution receipt, successful build, and passing canonical acceptance flows.',
    '- Missing gate/receipt/build/acceptance evidence remains NOT_EVALUATED or FAILED_OR_PARTIAL; static keyword matches are never treated as a pass.',
    '- This report records server-side behavioral acceptance. It does not replace independent browser screenshots at 360/768/1280 px, visual/accessibility review, or baseline-versus-candidate comparison.',
    '- Check runtime isolation configuration separately; a signed receipt does not by itself prove OS-level container isolation.', '');
  return out.join('\n');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function runOne(config) {
  const c = config.testCase;
  const runNumber = config.runNumber;
  const runId = crypto.randomUUID();
  const runDir = path.join(config.artifactsDir, c.id, 'run-' + runNumber);
  if (fs.existsSync(runDir)) throw new Error('Refusing to overwrite run artifacts: ' + runDir);
  const projectDir = path.join(runDir, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  const seedFiles = getSeedFiles(c.id);
  writeSeedFiles(projectDir, seedFiles);
  const projectFiles = Object.entries(seedFiles).map(([p, content]) => ({ path: p, content }));
  const eventsPath = path.join(runDir, 'events.ndjson');
  const events = [];
  const captureErrors = [];
  const startedAt = new Date().toISOString();
  const start = Date.now();
  let requestError = null;
  let terminalError = null;
  let httpStatus = null;

  const recordEvent = (event) => {
    events.push(event);
    fs.appendFileSync(eventsPath, JSON.stringify(event) + '\n', 'utf8');
    if (event && ['file_written', 'file_changed'].includes(String(event.type || '').toLowerCase())) {
      const p = event.path || event.file;
      if (typeof p === 'string' && typeof event.content === 'string') {
        try { writeCapturedFile(projectDir, p, event.content); }
        catch (error) { captureErrors.push({ path: p, error: error.message }); }
      }
    }
    if (event && ['error', 'agent_error', 'director_error'].includes(String(event.type || '').toLowerCase())) {
      terminalError = String(event.message || event.error || event.reason || event.type);
    }
  };

  try {
    const response = await fetch(config.baseUrl + '/api/agent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(config.authToken ? { Authorization: 'Bearer ' + config.authToken } : {}),
        ...(config.userId ? { 'x-user-id': config.userId } : {})
      },
      body: JSON.stringify({
        userPrompt: c.prompt,
        projectPath: projectDir,
        projectId: 'canonical-' + c.id + '-' + runNumber + '-' + runId,
        chatHistory: [],
        projectFiles,
        copilotDirector: true,
        permissionLevel: 'auto',
        preferredModel: config.preferredModel
      }),
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    httpStatus = response.status;
    if (!response.ok) throw new Error('Generation endpoint returned HTTP ' + response.status + ': ' + (await response.text()).slice(0, 1000));
    await collectSse(response, recordEvent);
  } catch (error) {
    requestError = error.message;
  }

  const elapsedMs = Date.now() - start;
  const files = listProjectFiles(projectDir);
  const providerModelObservations = events.filter((e) => e && (e.provider || e.model || e.providerName)).map((e) => ({
    provider: e.provider || null, providerName: e.providerName || null, model: e.model || null, type: e.type || null, phase: e.phase || null
  }));
  const derived = deriveRunResult(events, requestError, terminalError, captureErrors, files, elapsedMs);
  const metadata = {
    schemaVersion: '1.0',
    evaluator: 'canonical-live-generation-and-quality-gate',
    benchmarkRunId: config.benchmarkRunId,
    revision: config.revision,
    caseId: c.id,
    caseName: c.name,
    runNumber,
    prompt: c.prompt,
    requiredCapabilities: c.requiredCapabilities,
    requiredElements: c.requiredElements,
    antiPatterns: c.antiPatterns,
    settings: {
      baseUrl: config.baseUrl,
      preferredModel: config.preferredModel,
      timeoutMs: config.timeoutMs,
      containerRuntime: config.containerRuntime,
      authConfigured: Boolean(config.authToken),
      userIdHeaderConfigured: Boolean(config.userId),
      actualProviderModelObservations: providerModelObservations,
      actualModelIdentityStatus: providerModelObservations.some((e) => e.model) ? 'OBSERVED' : 'NOT_EXPOSED_BY_GENERATION_EVENT',
      repairFixtureSeeded: Object.keys(seedFiles).length > 0,
      isolationNote: 'Confirm OS-level isolation separately from this report.'
    },
    startedAt,
    finishedAt: new Date().toISOString(),
    httpStatus,
    requestError,
    terminalError,
    directorStarted: events.some((e) => e && e.type === 'director_start'),
    directorCompleteEvents: events.filter((e) => e && e.type === 'director_complete').map((e) => ({ status: e.status || null, message: e.message || null })),
    qualityGate: derived.gate,
    generationCompleted: derived.generationCompleted,
    generationCompletionStatus: derived.generationCompletionStatus,
    generationCompletionReason: derived.generationCompletionReason,
    caseStatus: derived.caseStatus,
    acceptanceStatus: derived.acceptanceStatus,
    elapsedMs,
    project: { directory: projectDir, fileCount: files.length, files, captureErrors },
    evidence: {
      eventsPath,
      qualityGateEventCount: derived.gate.eventCount,
      artifactHash: derived.gate.artifactHash,
      receiptVerified: derived.gate.receipt.verified === true,
      buildPassed: derived.gate.build.passed === true,
      acceptanceFlowsPassed: derived.gate.acceptanceFlows.passed === true
    }
  };
  writeJson(path.join(runDir, 'metadata.json'), metadata);
  return metadata;
}

function loadDotEnv() {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
}

function usage() {
  return [
    'Usage: node scripts/run-canonical-app-benchmark.js --base-url http://127.0.0.1:5000 --preferred-model auto --revision <git-sha>',
    'Optional: --case <canonical-id> --runs <1-3> --artifacts-dir <outside-repo-path> --timeout-ms <milliseconds>',
    'Environment: AI_DOST_BASE_URL, AI_DOST_BENCHMARK_MODEL, AI_DOST_BENCHMARK_REVISION, AI_DOST_BENCHMARK_TOKEN, AI_DOST_BENCHMARK_USER_ID, AIDOST_RUNNER_SECRET',
    'Requires a local running backend, model/provider credentials, and a configured trusted-runner secret.'
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  loadDotEnv();
  const baseUrl = ensureLocalUrl(args['base-url'] || process.env.AI_DOST_BASE_URL || '');
  const preferredModel = args['preferred-model'] || process.env.AI_DOST_BENCHMARK_MODEL;
  if (!preferredModel) throw new Error('Set --preferred-model or AI_DOST_BENCHMARK_MODEL explicitly.');
  const revision = args.revision || process.env.AI_DOST_BENCHMARK_REVISION;
  if (!revision) throw new Error('Set --revision or AI_DOST_BENCHMARK_REVISION.');
  const secret = process.env.AIDOST_RUNNER_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    throw new Error('AIDOST_RUNNER_SECRET must be configured with at least 16 characters; trusted-evidence benchmark aborted.');
  }
  const timeoutMs = Number(args['timeout-ms'] || 12 * 60 * 1000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) throw new Error('--timeout-ms must be an integer >= 1000.');
  const runs = Number(args.runs || 1);
  if (!Number.isInteger(runs) || runs < 1 || runs > 3) throw new Error('--runs must be an integer from 1 to 3.');
  const artifactsDir = path.resolve(args['artifacts-dir'] || path.join(os.tmpdir(), 'ai-dost-canonical-benchmark-' + Date.now()));
  assertOutsideRepo(artifactsDir);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const containerRuntime = assertContainerRuntimeAvailable();
  const allCases = loadCanonicalCases();
  const selectedCases = args.case ? allCases.filter((c) => c.id === args.case) : allCases;
  if (!selectedCases.length) throw new Error('Unknown --case ' + args.case + '. Valid: ' + allCases.map((c) => c.id).join(', '));
  const benchmarkRunId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const config = {
    benchmarkRunId, baseUrl, preferredModel, revision, timeoutMs, artifactsDir, containerRuntime,
    authToken: process.env.AI_DOST_BENCHMARK_TOKEN || null,
    userId: process.env.AI_DOST_BENCHMARK_USER_ID || null
  };
  const results = [];
  for (const testCase of selectedCases) {
    for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
      console.log('[' + testCase.id + '] run ' + runNumber + '/' + runs);
      const result = await runOne({ ...config, testCase, runNumber });
      results.push(result);
      console.log('  gate=' + result.caseStatus + '; acceptance=' + result.acceptanceStatus +
        '; receipt=' + result.evidence.receiptVerified + '; files=' + result.project.fileCount +
        '; elapsedMs=' + result.elapsedMs);
    }
  }
  const verifiedPassCount = results.filter((r) => r.acceptanceStatus === 'PASSED').length;
  const fullSuite = selectedCases.length === allCases.length;
  const summary = {
    schemaVersion: '1.0',
    evaluator: 'canonical-live-generation-and-quality-gate',
    benchmarkRunId, revision, preferredModel, baseUrl, startedAt, finishedAt: new Date().toISOString(),
    containerRuntime, runsPerCase: runs, caseCount: selectedCases.length, totalCanonicalCases: allCases.length,
    expectedRuns: selectedCases.length * runs, totalRuns: results.length,
    completedGenerations: results.filter((r) => r.generationCompleted).length,
    verifiedPassCount, fullSuite,
    runtimeStatus: fullSuite && verifiedPassCount === results.length ? 'VERIFIED_PASS' : 'NOT_FULLY_VERIFIED',
    investorGradeStatus: 'NOT_EVALUATED',
    investorGradeNote: 'This command does not perform independent browser screenshots at 360/768/1280 px, visual/accessibility review, or baseline-versus-candidate comparison.',
    results: results.map((r) => ({
      caseId: r.caseId, caseName: r.caseName, runNumber: r.runNumber,
      generationCompleted: r.generationCompleted, generationCompletionStatus: r.generationCompletionStatus,
      generationCompletionReason: r.generationCompletionReason, caseStatus: r.caseStatus,
      acceptanceStatus: r.acceptanceStatus, gateScore: r.qualityGate.score,
      coveragePercent: r.qualityGate.coveragePercent, receiptVerified: r.evidence.receiptVerified,
      buildPassed: r.evidence.buildPassed, acceptanceFlowsPassed: r.evidence.acceptanceFlowsPassed,
      fileCount: r.project.fileCount, elapsedMs: r.elapsedMs,
      error: r.requestError || r.terminalError || r.qualityGate.latestMessage || null,
      runDir: path.dirname(r.project.directory)
    }))
  };
  writeJson(path.join(artifactsDir, 'canonical-benchmark-summary.json'), summary);
  fs.writeFileSync(path.join(artifactsDir, 'canonical-benchmark-report.md'), markdownSummary(summary) + '\n', 'utf8');
  console.log('JSON report: ' + path.join(artifactsDir, 'canonical-benchmark-summary.json'));
  console.log('Markdown report: ' + path.join(artifactsDir, 'canonical-benchmark-report.md'));
  console.log('Runtime verified passes: ' + verifiedPassCount + '/' + results.length + '; investor-grade status remains NOT_EVALUATED pending independent visual/browser review.');
  if (!fullSuite || verifiedPassCount !== results.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Canonical benchmark failed: ' + error.message);
    process.exitCode = 2;
  });
}

module.exports = {
  parseArgs, ensureLocalUrl, parseSseFrame, safeProjectFilePath,
  loadCanonicalCases, getSeedFiles, getGateEvidence, deriveRunResult, markdownSummary
};
