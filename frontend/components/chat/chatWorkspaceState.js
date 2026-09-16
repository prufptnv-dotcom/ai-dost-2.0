'use strict';

/**
 * Creates versioned chat workspace state representing an active task artifact or workspace item.
 */
export function createWorkspaceState({
  type = 'artifact',
  title = '',
  source = 'task-plan',
  payload = {},
  open = true,
  version = 1,
} = {}) {
  return {
    version,
    open,
    type,
    title,
    source,
    payload,
    updatedAt: Date.now(),
  };
}

export default {
  createWorkspaceState,
};
