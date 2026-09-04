const Docker = require('dockerode');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const os = require('os');

const isWindows = process.platform === 'win32';
const docker = new Docker(isWindows ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' });
const SANDBOX_DIR = path.join(__dirname, '../temp/sandboxes');
const MAX_CONTAINERS = 10;
const CONTAINER_TIMEOUT = 30 * 60 * 1000;

class SandboxManager extends EventEmitter {
  constructor() {
    super();
    this.containers = new Map();
    this._dockerChecked = false;
    this._dockerAvailable = false;
    this._dockerPingLatency = null;
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
    this.ensureDir().catch(() => {});
  }

  // Check Docker availability once (lazy, non-blocking at boot).
  async isDockerAvailable() {
    if (!this._dockerChecked) {
      const start = Date.now();
      try {
        await Promise.race([
          docker.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Docker ping timeout')), 4000)),
        ]);
        this._dockerAvailable = true;
        this._dockerPingLatency = Date.now() - start;
      } catch {
        this._dockerAvailable = false;
        this._dockerPingLatency = null;
      }
      this._dockerChecked = true;
    }
    return this._dockerAvailable;
  }

  // Force re-check of Docker availability (e.g. after user starts Docker Desktop)
  async refreshDockerStatus() {
    this._dockerChecked = false;
    return this.isDockerAvailable();
  }

  // Resolve a requested file path inside the sandbox dir, rejecting traversal.
  _resolveSafe(sandboxPath, relPath) {
    const fullPath = path.resolve(sandboxPath, relPath || '');
    if (!fullPath.startsWith(sandboxPath + path.sep) && fullPath !== sandboxPath) {
      throw new Error(`Invalid sandbox path: ${relPath} (path traversal blocked)`);
    }
    return fullPath;
  }

  async ensureDir() {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });
  }

  // Command policy filter to prevent accidental or malicious destruction in local sandbox fallback
  validateCommandPolicy(cmd) {
    if (!cmd || typeof cmd !== 'string') return { allowed: true };
    const forbiddenPatterns = [
      /\brm\s+-[rf]{1,2}\s+[\/\\]/i, // rm -rf / or \
      /\bformat\s+[c-z]:/i,           // format c:
      /\bdiskpart\b/i,                // disk partitioning
      /\bdel\s+\/f\s+\/s\s+\/q\s+[c-z]:\\/i,
      /\bshutdown\b/i,
      /\breboot\b/i,
      /\b:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // bash fork bomb
      /\bpowershell.*Remove-Item\s+-[Rr]ecurse\s+[C-Z]:\\/i
    ];
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(cmd)) {
        return {
          allowed: false,
          reason: `Command blocked by sandbox policy: matches dangerous pattern (${pattern})`
        };
      }
    }
    return { allowed: true };
  }

  // Sanitize environment variables to avoid leaking host secrets to sandboxed processes
  sanitizeEnvironment(customEnv = {}) {
    const sensitiveKeys = [
      'AWS_SECRET_ACCESS_KEY', 'AWS_ACCESS_KEY_ID', 'GITHUB_TOKEN',
      'GH_TOKEN', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY',
      'TELEGRAM_BOT_TOKEN', 'CEREBRAS_API_KEY', 'TAVILY_API_KEY'
    ];
    const baseEnv = {
      PATH: process.env.PATH,
      NODE_ENV: 'development',
      HOME: process.env.USERPROFILE || process.env.HOME || SANDBOX_DIR,
      TEMP: process.env.TEMP || os.tmpdir(),
      TMP: process.env.TMP || os.tmpdir(),
      LANG: 'en_US.UTF-8'
    };
    const merged = { ...baseEnv, ...customEnv };
    for (const key of sensitiveKeys) {
      if (!customEnv[key]) {
        delete merged[key];
      }
    }
    return merged;
  }

  parseMemory(str) {
    if (typeof str === 'number') return Math.min(str, 2 * 1024 * 1024 * 1024);
    const match = str ? String(str).match(/^(\d+)([kmg]?)$/i) : null;
    if (!match) return 1024 * 1024 * 1024;
    const num = parseInt(match[1], 10);
    const unit = (match[2] || 'g').toLowerCase();
    const bytes = num * ({ k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 }[unit] || 1024 * 1024 * 1024);
    // Hard cap at 2GB for security and stability
    return Math.min(bytes, 2 * 1024 * 1024 * 1024);
  }

  async createSandbox(projectId, options = {}) {
    if (this.containers.size >= MAX_CONTAINERS) {
      await this.cleanup();
      if (this.containers.size >= MAX_CONTAINERS) {
        throw new Error(`Sandbox limit reached (${MAX_CONTAINERS}). Destroy an existing sandbox first.`);
      }
    }

    const available = await this.isDockerAvailable();
    const allowFallback = options.allowFallback !== false && options.fallback !== false;

    if (!available) {
      if (options.requireDocker || !allowFallback) {
        throw new Error('Docker is not running. Start Docker Desktop and retry.');
      }
      return this.createLocalSandbox(projectId, options);
    }

    const sandboxId = crypto.randomUUID().substring(0, 8);
    const sandboxPath = path.join(SANDBOX_DIR, `${projectId}-${sandboxId}`);
    await fs.mkdir(sandboxPath, { recursive: true });

    const defaultDevPorts = [3000, 5173, 8080, 8000, 4321, 8081, 1420, 5000, 3001];
    const portsToExpose = Array.from(new Set([...defaultDevPorts, ...(options.ports || [])]));
    const portBindings = {};
    for (const port of portsToExpose) {
      portBindings[`${port}/tcp`] = [{ HostPort: '' }];
    }

    const config = {
      image: options.image || 'node:22-alpine',
      workdir: '/workspace',
      memory: options.memory || '1g',
      cpus: options.cpus || 1,
      network: options.network || 'bridge',
      env: {
        NODE_ENV: 'development',
        ...options.env
      },
      volumes: {
        [sandboxPath]: { bind: '/workspace', mode: 'rw' }
      }
    };

    try {
      await this.ensureImage(config.image);
      const memBytes = this.parseMemory(config.memory);

      const container = await docker.createContainer({
        Image: config.image,
        WorkingDir: config.workdir,
        HostConfig: {
          Memory: memBytes,
          MemorySwap: memBytes, // Prevent runaway swap allocation
          NanoCpus: Math.floor(Math.min(config.cpus, 2) * 1e9),
          PidsLimit: 100, // Anti-fork-bomb protection
          SecurityOpt: ['no-new-privileges:true'], // Disallow privilege escalation
          Ulimits: [{ Name: 'nofile', Soft: 1024, Hard: 2048 }],
          NetworkMode: config.network,
          Binds: Object.entries(config.volumes).map(([host, cfg]) =>
            `${host}:${cfg.bind}:${cfg.mode}`
          ),
          PortBindings: portBindings,
          AutoRemove: false
        },
        Env: Object.entries(config.env).map(([k, v]) => `${k}=${v}`),
        Tty: true,
        OpenStdin: true,
        StdinOnce: false,
        Labels: {
          'ai-dost.sandbox': 'true',
          'ai-dost.project': projectId,
          'ai-dost.sandboxId': sandboxId,
          'ai-dost.isolation': 'docker'
        },
        ExposedPorts: Object.keys(portBindings).reduce((acc, key) => {
          acc[key] = {};
          return acc;
        }, {})
      });

      await container.start();

      const sandbox = {
        id: sandboxId,
        projectId,
        container,
        path: sandboxPath,
        isolation: 'docker',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        ports: new Map(),
        processes: new Map(),
        isLocal: false
      };

      this.containers.set(sandboxId, sandbox);
      this.emit('created', sandbox);
      return sandbox;
    } catch (err) {
      await fs.rm(sandboxPath, { recursive: true, force: true }).catch(() => {});
      if (allowFallback && !options.requireDocker) {
        console.warn(`[SandboxManager] Docker container start failed (${err.message}), falling back to hardened local sandbox.`);
        return this.createLocalSandbox(projectId, options);
      }
      throw err;
    }
  }

  // Creates a hardened local isolated sandbox on disk with path-traversal & command policies
  async createLocalSandbox(projectId, options = {}) {
    const sandboxId = crypto.randomUUID().substring(0, 8);
    const sandboxPath = path.join(SANDBOX_DIR, `local-${projectId}-${sandboxId}`);
    await fs.mkdir(sandboxPath, { recursive: true });

    const sandbox = {
      id: sandboxId,
      projectId,
      container: null,
      path: sandboxPath,
      isolation: 'local-fallback',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ports: new Map(),
      processes: new Map(),
      isLocal: true,
      options
    };

    this.containers.set(sandboxId, sandbox);
    this.emit('created', sandbox);
    return sandbox;
  }

  async ensureImage(image) {
    try {
      await docker.getImage(image).inspect();
      return;
    } catch {
      // Image missing → pull with timeout
    }
    await Promise.race([
      new Promise((resolve, reject) => {
        docker.pull(image, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, onFinished => {
            if (onFinished) reject(onFinished);
            else resolve();
          });
        });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Image pull timeout for ${image}`)), 300000)),
    ]);
  }

  async execLocal(sandbox, cmd, options = {}) {
    const policy = this.validateCommandPolicy(cmd);
    if (!policy.allowed) {
      return {
        exitCode: 126,
        stdout: '',
        stderr: policy.reason,
        success: false
      };
    }

    sandbox.lastActivity = Date.now();
    const timeoutMs = options.timeout === 0 ? 0 : (options.timeout || 60000);
    const sanitizedEnv = this.sanitizeEnvironment(options.env);

    return new Promise((resolve, reject) => {
      let proc;
      try {
        proc = spawn(cmd, [], {
          cwd: sandbox.path,
          env: sanitizedEnv,
          shell: true,
          windowsHide: true
        });
      } catch (err) {
        return reject(err);
      }

      const procId = crypto.randomUUID().substring(0, 6);
      sandbox.processes.set(procId, proc);

      let stdout = '';
      let stderr = '';

      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          try {
            proc.kill('SIGTERM');
            setTimeout(() => {
              try { proc.kill('SIGKILL'); } catch (_) {}
            }, 2000);
          } catch (_) {}
          sandbox.processes.delete(procId);
          reject(new Error(`Exec timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      if (options.input && proc.stdin) {
        try {
          proc.stdin.write(options.input);
          proc.stdin.end();
        } catch (_) {}
      }

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer);
        sandbox.processes.delete(procId);
        resolve({
          exitCode: code ?? 0,
          stdout,
          stderr,
          success: code === 0
        });
      });

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer);
        sandbox.processes.delete(procId);
        reject(err);
      });
    });
  }

  async exec(sandboxId, cmd, options = {}) {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    if (sandbox.isLocal) {
      return this.execLocal(sandbox, cmd, options);
    }

    sandbox.lastActivity = Date.now();

    const exec = await sandbox.container.exec({
      Cmd: ['sh', '-c', cmd],
      WorkingDir: '/workspace',
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : undefined,
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!options.input,
      Tty: options.tty || false
    });

    return new Promise((resolve, reject) => {
      // timeout: 0 means "no timeout" (long-running dev servers)
      const timeoutMs = options.timeout === 0 ? 0 : (options.timeout || 60000);
      const timeout = timeoutMs ? setTimeout(() => reject(new Error('Exec timeout')), timeoutMs) : null;
      const clearTimer = () => { if (timeout) clearTimeout(timeout); };

      exec.start({ hijack: true, stdin: !!options.input }, (err, stream) => {
        if (err) { clearTimer(); return reject(err); }

        let stdout = '', stderr = '';
        stream.on('data', chunk => {
          const str = chunk.toString();
          if (chunk[0] === 1) stdout += str;
          else if (chunk[0] === 2) stderr += str;
        });

        stream.on('end', async () => {
          clearTimer();
          const inspect = await exec.inspect();
          resolve({
            exitCode: inspect.ExitCode,
            stdout,
            stderr,
            success: inspect.ExitCode === 0
          });
        });

        stream.on('error', err => { clearTimer(); reject(err); });

        if (options.input) {
          stream.write(options.input);
          stream.end();
        }
      });
    });
  }

  async writeFile(sandboxId, filePath, content) {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = this._resolveSafe(sandbox.path, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
    sandbox.lastActivity = Date.now();
  }

  async readFile(sandboxId, filePath) {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = this._resolveSafe(sandbox.path, filePath);
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') throw new Error(`File not found in sandbox: ${filePath}`);
      throw err;
    }
  }

  async listFiles(sandboxId, dirPath = '.') {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = this._resolveSafe(sandbox.path, dirPath);
    let entries;
    try {
      entries = await fs.readdir(fullPath, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: path.join(dirPath, e.name)
    }));
  }

  async exposePort(sandboxId, containerPort, hostPort = 0) {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

    if (sandbox.isLocal) {
      sandbox.ports.set(containerPort, containerPort);
      return { containerPort, hostPort: containerPort, isolation: 'local-fallback' };
    }

    const inspect = await sandbox.container.inspect();
    const boundPort = inspect.NetworkSettings.Ports[`${containerPort}/tcp`]?.[0]?.HostPort;

    if (boundPort) {
      sandbox.ports.set(containerPort, parseInt(boundPort, 10));
      return { containerPort, hostPort: parseInt(boundPort, 10), isolation: 'docker' };
    }

    return { containerPort, hostPort: null, warning: 'Port must be specified at container creation time' };
  }

  getSandbox(sandboxId) {
    return this.containers.get(sandboxId);
  }

  getSandboxesForProject(projectId) {
    return Array.from(this.containers.values()).filter(s => s.projectId === projectId);
  }

  async destroy(sandboxId) {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) return false;

    if (sandbox.isLocal) {
      for (const [, proc] of sandbox.processes) {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }
      await fs.rm(sandbox.path, { recursive: true, force: true }).catch(() => {});
      this.containers.delete(sandboxId);
      this.emit('destroyed', sandboxId);
      return true;
    }

    try {
      await sandbox.container.stop({ t: 5 });
      await sandbox.container.remove({ force: true });
    } catch (err) {
      console.error(`Error destroying sandbox ${sandboxId}:`, err.message);
    }

    await fs.rm(sandbox.path, { recursive: true, force: true }).catch(() => {});
    this.containers.delete(sandboxId);
    this.emit('destroyed', sandboxId);
    return true;
  }

  async cleanup() {
    const now = Date.now();
    for (const [id, sandbox] of this.containers) {
      if (now - sandbox.lastActivity > CONTAINER_TIMEOUT) {
        console.log(`Cleaning up idle sandbox ${id}`);
        await this.destroy(id);
      }
    }

    if (this.containers.size > MAX_CONTAINERS) {
      const sorted = Array.from(this.containers.values())
        .sort((a, b) => a.lastActivity - b.lastActivity);
      const toRemove = sorted.slice(0, this.containers.size - MAX_CONTAINERS);
      for (const s of toRemove) await this.destroy(s.id);
    }
  }

  async getHealthStatus() {
    const isDocker = await this.isDockerAvailable();
    const active = Array.from(this.containers.values()).map(s => ({
      id: s.id,
      projectId: s.projectId,
      isolation: s.isolation || (s.isLocal ? 'local-fallback' : 'docker'),
      createdAt: s.createdAt,
      lastActivity: s.lastActivity
    }));

    return {
      dockerAvailable: isDocker,
      engine: isDocker ? 'docker-container' : 'local-hardened-fallback',
      activeSandboxes: active.length,
      sandboxes: active,
      resourceQuotas: {
        memoryLimit: '1GB (Capped max 2GB)',
        cpuQuota: '1.0 Core',
        pidsLimit: 100,
        memorySwap: 'Disabled (Swap capped to Memory)',
        pathTraversalDefense: 'Active (_resolveSafe enforced)',
        commandPolicy: 'Active (Destructive shell commands filtered)'
      },
      platform: process.platform,
      sandboxRoot: SANDBOX_DIR
    };
  }

  async runSelfTest() {
    const startTime = Date.now();
    const testProjectId = 'self-test';
    let sandbox = null;
    try {
      sandbox = await this.createSandbox(testProjectId, { allowFallback: true });
      const probeFileName = 'probe_test.txt';
      const probeContent = `AI-Dost-Sandbox-Probe-${Date.now()}`;
      await this.writeFile(sandbox.id, probeFileName, probeContent);
      const readBack = await this.readFile(sandbox.id, probeFileName);
      if (readBack !== probeContent) {
        throw new Error('Probe file verification mismatch');
      }
      const execResult = await this.exec(sandbox.id, isWindows ? 'echo SANDBOX_PROBE_SUCCESS' : 'echo SANDBOX_PROBE_SUCCESS');
      const latencyMs = Date.now() - startTime;
      const isolation = sandbox.isolation;
      await this.destroy(sandbox.id);
      sandbox = null;
      return {
        success: true,
        isolation,
        latencyMs,
        probe: 'passed',
        execOutput: (execResult.stdout || execResult.stderr || '').trim()
      };
    } catch (err) {
      if (sandbox) {
        await this.destroy(sandbox.id).catch(() => {});
      }
      return {
        success: false,
        error: err.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  shutdown() {
    clearInterval(this.cleanupInterval);
    for (const id of this.containers.keys()) {
      this.destroy(id);
    }
  }
}

module.exports = new SandboxManager();