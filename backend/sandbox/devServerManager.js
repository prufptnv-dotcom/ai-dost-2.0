const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const { spawn } = require('child_process');
const net = require('net');
const os = require('os');
const sandboxManager = require('./sandboxManager');

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

class DevServerManager extends EventEmitter {
  constructor() {
    super();
    // Map of key (sandboxId or projectId) -> ServerInfo
    this.servers = new Map();
    // Index mapping projectId -> serverInfo
    this.projectIndex = new Map();
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
    return path.join(os.tmpdir(), `agent-ws-${projectId || 'default'}`);
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

  async installDependencies(targetId, projectPath = '.') {
    const sandbox = sandboxManager.getSandbox(targetId);
    const pkg = await this.readPackageJson(targetId, projectPath);
    if (!pkg) return { success: false, error: 'No package.json found' };

    const cmd = 'npm install';
    this.emitLog(targetId, `📦 Installing dependencies with: ${cmd}`, 'info');

    if (sandbox) {
      const result = await sandboxManager.exec(targetId, `cd ${projectPath} && ${cmd}`, {
        timeout: 180000
      });
      if (!result.success) {
        this.emitLog(targetId, `❌ Dependency install failed: ${result.stderr}`, 'error');
        return { success: false, error: result.stderr };
      }
      this.emitLog(targetId, '✅ Dependencies installed successfully inside sandbox', 'success');
      return { success: true };
    }

    // Host execution fallback
    return new Promise((resolve) => {
      const wsDir = path.join(this._workspaceDir(targetId), projectPath);
      const isWin = process.platform === 'win32';
      const npmCmd = isWin ? 'npm.cmd' : 'npm';

      const child = spawn(npmCmd, ['install'], {
        cwd: wsDir,
        shell: true,
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
      const fullCmd = `cd ${projectPath} && ${devCommand}`;
      this.emitLog(targetId, `🚀 Starting ${config.framework} dev server on port ${containerPort} (Host :${finalHostPort})...`, 'info');

      sandboxManager.exec(targetId, fullCmd, {
        timeout: 0,
        env: {
          PORT: containerPort.toString(),
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

      const wsDir = path.join(this._workspaceDir(projectId), projectPath);
      const isWin = process.platform === 'win32';
      const npmCmd = isWin ? 'npm.cmd' : 'npm';

      this.emitLog(targetId, `🚀 Starting local ${config.framework} dev server on port ${hostPort}...`, 'info');

      const child = spawn(npmCmd, ['run', 'dev', '--', '--port', String(hostPort), '--host', '0.0.0.0'], {
        cwd: wsDir,
        shell: true,
        env: {
          ...process.env,
          PORT: String(hostPort),
          HOST: '0.0.0.0',
          BROWSER: 'none',
          NODE_ENV: 'development'
        }
      });

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
    if (server.projectId) this.projectIndex.delete(server.projectId);
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
