'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeEvidenceFile, validateRun, validateEvidence, REVIEW_DIMENSIONS } = require('../scripts/validate-phase-1-evidence');

const cases = require('../quality-evaluation/phase-1-cases.json').cases;

function makeRunFixture(t, testCase = cases[0]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runDir = path.join(root, 'candidate', testCase.id, 'run-1');
  fs.mkdirSync(runDir, { recursive: true });
  const write = (relative, text = 'evidence') => {
    const target = path.join(runDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    return relative;
  };
  return { root, runDir, write, testCase };
}

function validManifest(fixture, phase = 'candidate', runNumber = 1) {
  const write = fixture.write;
  const requirements = fixture.testCase.requiredBehaviors.map((requirement, index) => ({
    requirement,
    status: 'PASS',
    evidencePaths: [write('evidence/requirement-' + index + '.txt')],
  }));
  const dimensions = Object.fromEntries(REVIEW_DIMENSIONS.map((dimension) => [dimension, {
    score: 4,
    notes: 'Reviewed against captured artifacts.',
    evidencePath: write('evidence/review-' + dimension + '.txt'),
  }]));
  return {
    phase,
    caseId: fixture.testCase.id,
    runNumber,
    build: { status: 'PASS', logPath: write('logs/build.log') },
    tests: { status: 'PASS', logPath: write('logs/tests.log') },
    browserFlows: { status: 'PASS', logPath: write('logs/browser.log') },
    screenshots: {
      '360': write('screenshots/360.png'),
      '768': write('screenshots/768.png'),
      '1280': write('screenshots/1280.png'),
    },
    requirements,
    humanReview: { blindReview: true, dimensions },
  };
}

describe('Phase 1 runtime evidence package validator', () => {
  test('rejects evidence paths outside the run directory', (t) => {
    const fixture = makeRunFixture(t);
    fixture.write('logs/build.log');
    assert.equal(safeEvidenceFile(fixture.runDir, 'logs/build.log'), true);
    assert.equal(safeEvidenceFile(fixture.runDir, '../../outside.log'), false);
    assert.equal(safeEvidenceFile(fixture.runDir, path.join(os.tmpdir(), 'outside.log')), false);
    assert.equal(safeEvidenceFile(fixture.runDir, 'missing.log'), false);
  });

  test('rejects symlinks that escape the run directory', (t) => {
    const fixture = makeRunFixture(t);
    const outside = path.join(fixture.root, 'outside-evidence.txt');
    fs.writeFileSync(outside, 'not part of this run');
    const link = path.join(fixture.runDir, 'external-evidence.txt');
    fs.symlinkSync(outside, link);
    assert.equal(safeEvidenceFile(fixture.runDir, 'external-evidence.txt'), false);
  });

  test('marks a missing manifest as incomplete', (t) => {
    const fixture = makeRunFixture(t);
    const result = validateRun(fixture.runDir, 'candidate', fixture.testCase.id, 1, fixture.testCase.requiredBehaviors);
    assert.equal(result.status, 'INCOMPLETE');
    assert.match(result.errors[0], /missing/);
  });

  test('marks complete evidence package as review-ready without claiming quality acceptance', (t) => {
    const fixture = makeRunFixture(t);
    const manifest = validManifest(fixture);
    fs.writeFileSync(path.join(fixture.runDir, 'runtime-evidence.json'), JSON.stringify(manifest));
    const result = validateRun(fixture.runDir, 'candidate', fixture.testCase.id, 1, fixture.testCase.requiredBehaviors);
    assert.equal(result.status, 'COMPLETE_FOR_REVIEW');
    assert.deepEqual(result.errors, []);
  });

  test('rejects incomplete screenshots, criterion evidence, or unblinded review', (t) => {
    const fixture = makeRunFixture(t);
    const manifest = validManifest(fixture);
    manifest.screenshots['768'] = 'screenshots/not-present.png';
    manifest.requirements[0].evidencePaths = ['../../outside.txt'];
    manifest.humanReview.blindReview = false;
    fs.writeFileSync(path.join(fixture.runDir, 'runtime-evidence.json'), JSON.stringify(manifest));
    const result = validateRun(fixture.runDir, 'candidate', fixture.testCase.id, 1, fixture.testCase.requiredBehaviors);
    assert.equal(result.status, 'INCOMPLETE');
    assert.ok(result.errors.some((error) => error.includes('screenshots.768')));
    assert.ok(result.errors.some((error) => error.includes('requirement evidence')));
    assert.ok(result.errors.some((error) => error.includes('blindReview')));
  });

  test('full gate requires every baseline and candidate run to be review-ready', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-phase1-gate-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const oneCase = cases[0];
    const report = validateEvidence({ artifactsDir: root, runs: 1, cases: [oneCase] });
    assert.equal(report.expectedRuns, 2);
    assert.equal(report.evidenceGateStatus, 'INCOMPLETE');
    assert.equal(report.qualityAcceptanceStatus, 'NOT_EVALUATED');
    assert.equal(report.incomplete, 2);
  });
});
