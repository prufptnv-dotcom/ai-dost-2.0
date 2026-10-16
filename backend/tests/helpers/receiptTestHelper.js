'use strict';

/**
 * Test helper for minting execution receipts with controlled or adversarial fields.
 * NOT for production use.
 */

const crypto = require('crypto');
const { computeArtifactHash, canonicalizeReceiptPayload } = require('../../quality-evaluation/generatedAppQualityGate');

const TEST_RUNNER_SECRET = 'aidost-test-runner-secret-key-2026-min16chars';

function mintTestReceipt(details = {}, secret = TEST_RUNNER_SECRET) {
  const timestamp = details.timestamp || new Date().toISOString();
  const payload = {
    runId: String(details.runId || `run-${Date.now()}`),
    artifactHash: String(details.artifactHash || ''),
    runnerId: String(details.runnerId || 'aidost-trusted-runner'),
    command: String(details.command || 'npm test'),
    exitCode: Number(details.exitCode ?? 0),
    tests: {
      testsRun: Number(details.tests?.testsRun || 0),
      testsPassed: Number(details.tests?.testsPassed || 0),
      testsFailed: Number(details.tests?.testsFailed || 0)
    },
    build: {
      success: Boolean(details.build?.success ?? true),
      exitCode: Number(details.build?.exitCode || 0),
      output: String(details.build?.output || '')
    },
    runtime: {
      started: Boolean(details.runtime?.started),
      port: details.runtime?.port ? Number(details.runtime.port) : null
    },
    acceptance: {
      passed: Boolean(details.acceptance?.passed),
      flowsTested: Number(details.acceptance?.flowsTested || details.acceptance?.flowsChecked || 0),
      flowsFailed: Number(details.acceptance?.flowsFailed || 0),
      flows: Array.isArray(details.acceptance?.flows) ? details.acceptance.flows : []
    },
    timestamp
  };

  const canonical = canonicalizeReceiptPayload(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');

  return {
    ...payload,
    receiptSignature: details.receiptSignature || signature
  };
}

function createTestEvidence({ files, runId = 'trusted-run-1', ...details }, secret = TEST_RUNNER_SECRET) {
  const artifactHash = computeArtifactHash(files);
  const receipt = mintTestReceipt({
    runId,
    artifactHash,
    ...details
  }, secret);
  return {
    receipt,
    build: receipt.build,
    tests: receipt.tests,
    runtime: receipt.runtime,
    acceptance: receipt.acceptance,
    artifactHash
  };
}

module.exports = {
  TEST_RUNNER_SECRET,
  mintTestReceipt,
  createTestEvidence
};
