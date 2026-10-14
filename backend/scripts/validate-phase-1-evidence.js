#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CASES_PATH = path.join(__dirname, '..', 'quality-evaluation', 'phase-1-cases.json');
const PHASES = ['baseline', 'candidate'];
const CHECKS = ['build', 'tests', 'browserFlows'];
const REVIEW_DIMENSIONS = [
  'requirementCompleteness',
  'functionalCorrectness',
  'visualQuality',
  'responsiveBehavior',
  'accessibility',
  'maintainability',
  'executionIntegrity',
];
const WIDTHS = ['360', '768', '1280'];
const VALID_STATUSES = new Set(['PASS', 'FAIL', 'NOT_EVALUATED']);

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
  if (!args['artifacts-dir']) throw new Error('--artifacts-dir is required.');
  return args;
}

function safeEvidenceFile(runDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath)) return false;
  const normalized = relativePath.replace(/\\/g, '/');
  if (normalized.split('/').includes('..')) return false;
  const resolved = path.resolve(runDir, normalized);
  const lexicalRoot = path.resolve(runDir);
  if (!resolved.startsWith(lexicalRoot + path.sep)) return false;

  // Lexical containment alone does not stop a symlink inside the run directory
  // from pointing at a file outside it. Resolve both paths before accepting evidence.
  try {
    const realRoot = fs.realpathSync(lexicalRoot);
    const realFile = fs.realpathSync(resolved);
    const relativeToRoot = path.relative(realRoot, realFile);
    if (!relativeToRoot || relativeToRoot.startsWith('..' + path.sep) ||
        relativeToRoot === '..' || path.isAbsolute(relativeToRoot)) return false;
    return fs.statSync(realFile).isFile();
  } catch {
    return false;
  }
}

