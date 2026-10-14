#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CASES_PATH = path.join(__dirname, '..', 'quality-evaluation', 'phase-1-cases.json');
const SCORER_PATH = path.join(__dirname, 'score-generated-app.js');
const REPO_ROOT = path.resolve(__dirname, '../..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error('Missing value for --' + key);
    args[key] = value;
    i += 1;
  }
  return args;
}

function ensureLocalUrl(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Base URL must use HTTP or HTTPS.');
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    throw new Error('Run this beside the backend so the generated workspace can be preserved; use a loopback AI_DOST_BASE_URL.');
  }
  return url.toString().replace(/\/+$/, '');
}

function parseSseFrame(frame) {
  const dataLines = [];
  let eventName = null;
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length) return null;
  const dataText = dataLines.join('\n');
  if (dataText === '[DONE]') return { type: eventName || 'done', raw: dataText };
  try {
    const payload = JSON.parse(dataText);
    if (eventName && !payload.type) payload.type = eventName;
    return payload;
  } catch {
    return { type: eventName || 'unparsed', raw: dataText };
  }
}

async function collectSse(response, onEvent) {
  let pending = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = pending.search(/\r?\n\r?\n/)) !== -1) {
      const frame = pending.slice(0, boundary);
      const separator = pending.slice(boundary).match(/^\r?\n\r?\n/)[0];
      pending = pending.slice(boundary + separator.length);
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function assertOutsideRepo(dir) {
  const relative = path.relative(REPO_ROOT, dir);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('Artifacts directory must be outside the repository to avoid committing generated projects by accident.');
  }
}

