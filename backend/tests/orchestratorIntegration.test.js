const { describe, it } = require('node:test');
const assert = require('node:assert');
const AgentOrchestrator = require('../agent/orchestrator');

describe('AgentOrchestrator Integration', () => {
    it('should instantiate without errors', () => {
        const orch = new AgentOrchestrator({ projectPath: '/tmp' });
        assert.ok(orch.dependencyGraph);
        assert.ok(orch.taskScheduler);
    });
});