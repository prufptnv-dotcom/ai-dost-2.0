const { describe, it } = require('node:test');
const assert = require('node:assert');
const lockManager = require('../agent/concurrency/LockManager');

describe('LockManager', () => {
    it('should acquire and release locks', async () => {
        const token = await lockManager.acquire('/foo.js');
        lockManager.release('/foo.js', token);
        assert.ok(true);
    });
});