function isPngScreenshot(runDir, relativePath) {
  if (!safeEvidenceFile(runDir, relativePath)) return false;
  try {
    const filePath = path.resolve(runDir, relativePath.replace(/\\\\/g, '/'));
    const header = Buffer.alloc(24);
    const fd = fs.openSync(filePath, 'r');
    let bytesRead;
    try {
      bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (bytesRead !== header.length) return false;
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return header.subarray(0, 8).equals(signature) &&
      header.readUInt32BE(8) === 13 &&
      header.toString('ascii', 12, 16) === 'IHDR' &&
      header.readUInt32BE(16) > 0 &&
      header.readUInt32BE(20) > 0;
  } catch {
    return false;
  }
}

function validateRun(runDir, phase, caseId, runNumber, requiredBehaviors) {
  const errors = [];
  const manifestPath = path.join(runDir, 'runtime-evidence.json');
  if (!fs.existsSync(manifestPath)) {
    return { phase, caseId, runNumber, status: 'INCOMPLETE', errors: ['runtime-evidence.json is missing'], manifestPath };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { phase, caseId, runNumber, status: 'INCOMPLETE', errors: ['runtime-evidence.json is invalid JSON: ' + error.message], manifestPath };
  }

  if (manifest.phase !== phase) errors.push('phase must equal ' + phase);
  if (manifest.caseId !== caseId) errors.push('caseId must equal ' + caseId);
  if (Number(manifest.runNumber) !== runNumber) errors.push('runNumber must equal ' + runNumber);

  for (const check of CHECKS) {
    const record = manifest[check];
    if (!record || !VALID_STATUSES.has(record.status)) {
      errors.push(check + '.status must be PASS, FAIL, or NOT_EVALUATED');
      continue;
    }
    if (record.status === 'PASS' || record.status === 'FAIL') {
      if (!safeEvidenceFile(runDir, record.logPath)) errors.push(check + '.logPath must reference an existing file inside this run directory');
    }
  }

  const screenshots = manifest.screenshots || {};
  for (const width of WIDTHS) {
    if (!isPngScreenshot(runDir, screenshots[width])) {
      errors.push('screenshots.' + width + ' must reference a valid PNG screenshot with an IHDR and non-zero dimensions inside this run directory');
    }
  }

  const requirements = Array.isArray(manifest.requirements) ? manifest.requirements : [];
  if (requirements.length !== requiredBehaviors.length) {
    errors.push('requirements must contain exactly ' + requiredBehaviors.length + ' entries from the canonical case');
  }
  for (const behavior of requiredBehaviors) {
    const entry = requirements.find((item) => item && item.requirement === behavior);
    if (!entry) {
      errors.push('missing canonical requirement: ' + behavior);
      continue;
    }
    if (!VALID_STATUSES.has(entry.status)) errors.push('invalid status for requirement: ' + behavior);
    if (entry.status === 'PASS' || entry.status === 'FAIL') {
      if (!Array.isArray(entry.evidencePaths) || entry.evidencePaths.length === 0 ||
          !entry.evidencePaths.every((file) => safeEvidenceFile(runDir, file))) {
        errors.push('requirement evidence must reference existing files inside this run directory: ' + behavior);
      }
    }
  }

  const review = manifest.humanReview;
  if (!review || !review.dimensions) {
    errors.push('humanReview.dimensions is required');
  } else {
    for (const dimension of REVIEW_DIMENSIONS) {
      const item = review.dimensions[dimension];
      if (!item || !Number.isInteger(item.score) || item.score < 0 || item.score > 5) {
        errors.push('humanReview score must be an integer from 0 to 5: ' + dimension);
      }
      if (!item || typeof item.notes !== 'string' || !item.notes.trim()) {
        errors.push('humanReview notes are required: ' + dimension);
      }
      if (!item || !safeEvidenceFile(runDir, item.evidencePath)) {
        errors.push('humanReview evidencePath must reference an existing file inside this run directory: ' + dimension);
      }
    }
    if (review.blindReview !== true) errors.push('humanReview.blindReview must be true to document baseline/candidate blinding');
  }

  const checksPassed = CHECKS.every((key) => manifest[key]?.status === 'PASS');
  const requirementsPassed = requiredBehaviors.every((behavior) =>
    requirements.some((entry) => entry?.requirement === behavior && entry.status === 'PASS'));
  const reviewComplete = review && review.dimensions &&
    REVIEW_DIMENSIONS.every((dimension) => Number.isInteger(review.dimensions[dimension]?.score));
  const status = errors.length ? 'INCOMPLETE' :
    checksPassed && requirementsPassed && reviewComplete ? 'COMPLETE_FOR_REVIEW' : 'EVIDENCE_RECORDED_WITH_FAILURES_OR_NOT_EVALUATED';

  return {
    phase, caseId, runNumber, status, errors,
    checks: Object.fromEntries(CHECKS.map((key) => [key, manifest[key]?.status || 'MISSING'])),
    requirements: {
      expected: requiredBehaviors.length,
      passed: requirements.filter((entry) => entry?.status === 'PASS').length,
      failed: requirements.filter((entry) => entry?.status === 'FAIL').length,
      notEvaluated: requirements.filter((entry) => entry?.status === 'NOT_EVALUATED').length,
    },
    humanReviewComplete: Boolean(reviewComplete),
    manifestPath,
  };
}

function validateEvidence({ artifactsDir, runs, cases }) {
  const results = [];
  for (const phase of PHASES) {
    for (const testCase of cases) {
      for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
        const runDir = path.join(artifactsDir, phase, testCase.id, 'run-' + runNumber);
        results.push(validateRun(runDir, phase, testCase.id, runNumber, testCase.requiredBehaviors));
      }
    }
  }
  const incomplete = results.filter((item) => item.status === 'INCOMPLETE').length;
  const completeForReview = results.filter((item) => item.status === 'COMPLETE_FOR_REVIEW').length;
  const report = {
    schemaVersion: '1.0',
    evaluator: 'phase-1-runtime-evidence-package-validator',
    evidenceGateStatus: incomplete === 0 && completeForReview === results.length
      ? 'COMPLETE_FOR_HUMAN_QUALITY_REVIEW'
      : 'INCOMPLETE',
    qualityAcceptanceStatus: 'NOT_EVALUATED',
    expectedRuns: results.length,
    completeForReview,
    incomplete,
    runsWithRecordedFailuresOrNotEvaluated: results.filter((item) => item.status === 'EVIDENCE_RECORDED_WITH_FAILURES_OR_NOT_EVALUATED').length,
    runs: results,
    interpretation: [
      'This validator checks evidence package completeness and file provenance, not whether a generated application is correct.',
      'COMPLETE_FOR_HUMAN_QUALITY_REVIEW is not a product-quality pass.',
      'Quality acceptance remains NOT_EVALUATED until reviewers inspect the evidence and record a separate decision.',
    ],
  };
  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactsDir = path.resolve(args['artifacts-dir']);
  const runs = Number(args.runs || 3);
  if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('--runs must be an integer from 1 to 10.');
  const casesDoc = JSON.parse(fs.readFileSync(CASES_PATH, 'utf8'));
  const report = validateEvidence({ artifactsDir, runs, cases: casesDoc.cases });
  const outputPath = path.resolve(args.out || path.join(artifactsDir, 'evidence-validation-report.json'));
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('Evidence validation report: ' + outputPath);
  console.log('Status: ' + report.evidenceGateStatus + '; complete for review: ' + report.completeForReview +
    '/' + report.expectedRuns + '; incomplete: ' + report.incomplete +
    '; quality acceptance: NOT_EVALUATED.');
  if (report.evidenceGateStatus !== 'COMPLETE_FOR_HUMAN_QUALITY_REVIEW') process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Phase 1 evidence validation failed: ' + error.message);
    process.exitCode = 2;
  }
}

module.exports = { parseArgs, safeEvidenceFile, isPngScreenshot, validateRun, validateEvidence, REVIEW_DIMENSIONS, CHECKS };
