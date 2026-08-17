const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execPromise = promisify(exec);
const logger = require('../logger');

class SandboxManager {
  constructor(projectId, projectPath) {
    this.projectId = projectId;
    this.projectPath = path.resolve(projectPath);
    this.containerName = `ai-dost-sandbox-${projectId}`;
    this.image = 'node:20-alpine';
  }

  async start() {
    try {
      logger.info(`[Sandbox] Starting container ${this.containerName} for project ${this.projectId}`);
      // Clean up any existing container with the same name
      await execPromise(`docker rm -f ${this.containerName}`).catch(() => {});
      
      // We will mount projectPath to /workspace
      // We use 'tail -f /dev/null' to keep the alpine container running indefinitely
      const cmd = `docker run -d --name ${this.containerName} -v "${this.projectPath}:/workspace" -w /workspace ${this.image} tail -f /dev/null`;
      await execPromise(cmd);
      logger.info(`[Sandbox] Container ${this.containerName} started successfully`);
    } catch (error) {
      logger.error(`[Sandbox] Failed to start container: ${error.message}`);
      throw new Error(`Sandbox creation failed: ${error.message}`);
    }
  }

  async executeCommand(command, timeoutMs = 20000) {
    return new Promise((resolve) => {
      // Escape the command for shell execution inside docker
      // Using base64 encoding to avoid quoting hell inside shell
      const b64Cmd = Buffer.from(`cd /workspace && ${command}`).toString('base64');
      const dockerCmd = `docker exec ${this.containerName} sh -c "echo ${b64Cmd} | base64 -d | sh"`;
      
      exec(dockerCmd, { timeout: timeoutMs }, (err, stdout, stderr) => {
        const exitCode = err ? (err.code !== undefined ? err.code : 1) : 0;
        resolve({
          success: exitCode === 0,
          exit_code: exitCode,
          stdout: stdout || '',
          stderr: stderr || '',
          error: err ? err.message : null
        });
      });
    });
  }

  async stop() {
    try {
      logger.info(`[Sandbox] Stopping container ${this.containerName}`);
      await execPromise(`docker rm -f ${this.containerName}`);
      logger.info(`[Sandbox] Container ${this.containerName} stopped and removed`);
    } catch (error) {
      logger.warn(`[Sandbox] Failed to stop container: ${error.message}`);
    }
  }
}

module.exports = SandboxManager;
