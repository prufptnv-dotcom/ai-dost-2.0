const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const sandboxManager = require('./sandboxManager');

const FRAMEWORK_CONFIGS = {
  vite: {
    detect: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.cjs'],
    devCommand: 'npm run dev',
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
    devCommand: 'npm run dev',
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
    devCommand: 'npm run dev',
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
    this.servers = new Map();
  }

  async detectFramework(sandboxId, projectPath = '.') {
    const files = await sandboxManager.listFiles(sandboxId, projectPath);
    const fileNames = files.map(f => f.name);
    
    for (const [key, config] of Object.entries(FRAMEWORK_CONFIGS)) {
      for (const detectFile of config.detect) {
        if (fileNames.includes(detectFile)) {
          return { framework: key, config, projectPath };
        }
      }
    }

    const pkg = await this.readPackageJson(sandboxId, projectPath);
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

  async readPackageJson(sandboxId, projectPath) {
    try {
      const content = await sandboxManager.readFile(sandboxId, path.join(projectPath, 'package.json'));
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async installDependencies(sandboxId, projectPath = '.') {
    const pkg = await this.readPackageJson(sandboxId, projectPath);
    if (!pkg) return { success: false, error: 'No package.json found' };

    const hasLockfile = await this.hasLockfile(sandboxId, projectPath);
    const cmd = hasLockfile ? 'npm ci' : 'npm install';
    
    this.emit('log', { sandboxId, message: `Installing dependencies with: ${cmd}`, type: 'info' });
    
    const result = await sandboxManager.exec(sandboxId, `cd ${projectPath} && ${cmd}`, {
      timeout: 120000
    });

    if (!result.success) {
      this.emit('log', { sandboxId, message: `Install failed: ${result.stderr}`, type: 'error' });
      return { success: false, error: result.stderr };
    }

    this.emit('log', { sandboxId, message: 'Dependencies installed successfully', type: 'success' });
    return { success: true };
  }

  async hasLockfile(sandboxId, projectPath) {
    const files = await sandboxManager.listFiles(sandboxId, projectPath);
    return files.some(f => ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].includes(f.name));
  }

  async startDevServer(sandboxId, projectPath = '.', options = {}) {
    const existing = this.servers.get(sandboxId);
    if (existing) {
      await this.stopDevServer(sandboxId);
    }

    const { framework, config } = await this.detectFramework(sandboxId, projectPath);
    if (!config) {
      return { success: false, error: 'No dev server configuration detected' };
    }

    const installResult = await this.installDependencies(sandboxId, projectPath);
    if (!installResult.success) {
      return { success: false, error: installResult.error };
    }

    // Ensure the dev server port is exposed
    const containerPort = config.port;
    const portResult = await sandboxManager.exposePort(sandboxId, containerPort);
    const hostPort = portResult.hostPort;
    
    if (!hostPort) {
      // Try to get the port from container inspect
      const sandbox = sandboxManager.getSandbox(sandboxId);
      if (sandbox) {
        const inspect = await sandbox.container.inspect();
        const boundPort = inspect.NetworkSettings.Ports[`${containerPort}/tcp`]?.[0]?.HostPort;
        if (boundPort) {
          sandbox.ports.set(containerPort, parseInt(boundPort));
        }
      }
    }
    
    const finalHostPort = sandboxManager.getSandbox(sandboxId)?.ports.get(containerPort);
    if (!finalHostPort) {
      return { success: false, error: `Port ${containerPort} not exposed. Specify ports when creating sandbox.` };
    }

    this.emit('log', { sandboxId, message: `Starting ${config.framework} dev server on port ${containerPort}...`, type: 'info' });

    const devCommand = options.customCommand || config.devCommand;
    const fullCmd = `cd ${projectPath} && ${devCommand}`;
    
    const serverInfo = {
      sandboxId,
      framework,
      config,
      projectPath,
      containerPort,
      hostPort: finalHostPort,
      url: `http://localhost:${finalHostPort}`,
      startedAt: Date.now(),
      process: null,
      logs: []
    };

    this.servers.set(sandboxId, serverInfo);

    sandboxManager.exec(sandboxId, fullCmd, {
      timeout: 0,
      env: { 
        PORT: containerPort.toString(),
        HOST: '0.0.0.0',
        BROWSER: 'none'
      }
    }).then(result => {
      serverInfo.process = result;
      this.emit('log', { sandboxId, message: `Dev server exited: ${result.stdout}`, type: 'warn' });
      this.servers.delete(sandboxId);
    }).catch(err => {
      this.emit('log', { sandboxId, message: `Dev server error: ${err.message}`, type: 'error' });
      this.servers.delete(sandboxId);
    });

    await this.waitForServer(serverInfo.url, 60000);

    this.emit('ready', { sandboxId, url: serverInfo.url, framework: config.framework });
    return { success: true, url: serverInfo.url, framework: config.framework, port: finalHostPort };
  }

  async waitForServer(url, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok || res.status < 500) return true;
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Server not ready after ${timeout}ms`);
  }

  async stopDevServer(sandboxId) {
    const server = this.servers.get(sandboxId);
    if (!server) return false;

    try {
      await sandboxManager.exec(sandboxId, 'pkill -f "node.*vite|next|astro|nuxt|svelte|expo|tauri" || true', { timeout: 5000 });
    } catch {}
    
    this.servers.delete(sandboxId);
    this.emit('stopped', { sandboxId });
    return true;
  }

  getServer(sandboxId) {
    return this.servers.get(sandboxId);
  }

  getAllServers() {
    return Array.from(this.servers.values());
  }

  async buildProject(sandboxId, projectPath = '.') {
    const { config } = await this.detectFramework(sandboxId, projectPath);
    if (!config) return { success: false, error: 'No build configuration' };

    const result = await sandboxManager.exec(sandboxId, `cd ${projectPath} && ${config.buildCommand}`, {
      timeout: 180000
    });

    return { success: result.success, output: result.stdout, error: result.stderr };
  }

  async getPreviewUrl(sandboxId) {
    const server = this.servers.get(sandboxId);
    return server?.url || null;
  }
}

module.exports = new DevServerManager();