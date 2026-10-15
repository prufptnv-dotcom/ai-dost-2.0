'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safeEvidenceFile, isPngScreenshot, validateRun, validateEvidence, REVIEW_DIMENSIONS } = require('../scripts/validate-phase-1-evidence');

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

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  const crcInput = chunk.subarray(4, 8 + data.length);
  chunk.writeUInt32BE(testCrc32(crcInput), 8 + data.length);
  return chunk;
}

function testCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validPng(width, height) {
  const zlib = require('node:zlib');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanline = Buffer.alloc(1 + width * 4);
  const rows = Buffer.concat(Array.from({ length: height }, () => scanline));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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
      '360': write('screenshots/360.png', validPng(360, 800)),
      '768': write('screenshots/768.png', validPng(768, 900)),
      '1280': write('screenshots/1280.png', validPng(1280, 900)),
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

  test('rejects text files and invalid PNG headers as screenshots', (t) => {
    const fixture = makeRunFixture(t);
    fixture.write('screenshots/fake.png', 'not a PNG');
    fixture.write('screenshots/bad.png', Buffer.alloc(24));
    fixture.write('screenshots/valid.png', validPng(360, 800));
    assert.equal(isPngScreenshot(fixture.runDir, 'screenshots/fake.png'), false);
    assert.equal(isPngScreenshot(fixture.runDir, 'screenshots/bad.png'), false);
    assert.equal(isPngScreenshot(fixture.runDir, 'screenshots/valid.png', 360), true);
    assert.equal(isPngScreenshot(fixture.runDir, 'screenshots/valid.png', 768), false);
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
    manifest.screenshots['768'] = write('screenshots/not-a-real-image.png', 'not a PNG');
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
