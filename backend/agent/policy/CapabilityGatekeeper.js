'use strict';

/**
 * AI-Dost 2.0 — Central Capability Risk & Approval Gatekeeper (Phase 3)
 * 
 * The single centralized authority for deciding whether a capability or multi-capability
 * workflow may proceed to execution.
 * 
 * Responsibilities:
 * 1. Read canonical risk, approval, permissions, code diff, verification, and rollback policies
 *    from CapabilityRegistry (the single source of truth).
 * 2. Validate caller permissions against requested capabilities.
 * 3. Validate runtime availability via CapabilityRegistry.isAvailable().
 * 4. Determine overall decision using the Strictest Applicable Policy:
 *    BLOCK > REQUIRE_EXPLICIT_APPROVAL > REQUIRE_CONFIRMATION > ALLOW.
 * 5. Issue cryptographically secure, scoped, time-limited, single-use approval tokens
 *    for CONFIRM and EXPLICIT_APPROVAL workflows.
 * 6. Provide TOCTOU, replay, and concurrency race condition protection.
 * 7. Enforce complete immunity against LLM or user-prompt policy override attempts.
 * 8. Maintain a structured, sanitized audit trail with zero secret leakage.
 * 
 * Gatekeeper decides. Execution engines (TaskScheduler, DiffEngine, Sandbox) execute.
 */

const crypto = require('crypto');
const logger = require('../../logger');
const {
  capabilityRegistry,
  STATUS,
  RISK,
  APPROVAL,
  AVAILABILITY
} = require('../registry/CapabilityRegistry');

const POLICY_VERSION = 'CAPABILITY_POLICY_V1';

const DECISION = Object.freeze({
  ALLOW: 'ALLOW',
  REQUIRE_CONFIRMATION: 'REQUIRE_CONFIRMATION',
  REQUIRE_EXPLICIT_APPROVAL: 'REQUIRE_EXPLICIT_APPROVAL',
  BLOCK: 'BLOCK'
});

const STRICTNESS_RANK = Object.freeze({
  [DECISION.ALLOW]: 1,
  [DECISION.REQUIRE_CONFIRMATION]: 2,
  [DECISION.REQUIRE_EXPLICIT_APPROVAL]: 3,
  [DECISION.BLOCK]: 4
});

const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

class CapabilityGatekeeper {
  constructor(registry = capabilityRegistry, options = {}) {
    this.registry = registry;
    this.policyVersion = options.policyVersion || POLICY_VERSION;
    this.tokenTtlMs = options.tokenTtlMs || DEFAULT_TOKEN_TTL_MS;
    this._approvalTokens = new Map(); // token -> TokenRecord
    this._activeLocks = new Set();    // token -> lock state for concurrency protection
    this._auditLogs = [];             // Bounded circular ring buffer
    this._maxAuditLogs = options.maxAuditLogs || 1000;
  }

  /**
   * Evaluate capabilities against canonical registry policies, permissions, and runtime availability.
   * 
   * @param {object|string[]|string} capabilitiesInput - Discovery result, array of capability IDs, or single ID
   * @param {object} [context] - Execution context (requestId, permissions, runtimeContext, planId)
   * @returns {object} Machine-readable gate decision contract
   */
  evaluate(capabilitiesInput, context = {}) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const requestId = context.requestId || (capabilitiesInput && capabilitiesInput.request_id) || null;
    const runtimeContext = context.runtimeContext || {};
    const callerPermissions = Array.isArray(context.permissions) ? context.permissions : null;
    const planId = context.planId || null;

    // 1. Extract capability IDs deterministically
    const targetIds = this._extractCapabilityIds(capabilitiesInput);

    // 2. Empty capability set (conversational or unmatched request fallback)
    if (targetIds.length === 0) {
      const decisionResult = deepFreeze({
        request_id: requestId,
        decision: DECISION.ALLOW,
        capabilities: [],
        requires_user_action: false,
        approval_token: null,
        expires_at: null,
        policy_version: this.policyVersion,
        timestamp: new Date().toISOString()
      });
      this._recordAudit(decisionResult, startTime, 'UNMATCHED_PASS');
      return decisionResult;
    }

