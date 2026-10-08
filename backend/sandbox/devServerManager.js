const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const sandboxManager = require('./SandboxManager');
const workspaceManager = require('../services/workspaceManager');
// P0: Windows cannot spawn a .cmd with `shell:false` since Node's
// CVE-2024-27980 fix (throws EINVAL) — every host-side `npm install` /
// `npm rebuild` below silently failed with "spawn EINVAL". Shared helper.
const { resolveInvocation, npmBin } = require('../services/runtimeBridge');

const FRAMEWORK_CONFIGS = {
  vite: {
    detect: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs'],
    devCommand: 'npm run dev -- --host 0.0.0.0',
    buildCommand: 'npm run build',
    port: 5173,
    outputDir: 'dist',
    framework: 'Vite'
  },
  nextjs: {
    detect: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
    devCommand: 'npm run dev',
    buildCommand: 'npm run build',
    port: 3000,
    outputDir: '.next',
    framework: 'Next.js'
  },
  astro: {
    detect: ['astro.config.mjs', 'astro.config.ts'],
    devCommand: 'npm run dev -- --host 0.0.0.0',
    buildCommand: 'npm run build',
    port: 4321,
    outputDir: 'dist',
    framework: 'Astro'
  },
  remix: {
    detect: ['remix.config.js', 'remix.config.ts'],
    devCommand: 'npm run dev',
    buildCommand: 'npm run build',
    port: 3000,
    outputDir: 'build',
    framework: 'Remix'
  },
  sveltekit: {
    detect: ['svelte.config.js', 'svelte.config.ts'],
    devCommand: 'npm run dev -- --host 0.0.0.0',
    buildCommand: 'npm run build',
    port: 5173,
    outputDir: 'build',
    framework: 'SvelteKit'
  },
  nuxt: {
    detect: ['nuxt.config.ts', 'nuxt.config.js'],
    devCommand: 'npm run dev',
    buildCommand: 'npm run build',
    port: 3000,
    outputDir: '.output',
    framework: 'Nuxt'
  },
  expo: {
    detect: ['app.json', 'app.config.js', 'expo-env.d.ts'],
    devCommand: 'npx expo start --web',
    buildCommand: 'npx expo export --platform web',
    port: 8081,
    outputDir: 'dist',
    framework: 'Expo'
  },
  tauri: {
    detect: ['tauri.conf.json', 'tauri.conf.json5'],
    devCommand: 'npm run tauri dev',
    buildCommand: 'npm run tauri build',
    port: 1420,
    outputDir: 'dist',
    framework: 'Tauri'
  }
};

