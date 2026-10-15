const { describe, it } = require('node:test');
const assert = require('node:assert');
const lockManager = require('../agent/concurrency/LockManager');

describe('LockManager', () => {
    it('acquire returns a lock token and release allows re-acquire', async () => {
        const token = await lockManager.acquire('/foo.js', 2000);
        assert.equal(typeof token, 'symbol');
        lockManager.release('/foo.js', token);
        // Lock was freed — a second acquire must succeed immediately
        const token2 = await lockManager.acquire('/foo.js', 2000);
        assert.equal(typeof token2, 'symbol');
        assert.notEqual(token, token2);
        lockManager.release('/foo.js', token2);
    });

    it('second acquire for same key waits until release, then proceeds', async () => {
        const key = '/contended.js';
        const t1 = await lockManager.acquire(key, 5000);
        let secondGranted = false;
        const pending = lockManager.acquire(key, 5000).then((t) => {
            secondGranted = true;
            return t;
        });
        // Give the queued waiter a chance to (incorrectly) resolve
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(secondGranted, false, 'second acquire must wait while lock is held');
        // Releasing the first lock must unblock the waiter
        lockManager.release(key, t1);
        const t2 = await pending;
        assert.equal(secondGranted, true);
        assert.notEqual(t1, t2);
        lockManager.release(key, t2);
    });

    it('wrong-token release is ignored and does not break the owner', async () => {
        const key = '/wrong-token.js';
        const t1 = await lockManager.acquire(key, 2000);
        const bogus = Symbol('bogus');
        lockManager.release(key, bogus); // must be a no-op
        // Lock still held by t1: a competing acquire must not be granted yet
        let granted = false;
        const pending = lockManager.acquire(key, 1000).then((t) => {
            granted = true;
            return t;
        });
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(granted, false);
        lockManager.release(key, t1);
        const t2 = await pending;
        lockManager.release(key, t2);
    });

    it('acquiring different keys does not block each other', async () => {
        const [a, b] = await Promise.all([
            lockManager.acquire('/a.js', 2000),
            lockManager.acquire('/b.js', 2000),
        ]);
        assert.equal(typeof a, 'symbol');
        assert.equal(typeof b, 'symbol');
        lockManager.release('/a.js', a);
        lockManager.release('/b.js', b);
    });
});