    // 3. Evaluate each individual capability against authoritative CapabilityRegistry
    const evaluatedCaps = [];
    let maxRank = STRICTNESS_RANK[DECISION.ALLOW];
    let overallDecision = DECISION.ALLOW;

    for (const id of targetIds) {
      const cap = this.registry.getCapability(id);

      // Fail-closed on unregistered / unknown capability IDs
      if (!cap) {
        const blockedCap = {
          capability_id: id,
          risk_level: RISK.CRITICAL,
          approval_policy: APPROVAL.BLOCK,
          decision: DECISION.BLOCK,
          available: false,
          missing_permissions: [],
          reason: `Unknown capability '${id}' is not registered in CapabilityRegistry (Fail Closed)`,
          requires_code_diff_gate: false,
          verification_policy: 'NONE',
          rollback_policy: 'NONE'
        };
        evaluatedCaps.push(blockedCap);
        maxRank = STRICTNESS_RANK[DECISION.BLOCK];
        overallDecision = DECISION.BLOCK;
        continue;
      }

      // Check runtime availability
      const availStatus = this.registry.isAvailable(cap.capability_id, runtimeContext);
      const isAvailable = (availStatus === AVAILABILITY.AVAILABLE) || (availStatus && availStatus.available === true);
      const availReason = typeof availStatus === 'string' ? availStatus : (availStatus?.reason || availStatus?.state || 'UNAVAILABLE');

      // Check declared required permissions
      const requiredPerms = Array.isArray(cap.required_permissions) ? cap.required_permissions : [];
      const missingPerms = callerPermissions !== null
        ? requiredPerms.filter(p => !callerPermissions.includes(p))
        : [];

      // Determine individual capability decision
      let capDecision;
      let reason;

      if (cap.status === STATUS.MISSING) {
        capDecision = DECISION.BLOCK;
        reason = `Capability '${cap.capability_id}' is marked MISSING (not implemented)`;
      } else if (cap.status === STATUS.FOUNDATION_ONLY) {
        capDecision = DECISION.BLOCK;
        reason = `Capability '${cap.capability_id}' is marked FOUNDATION_ONLY (cannot execute)`;
      } else if (!isAvailable) {
        capDecision = DECISION.BLOCK;
        reason = `Capability '${cap.capability_id}' is unavailable in current runtime: ${availReason}`;
      } else if (missingPerms.length > 0) {
        capDecision = DECISION.BLOCK;
        reason = `Missing required permission(s): ${missingPerms.join(', ')}`;
      } else if (cap.risk_level === RISK.CRITICAL || cap.approval_policy === APPROVAL.BLOCK) {
        capDecision = DECISION.BLOCK;
        reason = `Capability has CRITICAL risk and is blocked by default policy`;
      } else if (cap.risk_level === RISK.HIGH || cap.approval_policy === APPROVAL.EXPLICIT_APPROVAL) {
        capDecision = DECISION.REQUIRE_EXPLICIT_APPROVAL;
        reason = `Capability has HIGH risk and requires explicit user approval`;
      } else if (cap.risk_level === RISK.MEDIUM || cap.approval_policy === APPROVAL.CONFIRM) {
        capDecision = DECISION.REQUIRE_CONFIRMATION;
        reason = `Capability has MEDIUM risk and requires user confirmation`;
      } else {
        capDecision = DECISION.ALLOW;
        reason = `Capability is LOW risk and authorized for automatic execution`;
      }

      evaluatedCaps.push({
        capability_id: cap.capability_id,
        risk_level: cap.risk_level,
        approval_policy: cap.approval_policy,
        decision: capDecision,
        available: isAvailable,
        missing_permissions: missingPerms,
        reason,
        requires_code_diff_gate: Boolean(cap.requires_code_diff_gate),
        verification_policy: cap.verification_policy || 'NONE',
        rollback_policy: cap.rollback_policy || 'NONE'
      });

      // Track strictest policy
      const rank = STRICTNESS_RANK[capDecision] || 1;
      if (rank > maxRank) {
        maxRank = rank;
        overallDecision = capDecision;
      }
    }

