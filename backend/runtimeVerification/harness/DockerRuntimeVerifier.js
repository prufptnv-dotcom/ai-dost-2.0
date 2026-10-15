'use strict';

/**
 * AI-Dost 2.0 — Phase: Runtime Reality & Docker Verification Gate
 * 
 * DockerRuntimeVerifier
 * Orchestrates container builds, startup, health checks, log auditing,
 * and container network verification.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const DOCKER_STATUS = Object.freeze({
  DOCKER_BUILD_VERIFIED: 'DOCKER_BUILD_VERIFIED',
  DOCKER_RUNTIME_VERIFIED: 'DOCKER_RUNTIME_VERIFIED',
  DOCKER_RUNTIME_FAILED: 'DOCKER_RUNTIME_FAILED',
  SKIPPED_MISSING_DOCKER: 'SKIPPED_MISSING_DOCKER',
  PARTIAL_RUNTIME_VERIFICATION: 'PARTIAL_RUNTIME_VERIFICATION'
});

const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/i,                     // Google API keys
  /sk-[a-zA-Z0-9]{32,}/i,                       // OpenAI secret keys
  /gsk_[a-zA-Z0-9]{32,}/i,                      // Groq API keys
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,            // Bearer tokens
  /"password"\s*:\s*"[^"]+"/i,                  // Plaintext passwords in JSON
  /"refreshToken"\s*:\s*"[a-f0-9]{64}"/i        // Plaintext refresh tokens
];

class DockerRuntimeVerifier {
  constructor(options = {}) {
    this.composeFile = options.composeFile || path.resolve(__dirname, '../docker/docker-compose.runtime.yml');
    this.targetPort = options.targetPort || 5050;
    this.containerName = options.containerName || 'aidost_runtime_backend';
    this.baseUrl = `http://127.0.0.1:${this.targetPort}`;
    this.dockerAvailable = null;
  }

  /**
   * Check if Docker CLI and daemon are operational
   * @returns {boolean}
   */
  checkDockerAvailable() {
    try {
      execSync('docker --version', { stdio: 'pipe', timeout: 5000 });
      execSync('docker info', { stdio: 'pipe', timeout: 8000 });
      this.dockerAvailable = true;
      return true;
    } catch (err) {
      this.dockerAvailable = false;
      return false;
    }
  }

  /**
   * Build runtime container images
   * @returns {{ success: boolean, status: string, error?: string }}
   */
  build() {
    if (!this.checkDockerAvailable()) {
      return { success: false, status: DOCKER_STATUS.SKIPPED_MISSING_DOCKER, error: 'Docker daemon unavailable' };
    }

    try {
      execSync(`docker compose -f "${this.composeFile}" build`, {
        stdio: 'pipe',
        timeout: 180000 // 3 min
      });
      return { success: true, status: DOCKER_STATUS.DOCKER_BUILD_VERIFIED };
    } catch (err) {
      return {
        success: false,
        status: DOCKER_STATUS.DOCKER_RUNTIME_FAILED,
        error: err.stderr ? err.stderr.toString() : err.message
      };
    }
  }

  /**
   * Start containers in detached mode
   * @returns {{ success: boolean, status: string, error?: string }}
   */
  up() {
    if (!this.checkDockerAvailable()) {
      return { success: false, status: DOCKER_STATUS.SKIPPED_MISSING_DOCKER, error: 'Docker daemon unavailable' };
    }

    try {
      execSync(`docker compose -f "${this.composeFile}" up -d`, {
        stdio: 'pipe',
        timeout: 60000
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        status: DOCKER_STATUS.DOCKER_RUNTIME_FAILED,
        error: err.stderr ? err.stderr.toString() : err.message
      };
    }
  }

  /**
   * Wait for container to be healthy and responsive on HTTP port
   * @param {number} maxWaitSec
   * @returns {Promise<{ healthy: boolean, latencyMs: number, error?: string }>}
   */
  async waitForHealth(maxWaitSec = 20) {
    const startTime = Date.now();
    const deadline = startTime + maxWaitSec * 1000;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'OK' || json.status === 'ok') {
            return {
              healthy: true,
              latencyMs: Date.now() - startTime,
              healthData: json
            };
          }
        }
      } catch (e) {
        // Container still warming up
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: `Container failed to respond with healthy status within ${maxWaitSec}s`
    };
  }

  /**
   * Inspect container logs and ensure zero secret or credential leakage
   * @returns {{ clean: boolean, leaksDetected: string[], logSample: string }}
   */
  auditLogs() {
    try {
      const logs = execSync(`docker logs ${this.containerName}`, {
        stdio: 'pipe',
        timeout: 10000
      }).toString();

      const leaksDetected = [];
      for (const pattern of SENSITIVE_PATTERNS) {
        const match = logs.match(pattern);
        if (match) {
          leaksDetected.push(`Matched sensitive pattern: ${pattern.toString().slice(0, 20)}...`);
        }
      }

      return {
        clean: leaksDetected.length === 0,
        leaksDetected,
        logLength: logs.length,
        logSample: logs.slice(-500)
      };
    } catch (err) {
      return {
        clean: false,
        leaksDetected: ['Failed to retrieve container logs: ' + err.message],
        logSample: ''
      };
    }
  }

  /**
   * Stop containers and optionally purge volumes
   * @param {boolean} purgeVolumes
   */
  down(purgeVolumes = false) {
    try {
      const flag = purgeVolumes ? '-v' : '';
      execSync(`docker compose -f "${this.composeFile}" down ${flag}`, {
        stdio: 'pipe',
        timeout: 30000
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = {
  DockerRuntimeVerifier,
  DOCKER_STATUS,
  SENSITIVE_PATTERNS
};