// Normalize package.json dev scripts so vite-based dev servers bind 0.0.0.0.
// Flags passed as `npm run dev -- --host 0.0.0.0` are swallowed by meta-runners
// (concurrently/npm: aliases), so the vite invocation itself must carry --host.
// Returns { changed, updated } and mutates pkg.scripts in place.
function ensureViteHostScripts(pkg) {
  if (!pkg || !pkg.scripts || typeof pkg.scripts !== 'object') return { changed: false, updated: [] };
  const updated = [];
  for (const [name, value] of Object.entries(pkg.scripts)) {
    if (typeof value !== 'string' || value.includes('--host')) continue;
    const invokesVite = /(?:^|[\s"'`])(?:npx\s+)?vite(?:\s|$)/.test(value)
      || /vite[\\/]bin[\\/]vite\.js/.test(value);
    if (!invokesVite) continue;
    if (/(?:^|[\s"'`])vite\s+(?:build|preview|--version)(?:\s|$)/.test(value)) continue;
    pkg.scripts[name] = `${value} --host 0.0.0.0`;
    updated.push(name);
  }
  return { changed: updated.length > 0, updated };
}

class DevServerManager extends EventEmitter {
  constructor() {
    super();
    // Map of key (sandboxId or projectId) -> ServerInfo
    this.servers = new Map();
    // Index mapping projectId -> serverInfo
    this.projectIndex = new Map();
    // Index mapping vite HMR ws token -> projectId (see registerHmrToken)
    this.hmrTokenIndex = new Map();
  }

  // Find an available port on the host
  async findFreePort(startPort = 5173) {
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
    });
  }

  // Workspace directory resolver
  _workspaceDir(projectId) {
    return workspaceManager.getWorkspacePath(projectId);
  }

  // Reject absolute / traversal projectPath (was joined raw → path escape)
  _safeProjectPath(projectPath) {
    const raw = String(projectPath || '.').trim();
    if (!raw || raw.includes('\0')) return null;
    if (path.isAbsolute(raw) || /^[a-zA-Z]:[\\/]/.test(raw)) return null;
    if (raw.split(/[\\/]/).some(seg => seg === '..')) return null;
    return raw;
  }

  // Reject shell metacharacters in user-supplied customCommand
  _safeCustomCommand(cmd) {
    if (!cmd || typeof cmd !== 'string') return null;
    if (/[;&|`$()<>\n\r]/.test(cmd)) return null;
    return cmd.slice(0, 300);
  }

  async detectFramework(targetId, projectPath = '.') {
    const sandbox = sandboxManager.getSandbox(targetId);
    if (sandbox) {
      const files = await sandboxManager.listFiles(targetId, projectPath);
      const fileNames = files.map(f => f.name);

      for (const [key, config] of Object.entries(FRAMEWORK_CONFIGS)) {
        for (const detectFile of config.detect) {
          if (fileNames.includes(detectFile)) {
            return { framework: key, config, projectPath };
          }
        }
      }

      const pkg = await this.readPackageJson(targetId, projectPath);
      if (pkg?.scripts?.dev) {
        return {
          framework: 'custom',
          config: {
            devCommand: 'npm run dev',
            buildCommand: pkg.scripts.build || 'npm run build',
            port: 3000,
            framework: 'Custom (npm dev)'
          },
          projectPath
        };
      }

      return { framework: 'static', config: null, projectPath };
    }

    // Host workspace detection fallback
    const wsDir = this._workspaceDir(targetId);
    try {
      const entries = await fs.readdir(path.join(wsDir, projectPath));
      for (const [key, config] of Object.entries(FRAMEWORK_CONFIGS)) {
        for (const detectFile of config.detect) {
          if (entries.includes(detectFile)) {
            return { framework: key, config, projectPath };
          }
        }
      }
      try {
        const pkgContent = await fs.readFile(path.join(wsDir, projectPath, 'package.json'), 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (pkg?.scripts?.dev) {
          return {
            framework: 'custom',
            config: {
              devCommand: 'npm run dev',
              buildCommand: pkg.scripts.build || 'npm run build',
              port: 3000,
              framework: 'Custom (npm dev)'
            },
            projectPath
          };
        }
      } catch (_) {}
    } catch (_) {}

    return { framework: 'static', config: null, projectPath };
  }

  async readPackageJson(targetId, projectPath) {
    const sandbox = sandboxManager.getSandbox(targetId);
    if (sandbox) {
      try {
        const content = await sandboxManager.readFile(targetId, path.join(projectPath, 'package.json'));
        return JSON.parse(content);
      } catch {
        return null;
      }
    }
    try {
      const wsDir = this._workspaceDir(targetId);
      const content = await fs.readFile(path.join(wsDir, projectPath, 'package.json'), 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  // Ensure vite dev scripts bind 0.0.0.0 (rewritten in sandbox or workspace).
  async _applyHostBinding(targetId, projectPath, framework) {
    if (!['vite', 'sveltekit', 'astro'].includes(framework)) return;
    const pkg = await this.readPackageJson(targetId, projectPath);
    if (!pkg) return;
    const { changed, updated } = ensureViteHostScripts(pkg);
    if (!changed) return;
    const content = `${JSON.stringify(pkg, null, 2)}\n`;
    const sandbox = sandboxManager.getSandbox(targetId);
    try {
      if (sandbox) {
        await sandboxManager.writeFile(targetId, path.join(projectPath, 'package.json').replace(/\\/g, '/'), content);
      } else {
        const wsRoot = path.resolve(this._workspaceDir(targetId));
        const wsDir = path.resolve(wsRoot, projectPath);
        if (wsDir !== wsRoot && !wsDir.startsWith(wsRoot + path.sep)) return;
        await fs.writeFile(path.join(wsDir, 'package.json'), content);
      }
      this.emitLog(targetId, `🔧 package.json normalized (host binding): ${updated.join(', ')} → added --host 0.0.0.0`, 'info');
    } catch (err) {
      this.emitLog(targetId, `⚠️ Could not normalize package.json: ${err.message}`, 'warn');
    }
  }

  async installDependencies(targetId, projectPath = '.') {
    const safeRel = this._safeProjectPath(projectPath);
    if (safeRel === null) return { success: false, error: 'Invalid projectPath (absolute/.. blocked)' };
    projectPath = safeRel;
    const sandbox = sandboxManager.getSandbox(targetId);
    const pkg = await this.readPackageJson(targetId, projectPath);
    if (!pkg) return { success: false, error: 'No package.json found' };

    // Agent scaffolds install with --ignore-scripts (supply-chain guard), so
    // native addons (better-sqlite3 etc.) arrive unbuilt — npm rebuild runs
    // exactly the install scripts npm install would have run. Same trust
    // surface as the plain `npm install` below; sandbox is isolated anyway.
    const cmd = 'npm install && npm rebuild';
    this.emitLog(targetId, `📦 Installing dependencies: ${cmd}`, 'info');

    if (sandbox) {
      const result = await sandboxManager.exec(targetId, `cd '${projectPath.replace(/'/g, '')}' && ${cmd}`, {
        timeout: 300000
      });
      if (!result.success) {
        this.emitLog(targetId, `❌ Dependency install failed: ${result.stderr}`, 'error');
        return { success: false, error: result.stderr };
      }
      this.emitLog(targetId, '✅ Dependencies installed + native addons rebuilt inside sandbox', 'success');
      return { success: true };
    }

    // Host execution fallback — path.join with validated relative projectPath only
    const wsRoot = path.resolve(this._workspaceDir(targetId));
    const wsDir = path.resolve(wsRoot, projectPath);
    if (wsDir !== wsRoot && !wsDir.startsWith(wsRoot + path.sep)) {
      return { success: false, error: 'projectPath escapes workspace root' };
    }
    try {
      if (require('fs').existsSync(path.join(wsDir, 'node_modules'))) {
        this.emitLog(targetId, '⚡ Existing node_modules found — running npm rebuild (native addons)', 'info');
        return new Promise((resolve) => {
          const isWin = process.platform === 'win32';
          const npmCmd = isWin ? 'npm.cmd' : 'npm';
          const inv = resolveInvocation(npmCmd, ['rebuild']);
          const child = spawn(inv.command, inv.args, {
            cwd: wsDir,
            shell: false,
            windowsHide: true,
            env: { ...process.env, NODE_ENV: 'development' }
          });
          let stderr = '';
          child.stderr.on('data', chunk => { stderr += chunk.toString(); });
          child.on('close', code => {
            if (code === 0) {
              this.emitLog(targetId, '✅ npm rebuild completed on host', 'success');
              resolve({ success: true });
            } else {
              this.emitLog(targetId, `⚠️ npm rebuild exited ${code} (app may miss native addons): ${stderr.slice(0, 300)}`, 'warn');
              resolve({ success: true });
            }
          });
          child.on('error', err => {
            this.emitLog(targetId, `⚠️ npm rebuild could not run: ${err.message}`, 'warn');
            resolve({ success: true });
          });
        });
      }
    } catch (_) {}

    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const npmCmd = isWin ? 'npm.cmd' : 'npm';
      const inv = resolveInvocation(npmCmd, ['install']);

      const child = spawn(inv.command, inv.args, {
        cwd: wsDir,
        shell: false,
        windowsHide: true,
        env: { ...process.env, NODE_ENV: 'development' }
      });

      let stderr = '';
      child.stderr.on('data', chunk => { stderr += chunk.toString(); });
      child.on('close', code => {
        if (code === 0) {
          this.emitLog(targetId, '✅ Dependencies installed successfully on host', 'success');
          resolve({ success: true });
        } else {
          this.emitLog(targetId, `❌ Install failed (exit code ${code}): ${stderr}`, 'error');
          resolve({ success: false, error: stderr || `npm install exited with code ${code}` });
        }
      });
      child.on('error', err => {
        resolve({ success: false, error: err.message });
      });
    });
  }

  async startDevServer(targetId, projectPath = '.', options = {}) {
    const safeRel = this._safeProjectPath(projectPath);
    if (safeRel === null) {
      return { success: false, error: 'Invalid projectPath (absolute/.. blocked)' };
    }
    projectPath = safeRel;
    if (options.customCommand) {
      const safeCmd = this._safeCustomCommand(options.customCommand);
      if (!safeCmd) {
        return { success: false, error: 'customCommand contains blocked shell characters' };
      }
      options = { ...options, customCommand: safeCmd };
    }
    const existing = this.getServer(targetId);
    if (existing && existing.state === 'READY') {
      return { success: true, url: existing.url, hostPort: existing.hostPort, framework: existing.framework, state: 'READY' };
    }
    if (existing) {
      await this.stopDevServer(targetId);
    }

    const projectId = options.projectId || (sandboxManager.getSandbox(targetId)?.projectId) || targetId;
    const { framework, config } = await this.detectFramework(targetId, projectPath);
    if (!config) {
      return { success: false, error: 'No dev server configuration detected (static project)' };
    }
    await this._applyHostBinding(targetId, projectPath, framework);

    const serverInfo = {
      sandboxId: sandboxManager.getSandbox(targetId) ? targetId : null,
      projectId,
      targetId,
      framework,
      config,
      projectPath,
      containerPort: config.port,
      hostPort: null,
      url: null,
      state: 'CREATING',
      startedAt: Date.now(),
      process: null,
      logs: [],
      error: null
    };

    this.servers.set(targetId, serverInfo);
    this.projectIndex.set(projectId, serverInfo);
    this.emitState(serverInfo, 'STARTING');

    // Install dependencies if needed
    const installResult = await this.installDependencies(targetId, projectPath);
    if (!installResult.success) {
      this.emitState(serverInfo, 'FAILED', installResult.error);
      return { success: false, error: installResult.error };
    }

    const sandbox = sandboxManager.getSandbox(targetId);
    if (sandbox) {
      // 1. Docker Mode
      const containerPort = config.port;
      const portResult = await sandboxManager.exposePort(targetId, containerPort);
      let finalHostPort = portResult.hostPort;

      if (!finalHostPort) {
        const inspect = await sandbox.container.inspect();
        const boundPort = inspect.NetworkSettings.Ports[`${containerPort}/tcp`]?.[0]?.HostPort;
        if (boundPort) {
          sandbox.ports.set(containerPort, parseInt(boundPort));
          finalHostPort = parseInt(boundPort);
        }
      }

      if (!finalHostPort) {
        const err = `Port ${containerPort} not bound in sandbox container.`;
        this.emitState(serverInfo, 'FAILED', err);
        return { success: false, error: err };
      }

      serverInfo.hostPort = finalHostPort;
      serverInfo.url = `http://127.0.0.1:${finalHostPort}`;

      const devCommand = options.customCommand || config.devCommand;
      const fullCmd = `cd '${projectPath.replace(/'/g, '')}' && ${devCommand}`;
      this.emitLog(targetId, `🚀 Starting ${config.framework} dev server on port ${containerPort} (Host :${finalHostPort})...`, 'info');

      sandboxManager.exec(targetId, fullCmd, {
        timeout: 0,
        // Live-tail child output (concurrently/vite/api) into dev logs —
        // previously only visible after the whole chain exited.
        onData: (channel, text) => {
          const line = text.replace(/\s+$/, '');
          if (line) this.emitLog(targetId, line, channel === 'stderr' ? 'stderr' : 'stdout');
        },
        env: {
          // vite ignores PORT but sibling processes (e.g. an api server.js
          // reading process.env.PORT) would collide with the vite port —
          // let them fall back to their own defaults instead.
          ...(framework === 'vite' ? {} : { PORT: containerPort.toString() }),
          HOST: '0.0.0.0',
          BROWSER: 'none'
        }
      }).then(result => {
        serverInfo.process = result;
        this.emitLog(targetId, `Dev server exited: ${result.stdout || ''} ${result.stderr || ''}`, 'warn');
        this.emitState(serverInfo, 'STOPPED');
      }).catch(err => {
        this.emitLog(targetId, `Dev server error: ${err.message}`, 'error');
        this.emitState(serverInfo, 'FAILED', err.message);
      });

    } else {
      // 2. Host Process Mode Fallback
      const hostPort = await this.findFreePort(config.port);
      serverInfo.hostPort = hostPort;
      serverInfo.url = `http://127.0.0.1:${hostPort}`;

      const rawWsDir = path.resolve(this._workspaceDir(projectId), projectPath);
      const wsRoot = path.resolve(this._workspaceDir(projectId));
      if (rawWsDir !== wsRoot && !rawWsDir.startsWith(wsRoot + path.sep)) {
        this.emitState(serverInfo, 'FAILED', 'projectPath escapes workspace');
        return { success: false, error: 'projectPath escapes workspace root' };
      }
      let wsDir = rawWsDir;
      try {
        // IMPORTANT: use the NATIVE realpath. On Windows, `os.tmpdir()` can be
        // the 8.3 short form (`C:\Users\VIKASH~1\...`) while `process.cwd()`
        // inside the spawned child comes back in LONG form (`...\vikash kumar\...`).
        // Vite then computes its `fs.allow` list from the SHORT root but resolves
        // module ids to LONG paths — `startsWith` fails, the file load is denied
        // and Vite reports "Does the file exist?" for files that are right there.
        // The result: no JSX transform at all, and the browser receives raw
        // source (`Unexpected token '<'`). The pure-JS realpathSync does NOT
        // expand 8.3 names; realpathSync.native does.
        wsDir = require('fs').realpathSync.native(rawWsDir);
      } catch (_) {}

      const isWin = process.platform === 'win32';
      const viteBin = path.join(wsDir, 'node_modules', 'vite', 'bin', 'vite.js');
      const hasVite = require('fs').existsSync(viteBin);

      this.emitLog(targetId, `🚀 Starting local ${config.framework} dev server on port ${hostPort}...`, 'info');

      let child;
      if (hasVite) {
        child = spawn(process.execPath, [viteBin, '--port', String(hostPort), '--host', '0.0.0.0'], {
          cwd: wsDir,
          env: {
            ...process.env,
            CHOKIDAR_USEPOLLING: '1',
            PORT: String(hostPort),
            HOST: '0.0.0.0',
            BROWSER: 'none',
            NODE_ENV: 'development'
          }
        });
      } else {
        const npmCmd = isWin ? 'npm.cmd' : 'npm';
        child = spawn(npmCmd, ['run', 'dev', '--', '--port', String(hostPort), '--host', '0.0.0.0'], {
          cwd: wsDir,
          shell: true,
          env: {
            ...process.env,
            CHOKIDAR_USEPOLLING: '1',
            PORT: String(hostPort),
            HOST: '0.0.0.0',
            BROWSER: 'none',
            NODE_ENV: 'development'
          }
        });
      }

      serverInfo.childProcess = child;

      child.stdout.on('data', chunk => {
        const text = chunk.toString();
        this.emitLog(targetId, text, 'stdout');
      });

      child.stderr.on('data', chunk => {
        const text = chunk.toString();
        this.emitLog(targetId, text, 'stderr');
      });

      child.on('close', code => {
        this.emitLog(targetId, `Process exited with code ${code}`, 'warn');
        if (serverInfo.state !== 'STOPPED' && serverInfo.state !== 'STOPPING') {
          this.emitState(serverInfo, code === 0 ? 'STOPPED' : 'FAILED', `Process exited with code ${code}`);
        }
      });
    }

    try {
      await this.waitForServer(serverInfo.url, 120000, serverInfo);
      this.emitState(serverInfo, 'READY');
      // P7 always-on: local servers record themselves so server.js can restore
      // them after a restart (Docker sandboxes are container-scoped — skip).
      if (serverInfo.projectId && serverInfo.projectPath && !serverInfo.sandboxId) {
        this.persistLiveServer(serverInfo.projectId, serverInfo.projectPath).catch(() => {});
      }
      return {
        success: true,
        url: serverInfo.url,
        framework: config.framework,
        hostPort: serverInfo.hostPort,
        containerPort: serverInfo.containerPort,
        state: 'READY'
      };
    } catch (err) {
      this.emitState(serverInfo, 'FAILED', err.message);
      return { success: false, error: `Dev server health check failed: ${err.message}` };
    }
  }

  async waitForServer(url, timeout = 120000, checkServerObj = null) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (checkServerObj && (checkServerObj.state === 'FAILED' || checkServerObj.state === 'STOPPED')) {
        throw new Error(checkServerObj.error || 'Process exited before becoming ready');
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.status < 500) return true;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 600));
    }
    throw new Error(`Server at ${url} not responding after ${Math.round(timeout / 1000)}s`);
  }

  async stopDevServer(targetId) {
    const server = this.getServer(targetId);
    if (!server) return false;

    this.emitState(server, 'STOPPING');

    if (server.childProcess) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(server.childProcess.pid), '/f', '/t']);
        } else {
          server.childProcess.kill('SIGTERM');
        }
      } catch (_) {}
      server.childProcess = null;
    }

    if (server.sandboxId) {
      try {
        await sandboxManager.exec(server.sandboxId, 'pkill -f "node.*vite|next|astro|nuxt|svelte|expo|tauri" || true', { timeout: 5000 });
      } catch (_) {}
    }

    this.emitState(server, 'STOPPED');
    this.servers.delete(targetId);
    if (server.projectId) {
      this.projectIndex.delete(server.projectId);
      // P7: a user-stopped server must NOT come back on the next boot
      this.unpersistLiveServer(server.projectId).catch(() => {});
    }
    return true;
  }

  async restartDevServer(targetId, options = {}) {
    const server = this.getServer(targetId);
    const projectPath = server?.projectPath || '.';
    this.emitState(server, 'RESTARTING');
    await this.stopDevServer(targetId);
    return this.startDevServer(targetId, projectPath, options);
  }

  getServer(targetId) {
    if (!targetId) return null;
    return this.servers.get(targetId) || this.projectIndex.get(targetId) || null;
  }

  getServerByProject(projectId) {
    if (!projectId) return null;
    return this.projectIndex.get(projectId) || this.servers.get(projectId) || null;
  }

  // Vite HMR ws token → projectId. The browser's fallback handshake
  // `ws://host/?token=X` carries NO project path (and WS handshakes send no
  // Referer), so the server.js upgrade handler resolves the target dev server
  // through this index. Populated by the preview proxy when it serves
  // `/@vite/client` (the only response containing the token).
  registerHmrToken(projectId, token) {
    if (!projectId || !token) return false;
    this.hmrTokenIndex.set(String(token), String(projectId));
    return true;
  }

  getProjectByHmrToken(token) {
    if (!token) return null;
    return this.hmrTokenIndex.get(String(token)) || null;
  }

  // ── P7: always-on dev servers ───────────────────────────────────────────────
  // Every successful LOCAL start records the project here; the backend restores
  // them on boot (server.js `require.main` block) so previews survive restarts.
  // File lives in backend/data/ (durable — unlike %TEMP%), env-overridable for
  // tests via AIDOST_LIVE_FILE.
  liveFilePath() {
    return process.env.AIDOST_LIVE_FILE || path.join(__dirname, '..', 'data', 'live-servers.json');
  }

  async persistLiveServer(projectId, projectPath) {
    if (!projectId || !projectPath) return false;
    try {
      const file = this.liveFilePath();
      let all = {};
      try { all = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) { all = {}; }
      all[projectId] = { projectPath, at: Date.now() };
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(all, null, 2));
      return true;
    } catch (_) {
      return false;
    }
  }

  async unpersistLiveServer(projectId) {
    if (!projectId) return false;
    try {
      const file = this.liveFilePath();
      let all = {};
      try { all = JSON.parse(await fs.readFile(file, 'utf8')); } catch (_) { return true; }
      if (!(projectId in all)) return true;
      delete all[projectId];
      await fs.writeFile(file, JSON.stringify(all, null, 2));
      return true;
    } catch (_) {
      return false;
    }
  }

  async listLiveServers() {
    try {
      const all = JSON.parse(await fs.readFile(this.liveFilePath(), 'utf8'));
      return Object.entries(all).map(([projectId, e]) => ({ projectId, ...(e || {}) }));
    } catch (_) {
      return [];
    }
  }

  // Bring previously-live dev servers back after a backend restart. Sequential
  // (port probing is racy in parallel) and failure-tolerant: one broken project
  // never blocks the rest. Callers run this AFTER boot — never on the critical
  // startup path, and never in tests.
  async restoreLiveServers() {
    const entries = await this.listLiveServers();
    const restored = [];
    const failed = [];
    for (const { projectId, projectPath } of entries) {
      if (!projectId || !projectPath) continue;
      if (this.getServerByProject(projectId)) {
        restored.push(projectId);
        continue;
      }
      try {
        const r = await this.startDevServer(projectId, projectPath);
        if (r && r.success !== false) restored.push(projectId);
        else failed.push(projectId);
      } catch (_) {
        failed.push(projectId);
      }
    }
    return { restored, failed };
  }

  getAllServers() {
    return Array.from(this.servers.values());
  }

  getStatus(targetId) {
    const server = this.getServer(targetId);
    if (!server) {
      return { running: false, state: 'STOPPED', url: null, hostPort: null, logs: [] };
    }
    return {
      running: server.state === 'READY',
      state: server.state,
      url: server.url,
      hostPort: server.hostPort,
      containerPort: server.containerPort,
      framework: server.framework,
      startedAt: server.startedAt,
      logs: server.logs.slice(-100),
      error: server.error
    };
  }

  emitState(server, state, error = null) {
    if (!server) return;
    server.state = state;
    if (error) server.error = error;
    this.emit('state', { targetId: server.targetId, projectId: server.projectId, state, error, url: server.url });
    if (state === 'READY') this.emit('ready', { targetId: server.targetId, url: server.url, framework: server.framework });
    if (state === 'STOPPED') this.emit('stopped', { targetId: server.targetId });
  }

  emitLog(targetId, message, type = 'info') {
    const server = this.getServer(targetId);
    const entry = { timestamp: Date.now(), message: message.trim(), type };
    if (server) {
      server.logs.push(entry);
      if (server.logs.length > 500) server.logs.shift();
    }
    this.emit('log', { targetId, ...entry });
  }

  async cleanup() {
    for (const targetId of this.servers.keys()) {
      await this.stopDevServer(targetId);
    }
    this.servers.clear();
    this.projectIndex.clear();
  }
}

module.exports = new DevServerManager();
module.exports.ensureViteHostScripts = ensureViteHostScripts;
