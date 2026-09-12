'use strict';

/**
 * AI-Dost 2.0 — Software Factory Capability (Phase 4F)
 * Canonical Capability: coding.full_stack_delivery
 * 
 * Re-exports the complete autonomous software factory integration:
 * - FactoryContext (schema v1.0.0, deep freeze, immutability)
 * - FactoryValidator (strict offline boundaries, workspace isolation, secrets)
 * - ZipPackager (deterministic ZIP encoder/reader)
 * - FactoryResult (immutable result envelope with standardized statuses)
 * - SoftwareFactoryOrchestrator (master cross-capability coordinator)
 */

const { FactoryContext, FACTORY_CONTEXT_SCHEMA_VERSION } = require('./FactoryContext');
const { FactoryValidator } = require('./FactoryValidator');
const { ZipPackager } = require('./ZipPackager');
const { FactoryResult, FACTORY_STATUS } = require('./FactoryResult');
const { SoftwareFactoryOrchestrator, APPROVAL_TOKEN_TTL_MS } = require('./SoftwareFactoryOrchestrator');

module.exports = {
  FactoryContext,
  FACTORY_CONTEXT_SCHEMA_VERSION,
  FactoryValidator,
  ZipPackager,
  FactoryResult,
  FACTORY_STATUS,
  SoftwareFactoryOrchestrator,
  APPROVAL_TOKEN_TTL_MS
};
