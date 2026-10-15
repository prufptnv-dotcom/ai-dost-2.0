/**
 * AI DOST v2.0 - FullStackDelivery Module Index (Phase 4A)
 * 
 * Re-exports the complete 1-Click Full-Stack Delivery capability pipeline:
 * - FullStackDeliveryPlan (versioned plan state machine)
 * - FullStackDeliveryValidator (strict spec/injection/path validation)
 * - FullStackDeliveryResult (standardized response contract)
 * - FullStackDeliveryOrchestrator (end-to-end execution coordinator)
 */

const { FullStackDeliveryPlan, DELIVERY_STAGES, STAGE_STATUS } = require('./FullStackDeliveryPlan');
const { FullStackDeliveryValidator } = require('./FullStackDeliveryValidator');
const { FullStackDeliveryResult, DELIVERY_RESULT_STATUS } = require('./FullStackDeliveryResult');
const { FullStackDeliveryOrchestrator } = require('./FullStackDeliveryOrchestrator');

module.exports = {
  FullStackDeliveryPlan,
  DELIVERY_STAGES,
  STAGE_STATUS,
  FullStackDeliveryValidator,
  FullStackDeliveryResult,
  DELIVERY_RESULT_STATUS,
  FullStackDeliveryOrchestrator
};
