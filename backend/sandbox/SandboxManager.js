const Docker = require('dockerode');
const fs = require('fs').promises;
const fsSync = require('fs');
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
    this._dockerUnavailableAt = null; // P12.8: negative-cache timestamp (60s TTL)
    // P3 #37: creates in flight — reserved synchronously before the first
    // await so concurrent createSandbox calls cannot both pass the limit check.
    this._pendingCreates = 0;
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.cleanupInterval.unref();
    this.ensureDir().catch(() => {});
  }

  // Check Docker availability once (lazy, non-blocking at boot).
  async isDockerAvailable() {
    // P12.8 (E2E run #14): a NEGATIVE result used to be cached for the ENTIRE
    // backend lifetime — one transient ping failure at the wrong moment (Docker
    // Desktop restarting / named pipe busy) denied every run_terminal of every
    // later run with "Sandbox exec denied: Docker is unavailable" while
    // `docker info` on the same machine was perfectly healthy. Cache positives
    // (docker rarely dies mid-run and containers are already up), but expire
    // negatives after 60s so starting Docker Desktop self-heals without an
    // explicit refreshDockerStatus() call.
    const NEGATIVE_TTL_MS = 60 * 1000;
    if (this._dockerChecked) {
      if (this._dockerAvailable) return true;
      if (this._dockerUnavailableAt && Date.now() - this._dockerUnavailableAt < NEGATIVE_TTL_MS) return false;
      // stale negative → fall through and re-ping
    }
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
      this._dockerUnavailableAt = Date.now();
    }
    this._dockerChecked = true;
    return this._dockerAvailable;
  }

  // Force re-check of Docker availability (e.g. after user starts Docker Desktop)
  async refreshDockerStatus() {
    this._dockerChecked = false;
    this._dockerUnavailableAt = null;
    return this.isDockerAvailable();
  }

  // Resolve a requested file path inside the sandbox dir, rejecting traversal.
  _resolveSafe(sandboxPath, relPath) {
    // Accept Windows-style roots in cross-platform unit tests and callers,
    // even when the process itself runs on POSIX (e.g. GitHub Actions Linux).
    // Select the path implementation from the root syntax, not host OS.
    const win32Path = /^[a-z]:[\\\\/]/i.test(String(sandboxPath || '')) ||
      String(sandboxPath || '').startsWith('\\\\\\\\');
    const pathApi = win32Path ? path.win32 : path;
    const root = pathApi.resolve(String(sandboxPath || ''));
    const requested = String(relPath || '');
    const fullPath = pathApi.resolve(root, requested);
    const relative = pathApi.relative(root, fullPath);
    if (relative === '..' || relative.startsWith('..' + pathApi.sep) || pathApi.isAbsolute(relative)) {
      throw new Error(`Invalid sandbox path: ${relPath} (path traversal blocked)`);
    }
    // Windows-style roots are not native paths on POSIX. Their lexical
    // containment is checked above; native symlink checks apply only when the
    // root is represented by the host filesystem.
    if (win32Path && process.platform !== 'win32') return fullPath;
    // P3 #36: a plain prefix check is fooled by symlinks — a link INSIDE the
    // sandbox pointing outside would pass the check but read/write elsewhere.
    // Resolve the real path of the deepest existing ancestor and require it to
    // stay inside the real sandbox root.
    try {
      const realRoot = fsSync.realpathSync(sandboxPath);
      let probe = fullPath;
      const missing = [];
      while (!fsSync.existsSync(probe)) {
        const parent = path.dirname(probe);
        if (parent === probe) break;
        missing.unshift(path.basename(probe));
        probe = parent;
      }
      let realProbe = fsSync.realpathSync(probe);
      for (const seg of missing) realProbe = path.join(realProbe, seg);
      const inRoot = realProbe === realRoot || realProbe.startsWith(realRoot + path.sep);
      if (!inRoot) {
        throw new Error(`Invalid sandbox path: ${relPath} (symlink escape blocked)`);
      }
    } catch (err) {
      if (err && /symlink escape blocked|path traversal blocked/.test(err.message)) throw err;
      // realpath failures on exotic filesystems fall back to the prefix check above
    }
    return fullPath;
  }

  async ensureDir() {
    await fs.mkdir(SANDBOX_DIR, { recursive: true });
  }

  // Command policy filter to prevent accidental or malicious destruction in local sandbox fallback
  validateCommandPolicy(cmd) {
    if (!cmd || typeof cmd !== 'string') return { allowed: true };
    // P3 #35: this denylist is the shared gate for orchestrator + TerminalTool
    // too (both used a 5-string list before). It is still a denylist — the
    // P0 #6 exec gate (explicit opt-in) remains the primary control.
    const forbiddenPatterns = [
      /\brm\s+-[rf]{1,2}(\s+--[a-z-]+)*\s+[\/\\]/i, // rm -rf / or \ (incl. --no-preserve-root)
      /\brm\s+-[rf]{1,2}(\s+--[a-z-]+)*\s+\.\.(\/|\\)?/i, // rm -rf ..
      /\bformat\s+[c-z]:/i,           // format c:
      /\bdiskpart\b/i,                // disk partitioning
      /\bdel\s+\/[fdirs]+\s+[a-z]:\\/i, // del /f /s /q <any drive>
      /\bshutdown\b/i,
      /\breboot\b/i,
      /\bpoweroff\b/i,
      /\bhalt\b/i,
      /\binit\s+0\b/i,
      /\b:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // bash fork bomb (any spacing)
      /\bpowershell.*Remove-Item\s+-[Rr]ecurse\s+[C-Z]:\\/i,
      /\bRemove-Item\b/i,             // any PowerShell recursive delete in host fallback
      /\brmdir\s+\/s\b/i,
      /\bmkfs\b/i,
      /\bdd\s+if=/i,
      /\bdd\s+.*of=\/dev\/(sd|nvme|hd)/i,
      /\bmount\s+-o\s+remount\b/i,
      />\s*\/dev\/(sd|nvme|hd)[a-z0-9]*\b/i,   // direct disk writes
      /\bbcdedit\b/i,
      /\breg\s+delete\b/i,
      /\bnet\s+user\b/i,
      /\bcurl\b[^|]*\|\s*(ba)?sh/i,   // pipe-to-shell
      /\biwr\b[^|]*\|\s*iex/i,
      /\bwget\b[^|]*\|\s*(ba)?sh/i,
      /\bchmod\s+(-R\s+)?(000|777)\b/i
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

  /**
   * P3 #39 — resolve a caller-supplied workdir (host path) that callers
   * (TerminalTool / orchestrator) always pass as the real project workspace.
   * Only paths under the workspace base (os.tmpdir()) are honoured so an
   * HTTP-supplied `options.workdir` can never point the sandbox at e.g. /etc.
   * Returns null when absent/unsafe → callers fall back to the sandbox dir.
   */
  _resolveWorkdir(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let resolved;
    try { resolved = path.resolve(raw.trim()); } catch (_) { return null; }
    const base = path.resolve(os.tmpdir());
    if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
    if (!fsSync.existsSync(resolved)) return null;
    return resolved;
  }

  async createSandbox(projectId, options = {}) {
    // P3 #37: reserve a slot synchronously — the check and the increment have
    // no await between them, so two concurrent createSandbox calls can no
    // longer both pass the MAX_CONTAINERS check and over-commit.
    if (this.containers.size + this._pendingCreates >= MAX_CONTAINERS) {
      await this.cleanup();
      if (this.containers.size + this._pendingCreates >= MAX_CONTAINERS) {
        throw new Error(`Sandbox limit reached (${MAX_CONTAINERS}). Destroy an existing sandbox first.`);
      }
    }
    this._pendingCreates++;
    try {
      return await this._createSandboxInner(projectId, options);
    } finally {
      this._pendingCreates--;
    }
  }

  async _createSandboxInner(projectId, options = {}) {
    // P3 #39: the real project workspace (host path) — used as the Docker bind
    // mount and the local exec cwd instead of being silently ignored (which
    // left agent commands running in an empty temp dir).
    const hostWorkdir = this._resolveWorkdir(options.workdir);

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

    // Image/network allowlist — never pull arbitrary client-supplied images
    // or attach to sensitive Docker networks (host, none custom, etc.)
    const SAFE_IMAGE = /^(node|python|ubuntu|alpine|nginx)(:[A-Za-z0-9._-]+)?$/;
    const requestedImage = String(options.image || 'node:22-alpine');
    const image = SAFE_IMAGE.test(requestedImage) ? requestedImage : 'node:22-alpine';
    const SAFE_NETWORKS = new Set(['bridge', 'host', 'none']);
    const network = SAFE_NETWORKS.has(String(options.network || 'bridge')) ? String(options.network || 'bridge') : 'bridge';

    // Sanitize env: strip secrets / NODE_OPTIONS / PATH overrides from client input
    const SENSITIVE_ENV = new Set(['PATH', 'NODE_OPTIONS', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'HOME', 'SSH_AUTH_SOCK',
      'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'AWS_SECRET_ACCESS_KEY', 'JWT_SECRET', 'ANTHROPIC_API_KEY']);
    const clientEnv = {};
    for (const [k, v] of Object.entries(options.env || {})) {
      if (!SENSITIVE_ENV.has(String(k).toUpperCase()) && typeof v === 'string' && !v.includes('\0')) {
        clientEnv[k] = v;
      }
    }

    const config = {
      image,
      workdir: '/workspace',
      memory: options.memory || '1g',
      cpus: options.cpus || 1,
      network,
      env: {
        NODE_ENV: 'development',
        ...clientEnv
      },
      // P3 #39: mount the caller's project workspace when provided — the old
      // code always mounted the (empty) fresh temp dir at /workspace.
      volumes: {
        [hostWorkdir || sandboxPath]: { bind: '/workspace', mode: 'rw' }
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
          PidsLimit: 512, // Anti-fork-bomb protection (vite/esbuild/node thread pools exceed 100)
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
        // P3 #39: file ops (writeFile/readFile/listFiles) target the project
        // workspace when one was supplied, so host and container views match.
        path: hostWorkdir || sandboxPath,
        // P3 #38/#39: ONLY the temp dir we created may ever be rm -rf'd — never
        // the caller's project workspace.
        ownedPath: sandboxPath,
        hostWorkdir,
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
    // P3 #39: run local commands in the caller's real project workspace when
    // it is a safe path under the workspace base (see _resolveWorkdir).
    const hostWorkdir = this._resolveWorkdir(options.workdir);

    const sandbox = {
      id: sandboxId,
      projectId,
      container: null,
      path: hostWorkdir || sandboxPath,
      ownedPath: sandboxPath, // P3 #39: temp dir only — never rm the project
      hostWorkdir,
      isolation: 'local-fallback',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ports: new Map(),
      processes: new Map(),
      isLocal: true,
      // P0 FIX (#6): only explicit opt-in grants host-shell exec (see execLocal)
      allowHostExec: options.allowHostExec === true || options.allowFallback === true || process.env.SANDBOX_ALLOW_HOST_EXEC === '1',
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
    // P0 FIX (#6): host-shell execution is only available when the caller
    // EXPLICITLY opted into local fallback (allowFallback/allowHostExec === true)
    // or SANDBOX_ALLOW_HOST_EXEC=1 is set. The denylist below is bypassable, so
    // it must never be the only line of defence on the host.
    const hostExecAllowed =
      sandbox.allowHostExec === true ||
      options.allowHostExec === true ||
      process.env.SANDBOX_ALLOW_HOST_EXEC === '1';
    if (!hostExecAllowed) {
      return {
        exitCode: 126,
        stdout: '',
        stderr: 'Sandbox exec denied: Docker is unavailable and host execution was not explicitly enabled. Start Docker, or create the sandbox with allowFallback:true (trusted local dev) / set SANDBOX_ALLOW_HOST_EXEC=1.',
        success: false
      };
    }

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
          // P3 #39: default to the caller's project workspace when supplied
          // (sandbox.path already prefers hostWorkdir), else the sandbox dir.
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
        const str = data.toString();
        stdout += str;
        if (typeof options.onData === 'function') {
          try { options.onData('stdout', str); } catch (_) {}
        }
      });

      proc.stderr?.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        if (typeof options.onData === 'function') {
          try { options.onData('stderr', str); } catch (_) {}
        }
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

    // Same command policy for Docker + local — was Docker-only before
    const policy = this.validateCommandPolicy(cmd);
    if (!policy.allowed) {
      throw new Error(`Command blocked by policy: ${policy.reason || 'blocked'}`);
    }

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
      let timer = null;
      let stream = null;
      let settled = false;
      const stdout = [];
      const stderr = [];
      const closeTimer = () => { if (timer) clearTimeout(timer); };
      const fail = (error) => {
        if (settled) return;
        settled = true;
        closeTimer();
        reject(error);
      };
      const capture = (channel, target, chunk) => {
        if (!chunk || chunk.length === 0) return;
        const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        target.push(text);
        if (typeof options.onData === 'function') {
          try { options.onData(channel, text); } catch (_) {}
        }
      };

      // Docker uses an 8-byte multiplex header for non-TTY exec output, but
      // some daemon/TTY combinations return raw bytes. Parse frames across
      // arbitrary TCP chunk boundaries and fall back to raw stdout if the
      // initial bytes do not form a valid Docker frame.
      const MAX_FRAME_SIZE = 64 * 1024 * 1024;
      let outputMode = options.tty ? 'raw' : 'detect';
      let pendingOutput = Buffer.alloc(0);

      const processOutput = (chunk) => {
        if (!chunk || chunk.length === 0) return;
        if (outputMode === 'raw') {
          capture('stdout', stdout, chunk);
          return;
        }

        pendingOutput = pendingOutput.length
          ? Buffer.concat([pendingOutput, chunk])
          : Buffer.from(chunk);

        if (outputMode === 'detect') {
          if (pendingOutput.length < 8) return;
          const type = pendingOutput[0];
          const reservedBytesAreZero =
            pendingOutput[1] === 0 &&
            pendingOutput[2] === 0 &&
            pendingOutput[3] === 0;
          const frameSize = pendingOutput.readUInt32BE(4);

          if (
            (type !== 1 && type !== 2) ||
            !reservedBytesAreZero ||
            frameSize > MAX_FRAME_SIZE
          ) {
            outputMode = 'raw';
            capture('stdout', stdout, pendingOutput);
            pendingOutput = Buffer.alloc(0);
            return;
          }
          outputMode = 'multiplexed';
        }

        while (outputMode === 'multiplexed' && pendingOutput.length >= 8) {
          const type = pendingOutput[0];
          const reservedBytesAreZero =
            pendingOutput[1] === 0 &&
            pendingOutput[2] === 0 &&
            pendingOutput[3] === 0;
          const frameSize = pendingOutput.readUInt32BE(4);

          if (
            (type !== 1 && type !== 2) ||
            !reservedBytesAreZero ||
            frameSize > MAX_FRAME_SIZE
          ) {
            // A malformed frame after valid frames should not make us lose
            // any remaining output. Preserve these bytes as stdout.
            outputMode = 'raw';
            capture('stdout', stdout, pendingOutput);
            pendingOutput = Buffer.alloc(0);
            return;
          }

          if (pendingOutput.length < 8 + frameSize) return;
          const payload = pendingOutput.subarray(8, 8 + frameSize);
          capture(type === 2 ? 'stderr' : 'stdout', type === 2 ? stderr : stdout, payload);
          pendingOutput = pendingOutput.subarray(8 + frameSize);
        }
      };

      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (settled) return;
          try { stream?.destroy(); } catch (_) {}
          fail(new Error('Exec timeout'));
        }, timeoutMs);
      }

      exec.start({ hijack: true, stdin: !!options.input }, (err, outputStream) => {
        if (err) return fail(err);
        stream = outputStream;
        stream.on('data', processOutput);

        stream.on('end', async () => {
          if (settled) return;
          try {
            if (pendingOutput.length > 0) {
              if (outputMode === 'detect') {
                capture('stdout', stdout, pendingOutput);
              } else if (outputMode === 'multiplexed') {
                // Incomplete final frames are unusual, but retain the payload
                // rather than silently discarding the command's last output.
                const type = pendingOutput.length >= 8 ? pendingOutput[0] : 1;
                const hasHeader = pendingOutput.length >= 8 &&
                  (type === 1 || type === 2) &&
                  pendingOutput[1] === 0 &&
                  pendingOutput[2] === 0 &&
                  pendingOutput[3] === 0;
                const payload = hasHeader ? pendingOutput.subarray(8) : pendingOutput;
                capture(type === 2 ? 'stderr' : 'stdout', type === 2 ? stderr : stdout, payload);
              }
              pendingOutput = Buffer.alloc(0);
            }
            closeTimer();
            const inspect = await exec.inspect();
            if (settled) return;
            settled = true;
            resolve({
              exitCode: inspect.ExitCode,
              stdout: stdout.join(''),
              stderr: stderr.join(''),
              success: inspect.ExitCode === 0
            });
          } catch (inspectError) {
            fail(inspectError);
          }
        });

        stream.on('error', fail);

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

    // P3 #39: remove ONLY the temp dir this manager created. When a caller
    // supplied its project workspace as `path`, deleting it would wipe the
    // project — ownedPath keeps that impossible.
    const ownedDir = sandbox.ownedPath || sandbox.path;

    if (sandbox.isLocal) {
      for (const [, proc] of sandbox.processes) {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }
      await fs.rm(ownedDir, { recursive: true, force: true }).catch(() => {});
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

    await fs.rm(ownedDir, { recursive: true, force: true }).catch(() => {});
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
        pidsLimit: 512,
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

  // P3 #38: shutdown now AWAITS every destroy — the old fire-and-forget loop
  // let the process exit while container stop/remove was still in flight,
  // orphaning containers on disk/Docker.
  async shutdown() {
    clearInterval(this.cleanupInterval);
    const ids = Array.from(this.containers.keys());
    await Promise.allSettled(ids.map(id => this.destroy(id)));
  }
}

module.exports = new SandboxManager();