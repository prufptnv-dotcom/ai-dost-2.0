'use strict';

const path = require('path');
const crypto = require('crypto');
const { createExecutionGuard } = require('./ProductionExecutionGuard');

const DEFAULT_CAPABILITY_BY_OPERATION = Object.freeze({
  terminal: 'devops.terminal',
  exec_command: 'devops.terminal',
  run_terminal: 'devops.terminal',
  execute_command: 'devops.terminal',
  write_file: 'coding.production_code',
  apply_diff: 'coding.production_code',
  read_file: 'coding.code_explanation',
  list_files: 'coding.code_explanation',
  list_directory: 'coding.code_explanation',
  read_file_tree: 'coding.code_explanation'
});

function stableCapabilities(capabilities = []) {
  return [...new Set(capabilities.filter(Boolean).map(String))].sort();
}

function createScope(context = {}) {
  return {
    requestId: context.requestId || context.request_id || crypto.randomUUID(),
    taskId: context.taskId || context.task_id || null,
    runId: context.runId || context.run_id || null,
    projectId: context.projectId || context.project_id || null,
    userId: context.userId || context.user_id || context.user?.id || null,
    planId: context.planId || context.plan_id || null,
    capabilities: stableCapabilities(context.capabilities || [])
  };
}

function assertWorkspacePath(workspaceManager, value, options = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error('Workspace path is required');
    error.code = 'WORKSPACE_PATH_REQUIRED';
    throw error;
  }
  if (!workspaceManager || typeof workspaceManager.resolvePath !== 'function') return value;

  if (path.isAbsolute(value)) {
    return path.normalize(value);
  }

  const projectId = options.projectId || options.project_id || 'default';
  const userId = options.userId || options.user_id || null;
  return workspaceManager.resolvePath(projectId, value, userId);
}

function createProductionRuntime({ gatekeeper, workspaceManager, audit, limits, correlationId } = {}) {
  const guard = createExecutionGuard({ audit, limits, correlationId });

  function authorize(operation, context = {}) {
    const scope = createScope(context);
    const capabilityId = context.capabilityId || DEFAULT_CAPABILITY_BY_OPERATION[operation] || null;
    const capabilities = stableCapabilities([...(context.capabilities || []), capabilityId]);
    if (!gatekeeper || !capabilities.length) return { scope, capabilities, decision: 'ALLOW' };

    const evaluation = gatekeeper.evaluate(capabilities, {
      user: context.user || (scope.userId ? { id: scope.userId, role: context.role || 'developer' } : null),
      project_id: scope.projectId,
      permissions: context.permissions ?? null
    });
    if (evaluation.decision === 'BLOCK') {
      const error = new Error('Execution blocked by capability policy');
      error.code = 'CAPABILITY_BLOCKED';
      error.evaluation = evaluation;
      throw error;
    }
    if (evaluation.decision !== 'ALLOW') {
      const token = context.approvalToken || context.approval_token;
      if (!token) {
        const error = new Error(`Approval required for ${capabilities.join(', ')}`);
        error.code = 'APPROVAL_REQUIRED';
        error.evaluation = evaluation;
        throw error;
      }
      const validation = gatekeeper.validateApproval({
        token,
        requestId: scope.requestId,
        capabilityIds: capabilities,
        planId: scope.planId || context.taskId,
        user: context.user || (scope.userId ? { id: scope.userId } : null)
      });
      if (!validation || validation.valid !== true) {
        const error = new Error(`Invalid approval: ${validation?.reason || 'validation failed'}`);
        error.code = 'APPROVAL_INVALID';
        throw error;
      }
    }
    return { scope, capabilities, decision: evaluation.decision, evaluation };
  }

  async function execute(operation, input, context = {}, executor) {
    if (typeof executor !== 'function') throw new TypeError('executor must be a function');
    const scope = createScope(context);
    const authorization = authorize(operation, { ...context, requestId: scope.requestId });
    guard.beforeInput(input, scope);
    guard.beforeStep({ ...scope, data: { operation, capabilities: authorization.capabilities } });
    try {
      const output = await executor({
        ...context,
        ...scope,
        capabilities: authorization.capabilities,
        workspacePath: context.workspacePath ? assertWorkspacePath(workspaceManager, context.workspacePath, { projectId: scope.projectId, userId: scope.userId }) : undefined
      }, input);
      guard.beforeOutput(output, scope);
      guard.complete({ ...scope, data: { operation, status: 'SUCCEEDED' } });
      return output;
    } catch (error) {
      guard.fail(error, { ...scope, data: { operation } });
      throw error;
    }
  }

  return { guard, authorize, execute, assertWorkspacePath };
}

module.exports = {
  DEFAULT_CAPABILITY_BY_OPERATION,
  stableCapabilities,
  createScope,
  assertWorkspacePath,
  createProductionRuntime
};
