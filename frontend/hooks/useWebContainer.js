import { WebContainer } from '@webcontainer/api';
import { useState, useEffect, useRef, useCallback } from 'react';

let webcontainerInstance = null;
let bootPromise = null;

// Tiny path join (no dependency) — browser-safe
function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export async function getWebContainer() {
  if (webcontainerInstance) return webcontainerInstance;
  if (bootPromise) return bootPromise;

  bootPromise = WebContainer.boot().then(instance => {
    webcontainerInstance = instance;
    return instance;
  }).catch(err => {
    bootPromise = null; // allow retry after a failed boot
    throw err;
  });

  return bootPromise;
}

// Test-only helper: clears the module-level singleton between test cases.
export function __resetWebContainer() {
  webcontainerInstance = null;
  bootPromise = null;
}

export function useWebContainer() {
  const [instance, setInstance] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setStatus('booting');
      setError(null);
      try {
        const wc = await getWebContainer();
        if (mounted) {
          setInstance(wc);
          setStatus('ready');
        }
      } catch (err) {
        if (mounted) {
          setError(err?.message || 'WebContainer boot failed (browser support/HTTPS required)');
          setStatus('error');
        }
      }
    }

    boot();

    return () => { mounted = false; };
  }, []);

  const writeFile = useCallback(async (filePath, content) => {
    if (!instance) throw new Error('WebContainer not ready');
    await instance.fs.writeFile(filePath, content);
  }, [instance]);

  const readFile = useCallback(async (filePath) => {
    if (!instance) throw new Error('WebContainer not ready');
    return instance.fs.readFile(filePath, 'utf-8');
  }, [instance]);

  const removeFile = useCallback(async (filePath) => {
    if (!instance) throw new Error('WebContainer not ready');
    await instance.fs.rm(filePath, { recursive: true, force: true });
  }, [instance]);

  const listFiles = useCallback(async (dirPath = '.') => {
    if (!instance) throw new Error('WebContainer not ready');
    const entries = await instance.fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'directory' : 'file',
      path: joinPath(dirPath, e.name)
    }));
  }, [instance]);

  const runCommand = useCallback(async (command, options = {}) => {
    if (!instance) throw new Error('WebContainer not ready');

    const process = await instance.spawn('sh', ['-c', command], {
      cwd: options.cwd || '/workspace',
      env: options.env || {}
    });

    return new Promise((resolve, reject) => {
      let output = '';
      const decoder = new TextDecoder();

      process.output.pipeTo(new WritableStream({
        write(chunk) {
          output += decoder.decode(chunk);
        }
      })).catch(() => {});

      process.exit.then(exitCode => {
        resolve({ exitCode, stdout: output, stderr: '', success: exitCode === 0 });
      }).catch(reject);

      // Safety timeout — never leave the promise hanging
      setTimeout(() => {
        resolve({ exitCode: -1, stdout: output, stderr: 'Command timed out', success: false });
        try { process.kill(); } catch { /* already dead */ }
      }, options.timeout || 120000);
    });
  }, [instance]);

  const startDevServer = useCallback(async (cmd, port = 5173) => {
    if (!instance) throw new Error('WebContainer not ready');

    const process = await instance.spawn('sh', ['-c', cmd], {
      cwd: '/workspace',
      env: { PORT: port.toString(), HOST: '0.0.0.0', BROWSER: 'none' }
    });

    return {
      process,
      url: `http://localhost:${port}`,
      port,
      kill: () => { try { process.kill(); } catch { /* already dead */ } }
    };
  }, [instance]);

  const onPort = useCallback((port, callback) => {
    if (!instance) return () => {};
    return instance.on('port', (portInfo) => {
      if (portInfo.port === port) callback(portInfo);
    });
  }, [instance]);

  return {
    instance,
    status,
    error,
    writeFile,
    readFile,
    removeFile,
    listFiles,
    runCommand,
    startDevServer,
    onPort
  };
}

export function useWebContainerProject(projectId, autoBoot = true) {
  const wc = useWebContainer();
  const [projectFiles, setProjectFiles] = useState({});
  const [devServer, setDevServer] = useState(null);
  const [logs, setLogs] = useState([]);
  const devServerRef = useRef(null);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev.slice(-99), { id: Date.now(), message, type, timestamp: Date.now() }]);
  }, []);

  const writeProjectFile = useCallback(async (filePath, content) => {
    await wc.writeFile(filePath, content);
    setProjectFiles(prev => ({ ...prev, [filePath]: content }));
  }, [wc]);

  const readProjectFile = useCallback(async (filePath) => {
    return wc.readFile(filePath);
  }, [wc]);

  const installDeps = useCallback(async (packageManager = 'npm') => {
    addLog(`Installing dependencies with ${packageManager}...`, 'info');
    const result = await wc.runCommand(`${packageManager} install`, { timeout: 300000 });
    addLog(result.success ? 'Dependencies installed' : `Install failed: ${result.stdout || 'unknown'}`, result.success ? 'success' : 'error');
    return result;
  }, [wc, addLog]);

  const startDev = useCallback(async (framework = 'vite', customCommand) => {
    if (devServerRef.current) {
      devServerRef.current.kill();
      devServerRef.current = null;
    }

    const commands = {
      vite: 'npm run dev',
      nextjs: 'npm run dev',
      astro: 'npm run dev',
      sveltekit: 'npm run dev',
      nuxt: 'npm run dev',
      remix: 'npm run dev',
      expo: 'npx expo start --web',
      custom: customCommand || 'npm run dev'
    };

    const cmd = commands[framework] || commands.vite;
    const port = framework === 'nextjs' || framework === 'nuxt' || framework === 'remix' ? 3000 :
                 framework === 'astro' ? 4321 :
                 framework === 'expo' ? 8081 : 5173;

    addLog(`Starting ${framework} dev server...`, 'info');
    const server = await wc.startDevServer(cmd, port);
    devServerRef.current = server;
    setDevServer(server);
    addLog(`Dev server started at ${server.url}`, 'success');
    return server;
  }, [wc, addLog]);

  const stopDev = useCallback(() => {
    if (devServerRef.current) {
      devServerRef.current.kill();
      devServerRef.current = null;
      setDevServer(null);
      addLog('Dev server stopped', 'info');
    }
  }, [addLog]);

  const buildProject = useCallback(async (framework = 'vite') => {
    const commands = {
      vite: 'npm run build',
      nextjs: 'npm run build',
      astro: 'npm run build',
      sveltekit: 'npm run build',
      nuxt: 'npm run build',
      remix: 'npm run build',
      expo: 'npx expo export --platform web'
    };

    const cmd = commands[framework] || commands.vite;
    addLog(`Building project...`, 'info');
    const result = await wc.runCommand(cmd, { timeout: 300000 });
    addLog(result.success ? 'Build successful' : `Build failed: ${result.stdout || 'unknown'}`, result.success ? 'success' : 'error');
    return result;
  }, [wc, addLog]);

  // Cleanup dev server on unmount
  useEffect(() => () => {
    if (devServerRef.current) {
      try { devServerRef.current.kill(); } catch { /* ignore */ }
    }
  }, []);

  return {
    ...wc,
    projectFiles,
    devServer,
    logs,
    writeProjectFile,
    readProjectFile,
    installDeps,
    startDev,
    stopDev,
    buildProject,
    addLog
  };
}