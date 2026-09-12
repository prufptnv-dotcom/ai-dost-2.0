'use strict';

/**
 * AI-Dost 2.0 — Phase: Runtime Reality, Docker Verification & Load Validation Gate
 * 
 * Barrel export for runtime verification harness, verifiers, and golden fixtures.
 */

const { DockerRuntimeVerifier, DOCKER_STATUS, SENSITIVE_PATTERNS } = require('./harness/DockerRuntimeVerifier');
const { LoadTestRunner } = require('./harness/LoadTestRunner');
const { FailureInjector } = require('./harness/FailureInjector');
const { GOLDEN_SCENARIOS, validateAgainstGolden } = require('./fixtures/goldenOutputFixtures');

module.exports = {
  DockerRuntimeVerifier,
  DOCKER_STATUS,
  SENSITIVE_PATTERNS,
  LoadTestRunner,
  FailureInjector,
  GOLDEN_SCENARIOS,
  validateAgainstGolden
};
