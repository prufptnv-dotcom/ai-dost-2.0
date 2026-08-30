const Docker = require('dockerode');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

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
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
    this.ensureDir().catch(() => {});
  }

  // Check Docker availability once (lazy, non-blocking at boot).
  async isDockerAvailable() {
    if (!this._dockerChecked) {
      try {
        await Promise.race([
          docker.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Docker ping timeout')), 5000)),
        ]);
        this._dockerAvailable = true;
      } catch {
        this._dockerAvailable = false;
      }
      this._dockerChecked = true;
    }
    return this._dockerAvailable;
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

  async createSandbox(projectId, options = {}) {
    if (this.containers.size >= MAX_CONTAINERS) {
      await this.cleanup();
      if (this.containers.size >= MAX_CONTAINERS) {
        throw new Error(`Sandbox limit reached (${MAX_CONTAINERS}). Destroy an existing sandbox first.`);
      }
    }

    const available = await this.isDockerAvailable();
    if (!available) {
      throw new Error('Docker is not running. Start Docker Desktop and retry.');
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
      const image = await this.ensureImage(config.image);
      const container = await docker.createContainer({
        Image: config.image,
        WorkingDir: config.workdir,
        HostConfig: {
          Memory: this.parseMemory(config.memory),
          NanoCpus: Math.floor(config.cpus * 1e9),
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
          'ai-dost.sandboxId': sandboxId
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
        createdAt: Date.now(),
        lastActivity: Date.now(),
        ports: new Map(),
        processes: new Map()
      };

      this.containers.set(sandboxId, sandbox);
      this.emit('created', sandbox);
      return sandbox;
    } catch (err) {
      await fs.rm(sandboxPath, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
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

  parseMemory(str) {
    const match = str.match(/^(\d+)([kmg])$/i);
    if (!match) return 1024 * 1024 * 1024;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    return num * ({ k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 }[unit]);
  }

  async exec(sandboxId, cmd, options = {}) {
    const sandbox = this.containers.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox ${sandboxId} not found`);

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

    const inspect = await sandbox.container.inspect();
    const boundPort = inspect.NetworkSettings.Ports[`${containerPort}/tcp`]?.[0]?.HostPort;

    if (boundPort) {
      sandbox.ports.set(containerPort, parseInt(boundPort));
      return { containerPort, hostPort: parseInt(boundPort) };
    }

    // If port not bound, we need to recreate the container (not supported for running containers)
    // For now, return the info that it needs to be specified at creation time
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

  shutdown() {
    clearInterval(this.cleanupInterval);
    for (const id of this.containers.keys()) {
      this.destroy(id);
    }
  }
}

module.exports = new SandboxManager();