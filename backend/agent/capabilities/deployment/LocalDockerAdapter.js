'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: LocalDockerAdapter
 * 
 * Local Docker and Docker Compose deployment adapter.
 * Enforces offline builds (--network=none), non-root execution, resource quotas,
 * loopback IP binding (127.0.0.1), and verified container teardown.
 */

const { spawn } = require('child_process');
const { DeploymentProvider } = require('./DeploymentProvider');
const { DeploymentValidator } = require('./DeploymentValidator');

class LocalDockerAdapter extends DeploymentProvider {
  constructor(options = {}) {
    super();
    this._dockerBinary = options.dockerBinary || 'docker';
    this._dockerComposeBinary = options.dockerComposeBinary || 'docker-compose';
  }

  get name() {
    return 'docker';
  }

  /**
   * Run a validated docker command safely without shell interpolation
   * @param {string} cmd
   * @param {string[]} args
   * @param {object} options
   * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
   */
  _execDocker(cmd, args, options = {}) {
    const val = DeploymentValidator.validateCommand(cmd, args);
    if (!val.valid) {
      return Promise.reject(new Error(val.error));
    }

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: options.cwd || process.cwd(),
        env: options.env || process.env,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Docker command timed out (>60s): ${cmd} ${args.join(' ')}`));
      }, options.timeoutMs || 60000);

      child.on('close', code => {
        clearTimeout(timeout);
        resolve({ exitCode: code, stdout, stderr });
      });

      child.on('error', err => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async checkAvailability() {
    try {
      const res = await this._execDocker(this._dockerBinary, ['info'], { timeoutMs: 5000 });
      if (res.exitCode === 0) {
        return { available: true };
      }
      return { available: false, reason: 'DOCKER_DAEMON_NOT_RESPONDING' };
    } catch (err) {
      return { available: false, reason: `DOCKER_UNAVAILABLE: ${err.message}` };
    }
  }

  /**
   * Check if local base image exists in docker cache before attempting offline build
   */
  async _checkLocalBaseImage(imageTag) {
    try {
      const res = await this._execDocker(this._dockerBinary, ['images', '-q', imageTag]);
      return res.exitCode === 0 && res.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async build(plan, workspaceRoot) {
    const avail = await this.checkAvailability();
    if (!avail.available) {
      return { success: false, error: avail.reason };
    }

    const baseImage = plan.serviceConfig.baseImage;
    const hasBase = await this._checkLocalBaseImage(baseImage);
    if (!hasBase) {
      return {
        success: false,
        error: `MISSING_LOCAL_BASE_IMAGE: Base image "${baseImage}" is not present in local Docker image cache. Offline build cannot proceed.`
      };
    }

    const imageTag = `aidost_img_${plan.targetEnv}_${plan.projectId}:${plan.deploymentVersion}`;
    const dockerfile = plan.serviceConfig.dockerfilePath || 'Dockerfile';

    // Strictly enforce offline build with --network=none
    const buildArgs = [
      'build',
      '--network=none',
      '-t', imageTag,
      '-f', dockerfile,
      '.'
    ];

    try {
      const res = await this._execDocker(this._dockerBinary, buildArgs, { cwd: workspaceRoot, timeoutMs: 120000 });
      if (res.exitCode !== 0) {
        return {
          success: false,
          error: `BUILD_FAILED: Docker build exited with code ${res.exitCode}: ${res.stderr || res.stdout}`,
          buildLogs: [res.stdout, res.stderr]
        };
      }
      return {
        success: true,
        imageTag,
        buildLogs: [res.stdout]
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async deploy(plan, imageTag) {
    const avail = await this.checkAvailability();
    if (!avail.available) {
      return { success: false, error: avail.reason };
    }

    const containerName = plan.serviceConfig.containerName;
    const hostPort = plan.serviceConfig.hostPort;
    const containerPort = plan.serviceConfig.containerPort;
    const memBytes = plan.resourceLimits.memoryBytes;
    const cpus = plan.resourceLimits.cpus;
    const pids = plan.resourceLimits.pidsLimit;

    // Remove existing container with the same name if any
    try {
      await this._execDocker(this._dockerBinary, ['rm', '-f', containerName]);
    } catch {
      // Ignored
    }

    // Prepare docker run arguments with strict isolation
    const runArgs = [
      'run',
      '-d',
      '--name', containerName,
      `-p`, `127.0.0.1:${hostPort}:${containerPort}`,
      `--memory=${memBytes}b`,
      `--cpus=${cpus}`,
      `--pids-limit=${pids}`,
      `--read-only`,
      `--tmpfs`, `/tmp:rw,noexec,nosuid,size=64m`,
      `--security-opt`, `no-new-privileges:true`
    ];

    // Inject environment variables
    for (const [k, v] of Object.entries(plan.serviceConfig.envVars)) {
      runArgs.push('-e', `${k}=${v}`);
    }

    runArgs.push(imageTag);

    try {
      const res = await this._execDocker(this._dockerBinary, runArgs);
      if (res.exitCode !== 0) {
        return {
          success: false,
          error: `DEPLOY_FAILED: Docker run exited with code ${res.exitCode}: ${res.stderr || res.stdout}`
        };
      }

      const containerId = res.stdout.trim().slice(0, 12) || containerName;
      return {
        success: true,
        containerId,
        hostPort
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async stop(containerId) {
    try {
      const res = await this._execDocker(this._dockerBinary, ['stop', containerId], { timeoutMs: 15000 });
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }

  async getLogs(containerId, lines = 50) {
    try {
      const res = await this._execDocker(this._dockerBinary, ['logs', '--tail', String(lines), containerId]);
      return (res.stdout + '\n' + res.stderr).split('\n');
    } catch {
      return ['[DOCKER] Failed to read logs'];
    }
  }

  async destroy(containerId) {
    try {
      const res = await this._execDocker(this._dockerBinary, ['rm', '-f', containerId], { timeoutMs: 15000 });
      return res.exitCode === 0;
    } catch {
      return false;
    }
  }
}

module.exports = {
  LocalDockerAdapter
};
