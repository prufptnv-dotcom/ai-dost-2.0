const express = require('express');
const router = express.Router();
const sandboxManager = require('./sandboxManager');
const devServerManager = require('./devServerManager');
const crypto = require('crypto');

const activeSessions = new Map();

// Map sandbox errors to proper HTTP status codes.
function sandboxError(res, err) {
  const msg = err && err.message ? err.message : 'Sandbox error';
  let status = 500;
  if (/not found|no such|does not exist/i.test(msg)) status = 404;
  else if (/required|invalid|traversal|blocked|timeout|timeout/i.test(msg)) status = 400;
  else if (/docker is not running|limit reached/i.test(msg)) status = 503;
  res.status(status).json({ success: false, error: msg });
}

router.post('/create', async (req, res) => {
  try {
    const { projectId, options, ports } = req.body;
    if (!projectId) return res.status(400).json({ success: false, error: 'projectId required' });

    const sandboxOptions = { ...options };
    if (ports && Array.isArray(ports)) {
      sandboxOptions.ports = ports;
    }

    const sandbox = await sandboxManager.createSandbox(projectId, sandboxOptions);
    const sessionId = crypto.randomUUID();
    activeSessions.set(sessionId, { sandboxId: sandbox.id, projectId, createdAt: Date.now() });

    const inspect = await sandbox.container.inspect();
    const exposedPorts = {};
    if (inspect.NetworkSettings.Ports) {
      for (const [port, bindings] of Object.entries(inspect.NetworkSettings.Ports)) {
        if (bindings && bindings.length > 0) {
          exposedPorts[port] = bindings[0].HostPort;
        }
      }
    }

    res.json({
      success: true,
      sandbox: {
        id: sandbox.id,
        projectId: sandbox.projectId,
        path: sandbox.path,
        createdAt: sandbox.createdAt,
        sessionId,
        exposedPorts
      }
    });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.get('/:sandboxId', async (req, res) => {
  try {
    const sandbox = sandboxManager.getSandbox(req.params.sandboxId);
    if (!sandbox) return res.status(404).json({ success: false, error: 'Sandbox not found' });

    res.json({
      success: true,
      sandbox: {
        id: sandbox.id,
        projectId: sandbox.projectId,
        path: sandbox.path,
        createdAt: sandbox.createdAt,
        lastActivity: sandbox.lastActivity,
        ports: Object.fromEntries(sandbox.ports)
      }
    });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/exec', async (req, res) => {
  try {
    const { command, options } = req.body;
    if (!command) return res.status(400).json({ success: false, error: 'command required' });

    const result = await sandboxManager.exec(req.params.sandboxId, command, options);
    res.json({ success: true, result });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/files/write', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ success: false, error: 'filePath required' });

    await sandboxManager.writeFile(req.params.sandboxId, filePath, content || '');
    res.json({ success: true });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.get('/:sandboxId/files/read', async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ success: false, error: 'path query required' });

    const content = await sandboxManager.readFile(req.params.sandboxId, filePath);
    res.json({ success: true, content });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

router.get('/:sandboxId/files/list', async (req, res) => {
  try {
    const { path: dirPath } = req.query;
    const files = await sandboxManager.listFiles(req.params.sandboxId, dirPath || '.');
    res.json({ success: true, files });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/dev/detect', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const result = await devServerManager.detectFramework(req.params.sandboxId, projectPath || '.');
    res.json({ success: true, result });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/dev/start', async (req, res) => {
  try {
    const { projectPath, customCommand } = req.body;
    const result = await devServerManager.startDevServer(req.params.sandboxId, projectPath || '.', { customCommand });
    res.json({ success: true, result });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/dev/stop', async (req, res) => {
  try {
    await devServerManager.stopDevServer(req.params.sandboxId);
    res.json({ success: true });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/dev/build', async (req, res) => {
  try {
    const { projectPath } = req.body;
    const result = await devServerManager.buildProject(req.params.sandboxId, projectPath || '.');
    res.json({ success: true, result });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/dev/restart', async (req, res) => {
  try {
    const { customCommand } = req.body || {};
    const result = await devServerManager.restartDevServer(req.params.sandboxId, { customCommand });
    res.json({ success: true, result });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.get('/:sandboxId/dev/status', async (req, res) => {
  try {
    const status = devServerManager.getStatus(req.params.sandboxId);
    res.json({ success: true, ...status });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.get('/:sandboxId/dev/logs', async (req, res) => {
  try {
    const server = devServerManager.getServer(req.params.sandboxId);
    res.json({ success: true, logs: server?.logs || [] });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.post('/:sandboxId/ports/expose', async (req, res) => {
  try {
    const { containerPort } = req.body;
    if (!containerPort) return res.status(400).json({ success: false, error: 'containerPort required' });

    const result = await sandboxManager.exposePort(req.params.sandboxId, containerPort);
    res.json({ success: true, result });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.delete('/:sandboxId', async (req, res) => {
  try {
    await sandboxManager.destroy(req.params.sandboxId);
    for (const [sessionId, session] of activeSessions) {
      if (session.sandboxId === req.params.sandboxId) {
        activeSessions.delete(sessionId);
        break;
      }
    }
    res.json({ success: true });
  } catch (err) {
    sandboxError(res, err);
  }
});

router.get('/project/:projectId', async (req, res) => {
  try {
    const sandboxes = sandboxManager.getSandboxesForProject(req.params.projectId);
    res.json({
      success: true,
      sandboxes: sandboxes.map(s => ({
        id: s.id,
        projectId: s.projectId,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        ports: Object.fromEntries(s.ports)
      }))
    });
  } catch (err) {
    sandboxError(res, err);
  }
});

module.exports = router;