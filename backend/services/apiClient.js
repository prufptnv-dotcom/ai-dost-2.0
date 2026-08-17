const logger = require('../logger');

class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.successThreshold = options.successThreshold || 2;
        this.timeout = options.timeout || 60000;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED';
    }

    async execute(operation) {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
                logger.info('Circuit breaker: Transitioning to HALF_OPEN');
            } else {
                throw new Error('Circuit breaker OPEN - service unavailable');
            }
        }

        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.state = 'CLOSED';
                this.successCount = 0;
                logger.info('Circuit breaker: CLOSED - service recovered');
            }
        }
    }

    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.successCount = 0;

        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            logger.warn(`Circuit breaker: OPEN - too many failures (${this.failureCount})`);
        }
    }

    getState() {
        return this.state;
    }

    reset() {
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.state = 'CLOSED';
    }
}

class RateLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 10;
        this.windowMs = options.windowMs || 60000;
        this.requests = [];
        this.queue = [];
        this.processing = false;
    }

    async acquire() {
        return new Promise((resolve) => {
            this.queue.push({ resolve, timestamp: Date.now() });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.windowMs);

        if (this.requests.length < this.maxRequests) {
            this.processing = true;
            const { resolve } = this.queue.shift();
            this.requests.push(now);
            this.processing = false;
            resolve();
            this.processQueue();
        } else {
            const oldestRequest = this.requests[0];
            const waitTime = this.windowMs - (now - oldestRequest);
            setTimeout(() => this.processQueue(), Math.max(waitTime, 100));
        }
    }

    getStatus() {
        const now = Date.now();
        this.requests = this.requests.filter(t => now - t < this.windowMs);
        return {
            used: this.requests.length,
            remaining: Math.max(0, this.maxRequests - this.requests.length),
            queued: this.queue.length,
            resetIn: this.requests.length > 0 ? this.windowMs - (now - this.requests[0]) : 0
        };
    }
}

class RobustApiClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || '';
        this.headers = options.headers || {};
        this.timeout = options.timeout || 10000;
        this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
        this.retryDelay = options.retryDelay || 1000;
        this.maxRetryDelay = options.maxRetryDelay || 10000;
        this.maxTotalTime = options.maxTotalTime || 20000;
        this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
        this.rateLimiter = new RateLimiter(options.rateLimiter);
        this.serviceName = options.serviceName || 'API';
    }

    async request(endpoint, options = {}) {
        const startTime = Date.now();
        return this.circuitBreaker.execute(async () => {
            await this.rateLimiter.acquire();

            const url = `${this.baseUrl}${endpoint}`;
            const headers = { ...this.headers, ...options.headers };
            const method = options.method || 'GET';
            const body = options.body ? JSON.stringify(options.body) : undefined;

            let lastError;
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                // Stop early if we've exceeded the total time budget
                if (Date.now() - startTime > this.maxTotalTime) {
                    logger.error(`❌ ${this.serviceName} exceeded total time budget (${this.maxTotalTime}ms)`);
                    const budgetError = new Error(`Total time budget exceeded`);
                    budgetError.status = 408;
                    budgetError.retryable = false;
                    throw budgetError;
                }

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                    const response = await fetch(url, {
                        method,
                        headers: {
                            'Content-Type': 'application/json',
                            ...headers
                        },
                        body,
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        logger.info(`✅ ${this.serviceName} request successful`);
                        return { success: true, data, status: response.status };
                    }

                    const errorText = await response.text();
                    
                    if (response.status === 429 || response.status === 503) {
                        // Smart 429 handling: if quota is exhausted permanently (limit: 0)
                        // or retry delay is too long, skip retries and fail fast so
                        // the failover chain can move to the next provider quickly.
                        const isQuotaExhausted = errorText.includes('limit: 0') || 
                                                 errorText.includes('RESOURCE_EXHAUSTED') ||
                                                 errorText.includes('quota exhausted') ||
                                                 errorText.includes('Quota exceeded') ||
                                                 // Daily token budgets (e.g. Groq TPD) won't recover for hours —
                                                 // fail fast so the failover chain moves to the next provider now.
                                                 errorText.includes('tokens per day') ||
                                                 errorText.includes('(TPD)') ||
                                                 errorText.includes('tokens per day (TPD)');
                        
                        const retryAfter = response.headers.get('Retry-After');
                        const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : NaN;
                        
                        // Cap wait time at 3s — long waits slow down failover too much
                        const waitTime = Math.min(
                            isQuotaExhausted ? 0 : (isNaN(retryAfterMs) ? this.calculateBackoff(attempt) : retryAfterMs),
                            3000
                        );
                        
                        if (isQuotaExhausted || waitTime <= 0) {
                            logger.error(`❌ ${this.serviceName} quota exhausted, not retrying (429)`);
                            const quotaError = new Error(errorText);
                            quotaError.status = 429;
                            quotaError.retryable = false;
                            throw quotaError;
                        }
                        
                        logger.warn(`⚠️ ${this.serviceName} rate limited (${response.status}), waiting ${waitTime}ms before retry ${attempt + 1}/${this.maxRetries}`);
                        await this.sleep(waitTime);
                        lastError = { status: response.status, message: errorText, retryable: true };
                        continue;
                    }

                    if (response.status >= 500) {
                        logger.warn(`⚠️ ${this.serviceName} server error (${response.status}), retry ${attempt + 1}/${this.maxRetries}`);
                        await this.sleep(this.calculateBackoff(attempt));
                        lastError = { status: response.status, message: errorText, retryable: true };
                        continue;
                    }

                    logger.error(`❌ ${this.serviceName} client error (${response.status}): ${errorText}`);
                    // Client errors (4xx) are not retryable - throw to trigger circuit breaker
                    const clientError = new Error(errorText);
                    clientError.status = response.status;
                    clientError.retryable = false;
                    throw clientError;

                } catch (error) {
                    if (error.name === 'AbortError') {
                        logger.error(`❌ ${this.serviceName} request timeout`);
                        lastError = { status: 408, message: 'Request timeout', retryable: true };
                    } else if (error.message?.includes('Circuit breaker')) {
                        throw error;
                    } else if (error.status && !error.retryable) {
                        // Client error (4xx) - don't retry, throw immediately
                        throw error;
                    } else {
                        logger.warn(`⚠️ ${this.serviceName} network error: ${error.message}, retry ${attempt + 1}/${this.maxRetries}`);
                        lastError = { status: 0, message: error.message, retryable: true };
                    }

                    if (attempt < this.maxRetries) {
                        await this.sleep(this.calculateBackoff(attempt));
                    }
                }
            }

            logger.error(`❌ ${this.serviceName} failed after ${this.maxRetries + 1} attempts`);
            // Throw error so circuit breaker tracks the failure
            const finalError = new Error(lastError?.message || 'Max retries exceeded');
            finalError.status = lastError?.status || 500;
            finalError.retryable = false;
            finalError.lastError = lastError;
            throw finalError;
        });
    }

    calculateBackoff(attempt) {
        const delay = Math.min(this.retryDelay * Math.pow(2, attempt), this.maxRetryDelay);
        const jitter = Math.random() * 0.3 * delay;
        return Math.floor(delay + jitter);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async post(endpoint, body, headers) {
        return this.request(endpoint, { method: 'POST', body, headers });
    }

    async get(endpoint, headers) {
        return this.request(endpoint, { method: 'GET', headers });
    }

    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }

    getRateLimiterStatus() {
        return this.rateLimiter.getStatus();
    }

    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
}

module.exports = { RobustApiClient, CircuitBreaker, RateLimiter };