async function runOne(config) {
  const phase = config.phase;
  const revision = config.revision;
  const testCase = config.testCase;
  const runNumber = config.runNumber;
  const runDir = path.join(config.artifactsDir, phase, testCase.id, 'run-' + runNumber);
  if (fs.existsSync(runDir)) throw new Error('Refusing to overwrite existing run artifacts: ' + runDir);
  const projectPath = path.join(runDir, 'project');
  fs.mkdirSync(projectPath, { recursive: true });
  const eventsPath = path.join(runDir, 'events.ndjson');
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const events = [];
  let terminalError = null;

  const recordEvent = (event) => {
    events.push(event);
    fs.appendFileSync(eventsPath, JSON.stringify(event) + '\n', 'utf8');
    if (['error', 'agent_error', 'director_error'].includes(String(event.type || '').toLowerCase())) {
      terminalError = String(event.message || event.error || event.reason || event.type);
    }
  };

  let httpStatus = null;
  let requestError = null;
  try {
    const response = await fetch(config.baseUrl + '/api/agent/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive',
      },
      body: JSON.stringify({
        userPrompt: testCase.prompt,
        projectPath,
        projectId: 'phase1-' + phase + '-' + testCase.id + '-run-' + runNumber,
        chatHistory: [],
        projectFiles: [],
        copilotDirector: true,
        permissionLevel: 'auto',
        preferredModel: config.preferredModel,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    httpStatus = response.status;
    if (!response.ok) {
      const body = await response.text();
      throw new Error('Generation endpoint returned HTTP ' + response.status + ': ' + body.slice(0, 1000));
    }
    await collectSse(response, recordEvent);
  } catch (error) {
    requestError = error.message;
  }

  const finishedAt = new Date().toISOString();
  const elapsedMs = Date.now() - start;
  const outputQualityEvents = events.filter((event) => event.type === 'output_quality');
  const terminalEvents = events.filter((event) => ['done', 'director_complete'].includes(event.type));
  const providerModelObservations = events
    .filter((event) => event && (event.provider || event.model))
    .map((event) => ({ provider: event.provider || null, providerName: event.providerName || null, model: event.model || null, fileCount: event.fileCount ?? null, phase: event.phase || null, type: event.type || null }));
  const projectFiles = [];
  const walk = (current, relative) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const abs = path.join(current, entry.name);
      const rel = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else if (entry.isFile()) projectFiles.push({ path: rel, bytes: fs.statSync(abs).size });
    }
  };
  walk(projectPath, '');

  const scan = spawnSync(process.execPath, [
    SCORER_PATH, '--case', testCase.id, '--project-dir', projectPath,
    '--out', path.join(runDir, 'static-diagnostic.json'),
  ], { encoding: 'utf8', timeout: 30000 });

  const metadata = {
    schemaVersion: '1.0',
    evaluator: 'phase-1-live-generation-capture',
    phase,
    revision,
    caseId: testCase.id,
    runNumber,
    prompt: testCase.prompt,
    requiredBehaviors: testCase.requiredBehaviors,
    settings: {
      baseUrl: config.baseUrl,
      preferredModel: config.preferredModel,
      timeoutMs: config.timeoutMs,
      requestedCopilotDirector: true,
      permissionLevel: 'auto',
      actualProviderModelObservations: providerModelObservations,
      actualModelIdentityStatus: providerModelObservations.some((item) => item.model) ? 'OBSERVED' : 'NOT_EXPOSED_BY_GENERATION_EVENT',
      note: 'The generation_provider event identifies the successful scaffold provider. Exact model identity and failed fallback attempts may require backend logs; do not infer them from preferredModel.',
    },
    startedAt,
    finishedAt,
    elapsedMs,
    httpStatus,
    requestError,
    terminalError,
    generationCompleted: terminalEvents.length > 0 && !requestError && !terminalError && projectFiles.length > 0,
    generationCompletionReason: requestError
      ? 'request-failed'
      : terminalError
        ? 'generation-emitted-error'
        : terminalEvents.length === 0
          ? 'no-terminal-event'
          : projectFiles.length === 0
            ? 'terminal-event-without-generated-files'
            : 'terminal-event-and-generated-files-observed',
    outputQuality: outputQualityEvents.at(-1) || null,
    acceptanceStatus: 'NOT_EVALUATED',
    project: { directory: projectPath, fileCount: projectFiles.length, files: projectFiles },
    staticDiagnostic: {
      exitCode: scan.status,
      reportPath: path.join(runDir, 'static-diagnostic.json'),
      stderr: scan.stderr || '',
      interpretation: 'Diagnostic only; not a quality score or behavior proof.',
    },
  };
  writeJson(path.join(runDir, 'metadata.json'), metadata);
  return metadata;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const phase = args.phase;
  if (!['baseline', 'candidate'].includes(phase)) throw new Error('--phase must be baseline or candidate.');
  const baseUrl = ensureLocalUrl(args['base-url'] || process.env.AI_DOST_BASE_URL || '');
  const preferredModel = args['preferred-model'] || process.env.AI_DOST_BENCHMARK_MODEL;
  if (!preferredModel) throw new Error('Set --preferred-model or AI_DOST_BENCHMARK_MODEL to keep model preference explicit and comparable.');
  const revision = args.revision || process.env.AI_DOST_BENCHMARK_REVISION;
  if (!revision) throw new Error('Set --revision or AI_DOST_BENCHMARK_REVISION to record the exact backend code revision.');
  const runs = Number(args.runs || 3);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('--runs must be an integer from 1 to 10.');
  const timeoutMs = Number(args['timeout-ms'] || 12 * 60 * 1000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) throw new Error('--timeout-ms must be an integer of at least 1000.');
  const artifactsDir = path.resolve(args['artifacts-dir'] || path.join(os.tmpdir(), 'ai-dost-phase1-' + Date.now()));
  assertOutsideRepo(artifactsDir);
  fs.mkdirSync(artifactsDir, { recursive: true });

  const casesDoc = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  const selectedCases = args.case ? casesDoc.cases.filter((item) => item.id === args.case) : casesDoc.cases;
  if (!selectedCases.length) {
    throw new Error('Unknown --case ' + args.case + '. Known cases: ' + casesDoc.cases.map((item) => item.id).join(', '));
  }

  const results = [];
  for (const testCase of selectedCases) {
    for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
      console.log('[' + phase + '] ' + testCase.id + ' run ' + runNumber + '/' + runs);
      const result = await runOne({ baseUrl, preferredModel, revision, phase, testCase, runNumber, artifactsDir, timeoutMs });
      results.push(result);
      console.log('  generationCompleted=' + result.generationCompleted + '; files=' + result.project.fileCount +
        '; outputQuality=' + (result.outputQuality?.status || 'NOT_REPORTED') + '; elapsedMs=' + result.elapsedMs);
    }
  }

  const summary = {
    schemaVersion: '1.0',
    evaluator: 'phase-1-live-generation-capture',
    phase,
    revision,
    baseUrl,
    preferredModel,
    runsPerCase: runs,
    caseCount: selectedCases.length,
    expectedRuns: selectedCases.length * runs,
    completedRuns: results.filter((item) => item.generationCompleted).length,
    totalRuns: results.length,
    acceptanceStatus: 'NOT_EVALUATED',
    results: results.map((item) => ({
      caseId: item.caseId,
      runNumber: item.runNumber,
      generationCompleted: item.generationCompleted,
      fileCount: item.project.fileCount,
      elapsedMs: item.elapsedMs,
      outputQuality: item.outputQuality?.status || 'NOT_REPORTED',
      requestError: item.requestError,
      terminalError: item.terminalError,
      runDir: path.dirname(item.project.directory),
    })),
    note: 'Capture and static diagnostics only. Run isolated build/browser tests and requirement-specific checks before assigning any acceptance result.',
  };
  writeJson(path.join(artifactsDir, phase + '-summary.json'), summary);
  console.log('Summary: ' + path.join(artifactsDir, phase + '-summary.json'));
  console.log('Completed generations: ' + summary.completedRuns + '/' + summary.totalRuns + '. Acceptance remains NOT_EVALUATED.');
  if (summary.completedRuns !== summary.totalRuns) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Phase 1 benchmark capture failed: ' + error.message);
    process.exitCode = 2;
  });
}

module.exports = { parseArgs, parseSseFrame, collectSse, ensureLocalUrl };
