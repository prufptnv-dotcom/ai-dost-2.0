'use strict';

/**
 * AI-Dost Container Execution Adapter
 * Runs untrusted candidate commands inside disposable OS containers with:
 * - non-root identity
 * - network disabled by default
 * - resource limits (memory, cpu, pids)
 * - restricted capabilities (--cap-drop ALL)
 * - no-new-privileges
 * - read-only root with ephemeral tmpfs
 * - strict workspace isolation (only staged workspace mounted)
 * - fail-closed SANDBOX_UNAVAILABLE when isolation is required but unavailable
 */

const { spawn, execSync, spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');

class ContainerExecutionAdapter {
  constructor(options = {}) {
    this.runtime = options.runtime || null; // 'docker' | 'podman' | null
    this.image = options.image || 'node:22-alpine';
    this.defaultTimeoutMs = options.timeoutMs || 15000;
    this.strictIsolation = options.strictIsolation ?? true;
    this._probed = false;
    this._available = false;
  }

  /**
   * Actively probes whether a container runtime is available and responding.
   */
  probeRuntime() {
    if (this._probed && this.runtime) {
      return { available: this._available, runtime: this.runtime };
    }

    const candidates = this.runtime ? [this.runtime] : ['docker', 'podman'];
    for (const bin of candidates) {
      try {
        const res = spawnSync(bin, ['info'], {
          timeout: 2500,
          stdio: 'pipe',
          windowsHide: true
        });
        if (res?.status === 0) {
          this.runtime = bin;
          this._available = true;
          this._probed = true;
          return { available: true, runtime: bin };
        }
      } catch (_) {
        // Container binary not present on host PATH or daemon inactive
      }
    }

    this._available = false;
    this._probed = true;
    return {
      available: false,
      runtime: null,
      reason: 'No operational container runtime (Docker/Podman) is responding on the host.'
    };
  }

  isAvailable() {
    return this.probeRuntime().available;
  }

  /**
   * Executes a command inside a disposable container against a staged workspace.
   */
  async execute({
    stagedDir,
    command,
    args = [],
    timeoutMs = this.defaultTimeoutMs,
    network = 'none',
    memoryLimit = '256m',
    cpus = '1',
    pidsLimit = '64',
    readOnly = true,
    user = '1000:1000'
  }) {
    const probe = this.probeRuntime();

    if (!probe.available) {
      if (this.strictIsolation) {
        return {
          executed: false,
          exitCode: -1,
          stdout: '',
          stderr: 'SANDBOX_UNAVAILABLE: OS container isolation is required but no verified container runtime (Docker/Podman) is available.',
          status: 'SANDBOX_UNAVAILABLE',
          isolation: 'NONE',
          error: 'SANDBOX_UNAVAILABLE: Execution refused because strict container isolation is required.'
        };
      }
      throw new Error('SANDBOX_UNAVAILABLE: Container runtime unavailable.');
    }

    if (!stagedDir || !fs.existsSync(stagedDir)) {
      throw new Error(`INVALID_WORKSPACE: Staged workspace directory "${stagedDir}" does not exist.`);
    }

    // Convert Windows paths to forward slashes for container volume mounting if needed
    const normalizedMountPath = path.resolve(stagedDir).replaceAll('\\', '/');
    const containerNonce = crypto.randomBytes(8).toString('hex');
    const containerName = `aidost-exec-${containerNonce}`;

    // Build hardened container run arguments
    const dockerArgs = [
      'run',
      '--rm',
      `--name=${containerName}`,
      `--network=${network}`,
      `--memory=${memoryLimit}`,
      `--cpus=${cpus}`,
      `--pids-limit=${pidsLimit}`,
      '--security-opt=no-new-privileges',
      '--cap-drop=ALL',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=64m'
    ];

    let executionArgs;
    if (readOnly) {
      // The authoritative source remains read-only; build/test writes go to a
      // disposable tmpfs copy so artifacts cannot be modified in place.
      dockerArgs.push(
        '-v', normalizedMountPath + ':/source:ro',
        '--tmpfs=/workspace:rw,nosuid,size=768m,mode=1777',
        '--read-only'
      );
      executionArgs = [
        '/bin/sh',
        '-lc',
        'cp -R /source/. /workspace/ && cd /workspace && exec "$@"',
        'aidost-exec',
        command,
        ...args
      ];
    } else {
      // Only the staged workspace is writable; keep the container root filesystem read-only.
      dockerArgs.push('-v', normalizedMountPath + ':/workspace:rw', '--read-only');
      executionArgs = [command, ...args];
    }

    dockerArgs.push(
      '-w', readOnly ? '/tmp' : '/workspace',
      '--user=' + user,
      // Sanitize environment: NO host secrets!
      '-e', 'NODE_ENV=test',
      '-e', 'HOME=/tmp',
      '-e', 'TMPDIR=/tmp',
      '-e', 'npm_config_cache=/tmp/npm-cache',
      '-e', 'NPM_CONFIG_CACHE=/tmp/npm-cache',
      '-e', 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      this.image,
      ...executionArgs
    );

    this.lastArgs = dockerArgs;

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(probe.runtime, dockerArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
        try {
          spawnSync(probe.runtime, ['rm', '-f', containerName], { timeout: 3000, windowsHide: true });
        } catch (_) {}
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        if (stdout.length > 64 * 1024) {
          stdout = stdout.slice(0, 64 * 1024) + '\n[OUTPUT_TRUNCATED]';
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        if (stderr.length > 64 * 1024) {
          stderr = stderr.slice(0, 64 * 1024) + '\n[OUTPUT_TRUNCATED]';
        }
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        try {
          spawnSync(probe.runtime, ['rm', '-f', containerName], { timeout: 3000, windowsHide: true });
        } catch (_) {}
        resolve({
          executed: false,
          exitCode: -1,
          stdout,
          stderr: stderr || err.message,
          status: 'EXECUTION_ERROR',
          isolation: 'CONTAINER_ISOLATED',
          error: err.message
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (timedOut) {
          try {
            spawnSync(probe.runtime, ['rm', '-f', containerName], { timeout: 3000, windowsHide: true });
          } catch (_) {}
          resolve({
            executed: true,
            exitCode: -1,
            stdout,
            stderr: (stderr + '\nExecution timed out.').trim(),
            status: 'TIMEOUT',
            isolation: 'CONTAINER_ISOLATED',
            error: 'TIMEOUT'
          });
          return;
        }

        resolve({
          executed: true,
          exitCode: code ?? 0,
          stdout,
          stderr,
          status: code === 0 ? 'PASSED' : 'FAILED',
          isolation: 'CONTAINER_ISOLATED',
          error: code === 0 ? null : `Process exited with code ${code}`
        });
      });
    });
  }
}

/**
 * Injected fake adapter for deterministic unit tests.
 */
class FakeContainerExecutionAdapter {
  constructor(options = {}) {
    this.available = options.available ?? true;
    this.handler = options.handler || null;
    this.calls = [];
  }

  isAvailable() {
    return this.available;
  }

  probeRuntime() {
    return {
      available: this.available,
      runtime: this.available ? 'fake-docker' : null,
      reason: this.available ? null : 'Fake container runtime unavailable'
    };
  }

  async execute(params) {
    this.calls.push(params);
    if (!this.available) {
      return {
        executed: false,
        exitCode: -1,
        stdout: '',
        stderr: 'SANDBOX_UNAVAILABLE: Fake container unavailable.',
        status: 'SANDBOX_UNAVAILABLE',
        isolation: 'NONE',
        error: 'SANDBOX_UNAVAILABLE'
      };
    }

    if (typeof this.handler === 'function') {
      return this.handler(params);
    }

    return {
      executed: true,
      exitCode: 0,
      stdout: 'Fake container execution passed',
      stderr: '',
      status: 'PASSED',
      isolation: 'CONTAINER_ISOLATED',
      error: null
    };
  }
}

module.exports = {
  ContainerExecutionAdapter,
  FakeContainerExecutionAdapter
};
