const { VerificationContract } = require('../verification/VerificationContract');
const logger = require('../../logger');

const DECISION_OUTCOMES = ['COMPLETE', 'REPAIR', 'WAITING_FOR_USER', 'FAILED'];

const FAILURE_TYPES = [
  'VERIFICATION_FAILED',
  'VERIFICATION_BLOCKED',
  'REPAIR_FAILED',
  'ARBITRATION_FAILED',
  'BUDGET_EXCEEDED',
  'TIMEOUT',
  'SECURITY_DENIED'
];

class SupervisorArbitrator {
  constructor(options = {}) {
    this.maxRepairs = typeof options.maxRepairs === 'number' ? options.maxRepairs : 3;
  }

  /**
   * Arbitrate between Worker Result and Independent Verifier Result.
   * Deterministic arbitration logic (no LLM voting or peer debate).
   *
   * @param {Object} params
   * @param {Object} params.workerResult - Canonical result from Coder/Researcher
   * @param {Object} params.verificationResult - Canonical result from Verifier
   * @param {number} [params.repairAttempts=0] - Current count of repairs performed
   * @param {Object} [params.context={}] - Context metadata (e.g. budget, security flags)
   * @returns {Object} { decision, failureType, reason, repairPayload, shouldWaitUser }
   */
  evaluate({
    workerResult,
    verificationResult,
    repairAttempts = 0,
    context = {}
  }) {
    if (!verificationResult) {
      return {
        decision: 'WAITING_FOR_USER',
        failureType: 'VERIFICATION_BLOCKED',
        reason: 'Missing verification result from independent verifier',
        repairPayload: null,
        shouldWaitUser: true
      };
    }

    // Ensure verificationResult matches contract
    const vResult = VerificationContract.validate(verificationResult);

    // 1. Check budget or security exceptions first
    if (context.budgetExceeded) {
      return {
        decision: 'WAITING_FOR_USER',
        failureType: 'BUDGET_EXCEEDED',
        reason: 'Execution context budget exhausted before verification completion',
        repairPayload: null,
        shouldWaitUser: true
      };
    }

    if (context.securityViolation) {
      return {
        decision: 'FAILED',
        failureType: 'SECURITY_DENIED',
        reason: `Security violation detected: ${context.securityViolation}`,
        repairPayload: null,
        shouldWaitUser: false
      };
    }

    // 2. Case: Verification PASS
    // Strict rule: Even if worker claimed PASS, verifier must independently verify PASS
    if (vResult.status === 'PASS') {
      logger.info(`[SupervisorArbitrator] Independent verification PASSED (confidence: ${vResult.confidence})`);
      return {
        decision: 'COMPLETE',
        failureType: null,
        reason: vResult.summary || 'All required verification checks passed',
        repairPayload: null,
        shouldWaitUser: false
      };
    }

    // 3. Case: Verification BLOCKED
    if (vResult.status === 'BLOCKED') {
      logger.warn(`[SupervisorArbitrator] Independent verification BLOCKED: ${vResult.summary}`);
      if (repairAttempts >= this.maxRepairs) {
        return {
          decision: 'WAITING_FOR_USER',
          failureType: 'VERIFICATION_BLOCKED',
          reason: `Verification blocked and maximum repair attempts (${this.maxRepairs}) reached: ${vResult.summary}`,
          repairPayload: null,
          shouldWaitUser: true
        };
      }

      return {
        decision: 'REPAIR',
        failureType: 'VERIFICATION_BLOCKED',
        reason: `Verification blocked: ${vResult.summary}. Attempting repair cycle ${repairAttempts + 1}/${this.maxRepairs}`,
        repairPayload: {
          objective: `Unblock verification failure: ${vResult.summary}`,
          failed_checks: vResult.failed_checks,
          evidence_refs: vResult.evidence_refs,
          artifact_refs: vResult.artifact_refs,
          constraints: { repairAttempt: repairAttempts + 1 },
          expected_output: 'Resolved verification blocking condition'
        },
        shouldWaitUser: false
      };
    }

    // 4. Case: Verification FAIL
    // Disagreement handling: Trust independent verifier evidence over worker claims
    logger.warn(`[SupervisorArbitrator] Independent verification FAILED: ${vResult.summary} (failed checks: ${vResult.failed_checks.length})`);

    if (repairAttempts >= this.maxRepairs) {
      logger.warn(`[SupervisorArbitrator] Max repair attempts (${this.maxRepairs}) reached. Transitioning to WAITING_FOR_USER`);
      return {
        decision: 'WAITING_FOR_USER',
        failureType: 'REPAIR_FAILED',
        reason: `Verification failed after ${this.maxRepairs} repair cycles: ${vResult.summary}`,
        repairPayload: null,
        shouldWaitUser: true
      };
    }

    // Dispatch bounded repair cycle
    const nextAttempt = repairAttempts + 1;
    return {
      decision: 'REPAIR',
      failureType: 'VERIFICATION_FAILED',
      reason: `Verification failed on check(s): ${vResult.failed_checks.map(c => c.check_type).join(', ')}. Initiating repair cycle ${nextAttempt}/${this.maxRepairs}`,
      repairPayload: {
        objective: `Fix verification failures: ${vResult.failed_checks.map(c => `${c.check_type}: ${c.message}`).join('; ')}`,
        failed_checks: vResult.failed_checks,
        evidence_refs: vResult.evidence_refs,
        artifact_refs: vResult.artifact_refs,
        constraints: { repairAttempt: nextAttempt, maxRepairs: this.maxRepairs },
        expected_output: 'Corrected code resolving all failed verification checks'
      },
      shouldWaitUser: false
    };
  }
}

module.exports = {
  SupervisorArbitrator,
  DECISION_OUTCOMES,
  FAILURE_TYPES
};
