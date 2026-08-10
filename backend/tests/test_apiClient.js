const { RobustApiClient, CircuitBreaker, RateLimiter } = require('../services/apiClient');

console.log('🧪 Testing Robust API Client Components\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        console.log(`⏳ ${name}...`);
        await fn();
        console.log(`✅ PASSED: ${name}\n`);
        passed++;
    } catch (e) {
        console.error(`❌ FAILED: ${name} -> ${e.message}\n`);
        failed++;
    }
}

async function runTests() {
    // Test CircuitBreaker
    await test('CircuitBreaker - starts CLOSED', () => {
        const cb = new CircuitBreaker({ failureThreshold: 3 });
        if (cb.getState() !== 'CLOSED') throw new Error('Should start CLOSED');
    });

    await test('CircuitBreaker - opens after threshold failures', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 3, timeout: 1000 });
        
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(() => { throw new Error('fail'); }); } catch (e) {}
        }
        
        if (cb.getState() !== 'OPEN') throw new Error('Should be OPEN after 3 failures');
    });

    await test('CircuitBreaker - transitions to HALF_OPEN after timeout', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, timeout: 50 });
        
        try { await cb.execute(() => { throw new Error('fail'); }); } catch (e) {}
        try { await cb.execute(() => { throw new Error('fail'); }); } catch (e) {}
        
        if (cb.getState() !== 'OPEN') throw new Error('Should be OPEN');
        
        await new Promise(r => setTimeout(r, 100));
        
        try { await cb.execute(() => 'success'); } catch (e) {}
        
        if (cb.getState() !== 'HALF_OPEN') throw new Error('Should be HALF_OPEN after timeout');
    });

    await test('CircuitBreaker - closes after success threshold in HALF_OPEN', async () => {
        const cb = new CircuitBreaker({ failureThreshold: 2, successThreshold: 2, timeout: 50 });
        
        try { await cb.execute(() => { throw new Error('fail'); }); } catch (e) {}
        try { await cb.execute(() => { throw new Error('fail'); }); } catch (e) {}
        
        await new Promise(r => setTimeout(r, 100));
        
        await cb.execute(() => 'success');
        await cb.execute(() => 'success');
        
        if (cb.getState() !== 'CLOSED') throw new Error('Should be CLOSED after 2 successes');
    });

    // Test RateLimiter
    await test('RateLimiter - allows requests under limit', async () => {
        const rl = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
        
        for (let i = 0; i < 5; i++) {
            await rl.acquire();
        }
        
        const status = rl.getStatus();
        if (status.used !== 5) throw new Error('Should track 5 used requests');
        if (status.remaining !== 0) throw new Error('Should have 0 remaining');
    });

    await test('RateLimiter - queues requests over limit', async () => {
        const rl = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
        
        const start = Date.now();
        const promises = [
            rl.acquire(),
            rl.acquire(),
            rl.acquire() // This should wait
        ];
        
        await Promise.all(promises);
        const elapsed = Date.now() - start;
        
        if (elapsed < 900) throw new Error('Third request should have been queued');
    });

    await test('RateLimiter - resets window after time', async () => {
        const rl = new RateLimiter({ maxRequests: 2, windowMs: 100 });
        
        await rl.acquire();
        await rl.acquire();
        
        let status = rl.getStatus();
        if (status.remaining !== 0) throw new Error('Should be at limit');
        
        await new Promise(r => setTimeout(r, 150));
        
        status = rl.getStatus();
        if (status.remaining !== 2) throw new Error('Should reset after window');
    });

    // Test RobustApiClient
    await test('RobustApiClient - handles successful request', async () => {
        // Mock fetch for testing
        global.fetch = async (url, options) => ({
            ok: true,
            status: 200,
            json: async () => ({ choices: [{ message: { content: 'test response' } }] }),
            headers: new Headers()
        });

        const client = new RobustApiClient({ baseUrl: 'https://api.test.com', serviceName: 'Test' });
        const result = await client.post('/chat', { message: 'hello' });
        
        if (!result.success) throw new Error('Should succeed');
        if (result.data.choices[0].message.content !== 'test response') throw new Error('Wrong response');
    });

    await test('RobustApiClient - retries on 429 with exponential backoff', async () => {
        let attempts = 0;
        global.fetch = async (url, options) => {
            attempts++;
            if (attempts < 3) {
                return {
                    ok: false,
                    status: 429,
                    text: async () => 'Rate limited',
                    headers: new Headers()
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ choices: [{ message: { content: 'success after retry' } }] }),
                headers: new Headers()
            };
        };

        const client = new RobustApiClient({ 
            baseUrl: 'https://api.test.com', 
            serviceName: 'Test',
            maxRetries: 3,
            retryDelay: 10
        });
        
        const result = await client.post('/chat', { message: 'hello' });
        
        if (!result.success) throw new Error('Should eventually succeed');
        if (attempts !== 3) throw new Error(`Should retry 3 times, got ${attempts}`);
    });

    await test('RobustApiClient - fails fast on 4xx errors (non-retryable)', async () => {
        global.fetch = async () => ({
            ok: false,
            status: 400,
            text: async () => 'Bad request',
            headers: new Headers()
        });

        const client = new RobustApiClient({ baseUrl: 'https://api.test.com', serviceName: 'Test', maxRetries: 3 });
        
        try {
            await client.post('/chat', { message: 'hello' });
            throw new Error('Should have thrown');
        } catch (error) {
            if (error.status !== 400) throw new Error(`Should have status 400, got ${error.status}`);
            if (error.retryable) throw new Error('400 should not be retryable');
        }
    });

    await test('RobustApiClient - circuit breaker prevents repeated failures', async () => {
        let callCount = 0;
        global.fetch = async () => {
            callCount++;
            throw new Error('Network error');
        };

        const client = new RobustApiClient({ 
            baseUrl: 'https://api.test.com', 
            serviceName: 'Test',
            maxRetries: 0, // No retries for faster test
            retryDelay: 10,
            circuitBreaker: { failureThreshold: 2, timeout: 1000 }
        });
        
        // First call - should fail and count as failure
        try { await client.post('/chat', { message: 'hello' }); } catch (e) {}
        
        // Second call - should fail and open circuit
        try { await client.post('/chat', { message: 'hello' }); } catch (e) {}
        
        // Third call - should fail fast due to open circuit
        try {
            await client.post('/chat', { message: 'hello' });
            throw new Error('Should have thrown');
        } catch (error) {
            if (!error.message.includes('Circuit breaker')) {
                console.log('   Error:', error.message);
                throw new Error('Should be circuit breaker error');
            }
        }
    });

    await test('RobustApiClient - timeout handling', async () => {
        // Create a fetch that never resolves (simulates hanging request)
        global.fetch = async (url, options) => {
            const signal = options?.signal;
            if (signal) {
                return new Promise((resolve, reject) => {
                    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
                    if (signal.aborted) onAbort();
                    signal.addEventListener('abort', onAbort, { once: true });
                });
            }
            // No signal - shouldn't happen in our client
            await new Promise(r => setTimeout(r, 200));
            return { ok: true, status: 200, json: async () => ({}), headers: new Headers() };
        };

        const client = new RobustApiClient({ 
            baseUrl: 'https://api.test.com', 
            serviceName: 'Test',
            timeout: 50,
            maxRetries: 0
        });
        
        try {
            await client.post('/chat', { message: 'hello' });
            throw new Error('Should have thrown');
        } catch (error) {
            if (error.status !== 408 && error.name !== 'AbortError') {
                console.log('   Status:', error.status, 'Error:', error.message, 'Name:', error.name);
                throw new Error('Should be 408 timeout or AbortError');
            }
        }
    });

    // Clean up
    delete global.fetch;

    console.log('=================================================');
    console.log(`📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================\n');

    if (failed > 0) process.exit(1);
}

runTests().catch(err => {
    console.error('💥 Test suite crashed:', err);
    process.exit(1);
});