    // 4. Generate scoped single-use approval token if user action is required
    let approvalToken = null;
    let expiresAt = null;
    const requiresUserAction = (overallDecision === DECISION.REQUIRE_CONFIRMATION || overallDecision === DECISION.REQUIRE_EXPLICIT_APPROVAL);

    if (requiresUserAction) {
      const allCapabilityIds = evaluatedCaps.map(c => c.capability_id);
      const tokenRecord = this._createApprovalToken({
        requestId,
        capabilityIds: allCapabilityIds,
        planId: context.planId || null
      });
      approvalToken = tokenRecord.token;
      expiresAt = tokenRecord.expiresAt;
    }

    const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
    const decisionResult = Object.freeze({
      request_id: requestId,
      decision: overallDecision,
      capabilities: Object.freeze(evaluatedCaps.map(c => Object.freeze({ ...c }))),
      requires_user_action: requiresUserAction,
      approval_token: approvalToken,
      expires_at: expiresAt,
      policy_version: this.policyVersion,
      timestamp: new Date().toISOString()
    });

    this._recordAudit(decisionResult, startTime, 'EVALUATION');
    return decisionResult;
  }

  /**
   * Revalidates and consumes an approval token prior to execution.
   * Protects against stale approvals, token replay, modified capability sets, and concurrent execution races.
   * 
   * @param {object} params
   * @param {string} params.token - The approval token
   * @param {string} [params.requestId] - Matching request ID
   * @param {string[]} params.capabilityIds - Exactly requested capability IDs
   * @param {string} [params.planId] - Relevant plan ID
   * @param {object} [params.context] - Runtime context for live re-evaluation
   * @returns {object} { valid: boolean, decision: string, error?: string, reason?: string, code?: string, token_id?: string }
   */
  validateApproval(params) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const { token, requestId, capabilityIds, planId, context = {} } = params || {};

    if (!token || typeof token !== 'string') {
      return { valid: false, code: 'INVALID_TOKEN', reason: 'Approval token must be a non-empty string', error: 'Approval token must be a non-empty string' };
    }

    const record = this._approvalTokens.get(token);
    if (!record) {
      return { valid: false, code: 'TOKEN_NOT_FOUND', reason: 'Unknown or expired approval token', error: 'Unknown or expired approval token' };
    }

    // 1. Replay Protection: Check if already consumed
    if (record.consumed) {
      return { valid: false, code: 'TOKEN_ALREADY_USED', reason: 'Approval token has already been consumed (replay rejected)', error: 'Approval token has already been consumed (replay rejected)' };
    }

    // 2. Expiration Protection: Check TTL
    const now = Date.now();
    if (now > new Date(record.expiresAt).getTime()) {
      return { valid: false, code: 'TOKEN_EXPIRED', reason: 'Approval token has expired', error: 'Approval token has expired' };
    }

    // 3. Concurrency Protection: Check if actively executing
    if (this._activeLocks.has(token)) {
      return { valid: false, code: 'CONCURRENT_EXECUTION_CONFLICT', reason: 'Concurrent execution attempt with the same token is rejected', error: 'Concurrent execution attempt with the same token is rejected' };
    }

    // 4. Scoping Protection: Request ID
    if (requestId && record.requestId && record.requestId !== requestId) {
      return { valid: false, code: 'REQUEST_ID_MISMATCH', reason: `Request ID mismatch: expected '${record.requestId}', got '${requestId}'`, error: `Request ID mismatch: expected '${record.requestId}', got '${requestId}'` };
    }

    // 5. Scoping Protection: Capability Set Integrity
    const providedSorted = Array.isArray(capabilityIds) ? [...capabilityIds].sort() : [];
    if (record.capabilityIds.length !== providedSorted.length ||
        !record.capabilityIds.every((id, idx) => id === providedSorted[idx])) {
      return {
        valid: false,
        code: 'CAPABILITY_SET_MISMATCH',
        reason: `Capability mismatch: approved [${record.capabilityIds.join(', ')}], requested [${providedSorted.join(', ')}]`,
        error: `Capability mismatch: approved [${record.capabilityIds.join(', ')}], requested [${providedSorted.join(', ')}]`
      };
    }

    // 6. Scoping Protection: Plan Integrity
    if (planId && record.planId && record.planId !== planId) {
      return { valid: false, code: 'PLAN_ID_MISMATCH', reason: `Plan ID mismatch: expected '${record.planId}', got '${planId}'`, error: `Plan ID mismatch: expected '${record.planId}', got '${planId}'` };
    }

    // 7. Scoping Protection: Policy Version Integrity
    if (record.policyVersion !== this.policyVersion) {
      return { valid: false, code: 'POLICY_VERSION_MISMATCH', reason: `Policy version mismatch: token has '${record.policyVersion}', current is '${this.policyVersion}'`, error: `Policy version mismatch: token has '${record.policyVersion}', current is '${this.policyVersion}'` };
    }

    // 8. TOCTOU Protection: Re-evaluate live state under lock
    this._activeLocks.add(token);
    try {
      const liveEval = this.evaluate(providedSorted, {
        requestId: record.requestId,
        permissions: context.permissions,
        runtimeContext: context.runtimeContext,
        planId: record.planId
      });

      if (liveEval.decision === DECISION.BLOCK) {
        return {
          valid: false,
          code: 'LIVE_EVALUATION_BLOCKED',
          reason: 'Live security policy re-check failed upon approval validation',
          error: 'Live security policy re-check failed upon approval validation'
        };
      }

      // 9. Single-Use Invalidation: Mark token consumed atomically
      record.consumed = true;
      record.consumedAt = new Date().toISOString();

      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      this._recordAudit({
        request_id: record.requestId,
        decision: DECISION.ALLOW,
        capability_ids: record.capabilityIds,
        approval_state: 'CONSUMED',
        policy_version: this.policyVersion,
        timestamp: record.consumedAt
      }, startTime, 'APPROVAL_CONSUMED');

      return {
        valid: true,
        token_id: token,
        decision: DECISION.ALLOW,
        consumed_at: record.consumedAt,
        duration_ms: Math.round(durationMs * 100) / 100
      };
    } finally {
      this._activeLocks.delete(token);
    }
  }

  /**
   * Internal helper to create a secure, scoped approval token.
   */
  _createApprovalToken(requestId, capabilityIds, planId) {
    if (requestId && typeof requestId === 'object' && !Array.isArray(requestId)) {
      const params = requestId;
      requestId = params.requestId;
      capabilityIds = params.capabilityIds;
      planId = params.planId;
    }
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = new Date(now + this.tokenTtlMs).toISOString();

    const record = {
      token,
      requestId: requestId || null,
      capabilityIds: [...capabilityIds].sort(),
      planId: planId || null,
      policyVersion: this.policyVersion,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      consumed: false,
      consumedAt: null
    };

    this._approvalTokens.set(token, record);

    // Prune expired tokens if map grows large
    if (this._approvalTokens.size > 1000) {
      const currentTime = Date.now();
      for (const [k, v] of this._approvalTokens.entries()) {
        if (currentTime > new Date(v.expiresAt).getTime() || v.consumed) {
          this._approvalTokens.delete(k);
        }
      }
    }

    return record;
  }

  /**
   * Extract capability IDs from various input structures deterministically.
   */
  _extractCapabilityIds(input) {
    if (!input) return [];

    if (typeof input === 'string') {
      return input.trim() ? [input.trim()] : [];
    }

    if (Array.isArray(input)) {
      const ids = new Set();
      for (const item of input) {
        if (typeof item === 'string' && item.trim()) {
          ids.add(item.trim());
        } else if (item && typeof item === 'object') {
          const cid = item.capability_id || item.id;
          if (typeof cid === 'string' && cid.trim()) {
            ids.add(cid.trim());
          }
        }
      }
      return Array.from(ids).sort();
    }

    if (typeof input === 'object') {
      const ids = new Set();
      if (Array.isArray(input.matched)) {
        for (const m of input.matched) {
          const cid = m && (m.capability_id || m.id);
          if (typeof cid === 'string' && cid.trim()) ids.add(cid.trim());
        }
      }
      if (Array.isArray(input.unavailable_capabilities)) {
        for (const u of input.unavailable_capabilities) {
          const cid = typeof u === 'string' ? u : (u && (u.capability_id || u.id));
          if (typeof cid === 'string' && cid.trim()) ids.add(cid.trim());
        }
      }
      if (Array.isArray(input.dependencies)) {
        for (const d of input.dependencies) {
          const cid = typeof d === 'string' ? d : (d && (d.capability_id || d.id));
          if (typeof cid === 'string' && cid.trim()) ids.add(cid.trim());
        }
      }
      const topCid = input.capability_id || input.id;
      if (typeof topCid === 'string' && topCid.trim()) {
        ids.add(topCid.trim());
      }
      return Array.from(ids).sort();
    }

    return [];
  }

  /**
   * Structured, sanitized audit logger (guarantees zero secret leakage).
   */
  _recordAudit(decisionResult, startTime, eventType = 'EVALUATION') {
    const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
    const auditRecord = {
      event_id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      event_type: eventType,
      request_id: decisionResult.request_id || null,
      decision: decisionResult.decision,
      capability_ids: Array.isArray(decisionResult.capability_ids)
        ? decisionResult.capability_ids
        : (decisionResult.capabilities || []).map(c => c.capability_id),
      risk_levels: (decisionResult.capabilities || []).map(c => c.risk_level),
      requires_user_action: Boolean(decisionResult.requires_user_action),
      policy_version: decisionResult.policy_version || this.policyVersion,
      duration_ms: Math.round(durationMs * 100) / 100,
      timestamp: new Date().toISOString()
    };

    this._auditLogs.push(auditRecord);
    if (this._auditLogs.length > this._maxAuditLogs) {
      this._auditLogs.shift();
    }

    logger.info(`[CapabilityGatekeeper] [${auditRecord.event_type}] Decision: ${auditRecord.decision} for [${auditRecord.capability_ids.join(', ')}] (${auditRecord.duration_ms}ms)`);
  }

  /**
   * Retrieve audit logs with optional filtering.
   */
  getAuditLog(filter = {}) {
    let limit = null;
    let query = {};
    if (typeof filter === 'number') {
      limit = filter;
    } else if (typeof filter === 'object' && filter !== null) {
      query = filter;
      limit = filter.limit || null;
    }
    let logs = [...this._auditLogs];
    if (query.requestId) {
      logs = logs.filter(l => l.request_id === query.requestId);
    }
    if (query.decision) {
      logs = logs.filter(l => l.decision === query.decision);
    }
    if (query.eventType) {
      logs = logs.filter(l => l.event_type === query.eventType);
    }
    if (limit && limit > 0) {
      logs = logs.slice(0, limit);
    }
    return logs;
  }

  /**
   * Testing helper to reset internal state.
   */
  clearState() {
    this._approvalTokens.clear();
    this._activeLocks.clear();
    this._auditLogs = [];
  }
}

// Export singleton instance + class + constants
const capabilityGatekeeper = new CapabilityGatekeeper();

module.exports = {
  CapabilityGatekeeper,
  capabilityGatekeeper,
  POLICY_VERSION,
  DECISION,
  GATE_DECISION: DECISION
};
