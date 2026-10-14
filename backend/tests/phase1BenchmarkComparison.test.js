'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compareSummaries } = require('../scripts/compare-phase-1-benchmark');

function writeRun(root, revision, elapsedMs, fileCount, bytes, signals, placeholders, provider = 'gemini', model = null) {
  fs.mkdirSync(root, { recursive: true });
  const projectDir = path.join(root, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  const files = Array.from({ length: fileCount }, (_, index) => ({
    path: 'src/App' + index + '.jsx',
    bytes: Math.floor(bytes / Math.max(fileCount, 1)),
  }));
  const pathParts = root.split(path.sep);
  const metadata = {
    phase: pathParts[pathParts.length - 3],
    caseId: pathParts[pathParts.length - 2],
    runNumber: Number(pathParts[pathParts.length - 1].replace(/^run-/, '')),
    revision,
    prompt: 'Build a test app',
    settings: {
      preferredModel: 'gemini',
      actualProviderModelObservations: [{ provider, model }],
    },
    generationCompleted: true,
    directorPathObserved: true,
    generationCompletionReason: 'director-terminal-event-and-generated-files-observed',
    project: { directory: projectDir, fileCount, files },
    elapsedMs,
    outputQuality: { status: 'UNVERIFIED' },
    acceptanceStatus: 'NOT_EVALUATED',
  };
  fs.writeFileSync(path.join(root, 'metadata.json'), JSON.stringify(metadata));
  fs.writeFileSync(path.join(root, 'static-diagnostic.json'), JSON.stringify({
    staticSignals: { observedCount: signals, totalCount: 5 },
    placeholderMarkers: { count: placeholders },
  }));
  return {
    caseId: 'case-a',
    runNumber: 1,
    runDir: root,
    generationCompleted: true,
    fileCount,
    elapsedMs,
    outputQuality: 'UNVERIFIED',
  };
}

describe('compare-phase-1-benchmark', () => {
  test('pairs same-prompt runs and reports diagnostic deltas without a quality verdict', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-compare-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baselineRun = writeRun(path.join(root, 'baseline', 'case-a', 'run-1'), 'baseline-sha', 1000, 1, 100, 2, 1);
    const candidateRun = writeRun(path.join(root, 'candidate', 'case-a', 'run-1'), 'candidate-sha', 1300, 2, 150, 4, 0);
    const baseline = {
      phase: 'baseline', revision: 'baseline-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini',
      results: [baselineRun],
    };
    const candidate = {
      phase: 'candidate', revision: 'candidate-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini',
      results: [candidateRun],
    };

    const report = compareSummaries(baseline, candidate);
    assert.equal(report.comparisonStatus, 'DIAGNOSTIC_ONLY');
    assert.equal(report.acceptanceStatus, 'NOT_EVALUATED');
    assert.equal(report.pairedRuns.length, 1);
    assert.deepEqual(report.pairedRuns[0].deltas, {
      fileCount: 1,
      totalBytes: 50,
      elapsedMs: 300,
      staticSignalsObserved: 2,
      placeholderCount: -1,
    });
    assert.match(report.interpretation.join(' '), /not a quality score/i);
  });

  test('does not claim provider parity when the runtime does not expose the selected provider', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-provider-unknown-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baselineRun = writeRun(path.join(root, 'baseline', 'case-a', 'run-1'), 'baseline-sha', 1000, 1, 100, 2, 0, null);
    const candidateRun = writeRun(path.join(root, 'candidate', 'case-a', 'run-1'), 'candidate-sha', 1100, 1, 100, 2, 0, null);
    const baseline = { phase: 'baseline', revision: 'baseline-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [baselineRun] };
    const candidate = { phase: 'candidate', revision: 'candidate-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [candidateRun] };

    const report = compareSummaries(baseline, candidate);
    assert.equal(report.pairedRuns[0].providerParity, null);
    assert.equal(report.pairedRuns[0].providerParityStatus, 'UNKNOWN');
    assert.equal(report.providerParityCount, 0);
    assert.equal(report.providerParityUnknownCount, 1);
    assert.equal(report.actualModelParityUnknownCount, 1);
    assert.equal(report.pairedRuns[0].actualModelParityStatus, 'UNKNOWN');
    assert.match(report.warnings.join(' '), /not exposed/i);
  });

  test('flags exact model mismatch even when the provider matches', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-model-identity-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baselineRun = writeRun(path.join(root, 'baseline', 'case-a', 'run-1'), 'baseline-sha', 1000, 1, 100, 2, 0, 'gemini', 'gemini-2.5-pro');
    const candidateRun = writeRun(path.join(root, 'candidate', 'case-a', 'run-1'), 'candidate-sha', 1000, 1, 100, 2, 0, 'gemini', 'gemini-2.5-flash');
    const baseline = { phase: 'baseline', revision: 'baseline-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [baselineRun] };
    const candidate = { phase: 'candidate', revision: 'candidate-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [candidateRun] };
    const report = compareSummaries(baseline, candidate);
    assert.equal(report.pairedRuns[0].providerParityStatus, 'MATCH');
    assert.equal(report.pairedRuns[0].actualModelParityStatus, 'MISMATCH');
    assert.equal(report.actualModelMismatchCount, 1);
    assert.match(report.warnings.join(' '), /actual model differs/);
  });

  test('rejects an uncontrolled preferred-model comparison', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-model-mismatch-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baselineRun = writeRun(path.join(root, 'baseline', 'case-a', 'run-1'), 'baseline-sha', 1000, 1, 100, 2, 0);
    const candidateRun = writeRun(path.join(root, 'candidate', 'case-a', 'run-1'), 'candidate-sha', 1000, 1, 100, 2, 0);
    const baseline = { phase: 'baseline', revision: 'baseline-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [baselineRun] };
    const candidate = { phase: 'candidate', revision: 'candidate-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'groq', results: [candidateRun] };
    assert.throws(() => compareSummaries(baseline, candidate), /preferred-model settings differ/);
  });

  test('rejects duplicate case/run pairs instead of silently dropping one', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-duplicate-pair-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baselineRun = writeRun(path.join(root, 'baseline', 'case-a', 'run-1'), 'baseline-sha', 1000, 1, 100, 2, 0);
    const candidateRun = writeRun(path.join(root, 'candidate', 'case-a', 'run-1'), 'candidate-sha', 1000, 1, 100, 2, 0);
    const baseline = { phase: 'baseline', revision: 'baseline-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [baselineRun, baselineRun] };
    const candidate = { phase: 'candidate', revision: 'candidate-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [candidateRun, candidateRun] };
    assert.throws(() => compareSummaries(baseline, candidate), /exactly 1 results/);
  });

  test('rejects summaries whose run metadata revision differs from the declared revision', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-revision-mismatch-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const baselineRun = writeRun(path.join(root, 'baseline', 'case-a', 'run-1'), 'unexpected-sha', 1000, 1, 100, 2, 0);
    const candidateRun = writeRun(path.join(root, 'candidate', 'case-a', 'run-1'), 'candidate-sha', 1000, 1, 100, 2, 0);
    const baseline = { phase: 'baseline', revision: 'baseline-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [baselineRun] };
    const candidate = { phase: 'candidate', revision: 'candidate-sha', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [candidateRun] };
    assert.throws(() => compareSummaries(baseline, candidate), /run revision does not match summary revision/);
  });
});
