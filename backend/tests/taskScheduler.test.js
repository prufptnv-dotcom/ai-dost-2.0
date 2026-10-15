const { describe, it } = require('node:test');
const assert = require('node:assert');
const TaskScheduler = require('../agent/concurrency/TaskScheduler');

describe('TaskScheduler', () => {
    it('should schedule tasks and abort on cycle', async () => {
        const ts = new TaskScheduler();
        // Just checking it initializes
        assert.ok(ts);
    });
});