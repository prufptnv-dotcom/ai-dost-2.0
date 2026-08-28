import { WebContainer } from '@webcontainer/api';

let webcontainerInstance = null;
let bootPromise = null;

export async function getWebContainerInstance() {
  if (webcontainerInstance) return webcontainerInstance;
  if (bootPromise) return bootPromise;

  bootPromise = WebContainer.boot().then(instance => {
    webcontainerInstance = instance;
    return instance;
  }).catch(err => {
    bootPromise = null;
    throw err;
  });

  return bootPromise;
}

// Convert projectStore files array into WebContainer nested filesystem tree
export function transformFilesToTree(files) {
  const tree = {};

  for (const file of (files || [])) {
    if (!file || !file.path) continue;
    const parts = file.path.replace(/^\/+/, '').split('/');
    let current = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const folder = parts[i];
      if (!current[folder]) {
        current[folder] = { directory: {} };
      }
      current = current[folder].directory;
    }

    const filename = parts[parts.length - 1];
    current[filename] = {
      file: {
        contents: file.content || ''
      }
    };
  }

  return tree;
}

// Mount and start development server inside client browser
export async function bootSandboxServer(files, onServerReady, onTerminalLog) {
  const webcontainer = await getWebContainerInstance();

  // 1. Mount virtual filesystem
  const fileTree = transformFilesToTree(files);
  await webcontainer.mount(fileTree);
  onTerminalLog?.('📦 Filesystem mounted successfully in WebContainer.\n');

  // 2. Install dependencies (e.g. npm install)
  const installProcess = await webcontainer.spawn('npm', ['install', '--prefer-offline']);
  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        onTerminalLog?.(data);
      }
    })
  );
  const installExitCode = await installProcess.exit;
  if (installExitCode !== 0) {
    onTerminalLog?.('⚠️ npm install had warnings/errors in WebContainer.\n');
  }

  // 3. Start dev server (e.g. npm run dev or vite)
  const devProcess = await webcontainer.spawn('npm', ['run', 'dev']);
  devProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        onTerminalLog?.(data);
      }
    })
  );

  // 4. Capture hot-reload internal URL for the preview iframe
  webcontainer.on('server-ready', (port, url) => {
    if (onServerReady) onServerReady(url);
  });

  return { webcontainer, devProcess };
}
