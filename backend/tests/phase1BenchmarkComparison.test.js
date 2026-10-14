'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { compareSummaries } = require('../scripts/compare-phase-1-benchmark');

function writeRun(root, revision, elapsedMs, fileCount, bytes, signals, placeholders, provider = 'gemini') {
  fs.mkdirSync(root, { recursive: true });
  const projectDir = path.join(root, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
  const files = Array.from({ length: fileCount }, (_, index) => ({
    path: 'src/App' + index + '.jsx',
    bytes: Math.floor(bytes / Math.max(fileCount, 1)),
  }));
  const metadata = {
    revision,
    prompt: 'Build a test app',
    settings: {
      preferredModel: 'gemini',
      actualProviderModelObservations: [{ provider, model: null }],
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
      phase: 'baseline', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini',
      results: [baselineRun],
    };
    const candidate = {
      phase: 'candidate', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini',
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

  test('rejects an uncontrolled preferred-model comparison', () => {
    assert.throws(() => compareSummaries({
      phase: 'baseline', runsPerCase: 1, caseCount: 1, preferredModel: 'gemini', results: [],
    }, {
      phase: 'candidate', runsPerCase: 1, caseCount: 1, preferredModel: 'groq', results: [],
    }), /preferred-model settings differ/);
  });
});
