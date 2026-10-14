'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { parseSseFrame, collectSse, ensureLocalUrl } = require('../scripts/run-phase-1-benchmark');

describe('Phase 1 live benchmark capture runner', () => {
  test('parses SSE JSON frames and event-name fallback', () => {
    assert.deepEqual(parseSseFrame('data: {"type":"output_quality","status":"UNVERIFIED"}'), {
      type: 'output_quality',
      status: 'UNVERIFIED',
    });
    assert.deepEqual(parseSseFrame('event: done\ndata: {"message":"finished"}'), {
      type: 'done',
      message: 'finished',
    });
    assert.equal(parseSseFrame('data: [DONE]').type, 'done');
  });

  test('preserves UTF-8 characters split across streamed SSE chunks', async () => {
    const bytes = Buffer.from('data: {"type":"message","text":"🧪"}\n\n', 'utf8');
    const emojiOffset = bytes.indexOf(Buffer.from('🧪', 'utf8'));
    const chunks = [
      bytes.subarray(0, emojiOffset + 2),
      bytes.subarray(emojiOffset + 2),
    ];
    const response = {
      body: (async function* () {
        for (const chunk of chunks) yield chunk;
      })(),
    };
    const events = [];
    await collectSse(response, (event) => events.push(event));
    assert.deepEqual(events, [{ type: 'message', text: '🧪' }]);
  });

  test('rejects remote hosts because the generated workspace must be locally capturable', () => {
    assert.throws(() => ensureLocalUrl('https://example.com'), /loopback/);
    assert.match(ensureLocalUrl('http://127.0.0.1:3000'), /^http:\/\/127\.0\.0\.1:3000\/?$/);
  });

  test('captures generated files, SSE events, metadata, and diagnostic without claiming acceptance', async (t) => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-runner-'));
    t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
    const artifactsDir = path.join(tempRoot, 'artifacts');
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const payload = JSON.parse(body);
        fs.mkdirSync(payload.projectPath, { recursive: true });
        fs.writeFileSync(path.join(payload.projectPath, 'App.jsx'),
          'export default function App(){ return <main><label>Search</label><button>Export CSV</button></main>; }');
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        res.write('data: {"type":"generation_provider","provider":"gemini","providerName":"Gemini (Flash)","model":null,"fileCount":4,"phase":"initial"}\n\n');
        res.write('data: {"type":"output_quality","status":"UNVERIFIED","acceptanceStatus":"NOT_EVALUATED"}\n\n');
        res.end('data: {"type":"done","message":"finished"}\n\n');
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const address = server.address();
    const scriptPath = path.join(__dirname, '..', 'scripts', 'run-phase-1-benchmark.js');
    const child = spawn(process.execPath, [
      scriptPath,
      '--phase', 'candidate',
      '--case', 'dashboard-search-charts-csv',
      '--runs', '1',
      '--preferred-model', 'gemini',
      '--revision', 'test-baseline-sha',
      '--base-url', 'http://127.0.0.1:' + address.port,
      '--artifacts-dir', artifactsDir,
    ], { cwd: path.join(__dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    assert.equal(exitCode, 0, stderr + '\n' + stdout);

    const runDir = path.join(artifactsDir, 'candidate', 'dashboard-search-charts-csv', 'run-1');
    const metadata = JSON.parse(fs.readFileSync(path.join(runDir, 'metadata.json'), 'utf8'));
    const summary = JSON.parse(fs.readFileSync(path.join(artifactsDir, 'candidate-summary.json'), 'utf8'));
    const events = fs.readFileSync(path.join(runDir, 'events.ndjson'), 'utf8').trim().split('\n');
    assert.equal(metadata.generationCompleted, true);
    assert.equal(metadata.revision, 'test-baseline-sha');
    assert.equal(metadata.outputQuality.status, 'UNVERIFIED');
    assert.equal(metadata.acceptanceStatus, 'NOT_EVALUATED');
    assert.equal(metadata.project.fileCount, 1);
    assert.equal(events.length, 3);
    assert.equal(metadata.settings.actualProviderModelObservations[0].providerName, 'Gemini (Flash)');
    assert.equal(metadata.settings.actualProviderModelObservations[0].fileCount, 4);
    assert.equal(metadata.settings.actualProviderModelObservations[0].phase, 'initial');
    assert.equal(metadata.settings.actualModelIdentityStatus, 'NOT_EXPOSED_BY_GENERATION_EVENT');
    assert.equal(summary.completedRuns, 1);
    assert.equal(summary.acceptanceStatus, 'NOT_EVALUATED');
    assert.ok(fs.existsSync(path.join(runDir, 'static-diagnostic.json')));
  });
});
