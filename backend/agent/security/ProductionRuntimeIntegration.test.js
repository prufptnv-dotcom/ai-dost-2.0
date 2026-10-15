'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { createProductionOperationExecutor } = require('./ProductionRuntimeIntegration');

describe('ProductionRuntimeIntegration', () => {
  it('routes operations through the production runtime boundary', async () => {
    const events = [];
    const { executeProductionOperation } = createProductionOperationExecutor({
      audit: {
        record(event) {
          events.push(event);
        }
      },
      limits: {
        maxInputBytes: 4096,
        maxOutputBytes: 4096,
        maxSteps: 4
      }
    });

    const result = await executeProductionOperation(
      'read_file',
      { path: 'README.md' },
      { requestId: 'req-integration-1', taskId: 'task-1', projectId: 'project-1' },
      async (scope, input) => ({ ok: true, scope, input })
    );

    assert.equal(result.ok, true);
    assert.equal(result.scope.requestId, 'req-integration-1');
    assert.equal(result.input.path, 'README.md');
    assert.ok(events.some((event) => event.type === 'execution.completed' || event.event === 'execution.completed'));
  });

  it('does not invoke the executor when capability policy blocks', async () => {
    let invoked = false;
    const { executeProductionOperation } = createProductionOperationExecutor({
      gatekeeper: {
        evaluate() {
          return { decision: 'BLOCK' };
        }
      }
    });

    await assert.rejects(
      executeProductionOperation('terminal', { command: 'echo blocked' }, {}, async () => {
        invoked = true;
      }),
      (error) => error.code === 'CAPABILITY_BLOCKED'
    );
    assert.equal(invoked, false);
  });
});
