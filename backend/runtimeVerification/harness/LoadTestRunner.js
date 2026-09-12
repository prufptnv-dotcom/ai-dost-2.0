'use strict';

/**
 * AI-Dost 2.0 — Phase: Runtime Reality & Load Validation Gate
 * 
 * LoadTestRunner
 * 100% native Node.js load-testing harness.
 * Zero npm/npx dependencies. Uses native http.Agent with connection pooling,
 * microsecond latency measurement, and event-loop lag monitoring.
 */

const http = require('http');
const { monitorEventLoopDelay } = require('perf_hooks');

class LoadTestRunner {
  constructor(options = {}) {
    this.targetBaseUrl = options.targetBaseUrl || 'http://127.0.0.1:5000';
    this.timeoutMs = options.timeoutMs || 4000;
  }

  /**
   * Execute a controlled load test stage with defined concurrency
   * @param {Object} stageConfig
   * @param {number} stageConfig.concurrency Number of concurrent virtual users
   * @param {number} stageConfig.durationMs Duration of stage in milliseconds
   * @param {string} stageConfig.path API endpoint path
   * @param {string} [stageConfig.method] HTTP method
   * @param {Object} [stageConfig.headers] Request headers
   * @param {string|Object} [stageConfig.body] Request payload
   * @param {number} [stageConfig.maxErrorRate] Circuit breaker threshold (0 to 1, default 0.25)
   * @returns {Promise<Object>} Detailed stage metrics
   */
  async runStage(stageConfig) {
    const {
      concurrency = 10,
      durationMs = 5000,
      path = '/api/health',
      method = 'GET',
      headers = {},
      body = null,
      maxErrorRate = 0.25
    } = stageConfig;

    const url = new URL(path, this.targetBaseUrl);
    const agent = new http.Agent({
      keepAlive: true,
      maxSockets: concurrency * 2,
      timeout: this.timeoutMs
    });

    const latencies = [];
    const statusDistribution = {};
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let timeoutCount = 0;
    let circuitBroken = false;

    const memBefore = process.memoryUsage();
    const cpuBefore = process.cpuUsage();
    const loopMonitor = monitorEventLoopDelay({ resolution: 20 });
    loopMonitor.enable();

    const stageStart = process.hrtime.bigint();
    const stageEndDeadline = stageStart + BigInt(durationMs * 1_000_000);

    // Single request worker
    const executeRequest = () => {
      return new Promise((resolve) => {
        const reqStart = process.hrtime.bigint();
        const reqPayload = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

        const reqOptions = {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          method,
          agent,
          headers: {
            ...headers,
            'Connection': 'keep-alive',
            ...(reqPayload ? { 'Content-Length': Buffer.byteLength(reqPayload) } : {})
          },
          timeout: this.timeoutMs
        };

        const req = http.request(reqOptions, (res) => {
          let resData = '';
          res.on('data', chunk => { resData += chunk; });
          res.on('end', () => {
            const reqEnd = process.hrtime.bigint();
            const latencyMs = Number(reqEnd - reqStart) / 1_000_000;
            latencies.push(latencyMs);
            totalRequests++;

            const status = res.statusCode;
            statusDistribution[status] = (statusDistribution[status] || 0) + 1;

            if (status >= 200 && status < 400) {
              successfulRequests++;
            } else {
              failedRequests++;
            }
            resolve();
          });
        });

        req.on('timeout', () => {
          req.destroy();
          totalRequests++;
          failedRequests++;
          timeoutCount++;
          statusDistribution['TIMEOUT'] = (statusDistribution['TIMEOUT'] || 0) + 1;
          resolve();
        });

        req.on('error', (err) => {
          totalRequests++;
          failedRequests++;
          const errCode = err.code || 'ERR_UNKNOWN';
          statusDistribution[errCode] = (statusDistribution[errCode] || 0) + 1;
          resolve();
        });

        if (reqPayload) req.write(reqPayload);
        req.end();
      });
    };

    // Concurrency worker loop
    const runWorker = async () => {
      while (process.hrtime.bigint() < stageEndDeadline && !circuitBroken) {
        await executeRequest();

        // Circuit breaker check every 20 requests
        if (totalRequests > 20 && failedRequests / totalRequests > maxErrorRate) {
          circuitBroken = true;
          break;
        }
      }
    };

    // Spawn workers matching concurrency
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);

    const stageEnd = process.hrtime.bigint();
    const actualDurationMs = Number(stageEnd - stageStart) / 1_000_000;

    loopMonitor.disable();
    agent.destroy();

    const memAfter = process.memoryUsage();
    const cpuAfter = process.cpuUsage(cpuBefore);

    // Compute percentile latencies
    latencies.sort((a, b) => a - b);
    const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.50)] : 0;
    const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const minLatency = latencies.length ? latencies[0] : 0;
    const maxLatency = latencies.length ? latencies[latencies.length - 1] : 0;
    const rps = actualDurationMs > 0 ? (totalRequests / (actualDurationMs / 1000)) : 0;
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) : 0;

    return {
      stage: `${concurrency}_users`,
      concurrency,
      durationMs: actualDurationMs,
      totalRequests,
      successfulRequests,
      failedRequests,
      timeoutCount,
      rps: parseFloat(rps.toFixed(2)),
      errorRate: parseFloat((errorRate * 100).toFixed(2)),
      statusDistribution,
      latencies: {
        minMs: parseFloat(minLatency.toFixed(2)),
        p50Ms: parseFloat(p50.toFixed(2)),
        p95Ms: parseFloat(p95.toFixed(2)),
        p99Ms: parseFloat(p99.toFixed(2)),
        maxMs: parseFloat(maxLatency.toFixed(2))
      },
      eventLoopLag: {
        meanMs: parseFloat((loopMonitor.mean / 1_000_000).toFixed(2)),
        maxMs: parseFloat((loopMonitor.max / 1_000_000).toFixed(2))
      },
      resourceUsage: {
        rssDeltaMb: parseFloat(((memAfter.rss - memBefore.rss) / (1024 * 1024)).toFixed(2)),
        heapUsedMb: parseFloat((memAfter.heapUsed / (1024 * 1024)).toFixed(2)),
        cpuUserMs: Math.round(cpuAfter.user / 1000),
        cpuSystemMs: Math.round(cpuAfter.system / 1000)
      },
      circuitBroken
    };
  }
}

module.exports = { LoadTestRunner };
