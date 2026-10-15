'use strict';

const { createProductionRuntime } = require('./ProductionHardeningRuntime');

/**
 * Central execution boundary for production-sensitive agent operations.
 * Consumers should call executeProductionOperation instead of invoking
 * filesystem/terminal executors directly.
 */
function createProductionOperationExecutor(options = {}) {
  const runtime = createProductionRuntime(options);

  async function executeProductionOperation(operation, input, context, executor) {
    return runtime.execute(operation, input, context, executor);
  }

  return {
    runtime,
    executeProductionOperation
  };
}

module.exports = {
  createProductionOperationExecutor
};
