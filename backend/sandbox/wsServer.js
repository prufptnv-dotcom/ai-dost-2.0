const WebSocket = require('ws');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const sandboxManager = require('./sandboxManager');
const devServerManager = require('./devServerManager');

class SandboxWebSocketServer extends EventEmitter {
  constructor(server) {
    super();
    this.wss = new WebSocket.Server({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
      const pathname = (request.url || '').split('?')[0];
      if (pathname === '/api/sandbox/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      }
    });
    this.clients = new Map();
    this.setup();
  }

  setup() {
    this.wss.on('connection', (ws, req) => {
      const clientId = crypto.randomUUID();
      const client = { ws, id: clientId, sandboxes: new Set(), subscribed: new Set() };
      
      this.clients.set(clientId, client);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      
      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleClose(clientId));
      ws.on('error', (err) => this.handleError(clientId, err));
      
      this.send(clientId, { type: 'connected', clientId });
      console.log(`Sandbox WS client connected: ${clientId}`);
    });

    const interval = setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    interval.unref();

    this.wss.on('close', () => clearInterval(interval));
  }

  handleMessage(clientId, data) {
    try {
      const msg = JSON.parse(data.toString());
      const client = this.clients.get(clientId);
      if (!client) return;

      switch (msg.type) {
        case 'create':
          this.handleCreate(clientId, msg.payload);
          break;
        case 'exec':
          this.handleExec(clientId, msg.payload);
          break;
        case 'write':
          this.handleWrite(clientId, msg.payload);
          break;
        case 'read':
          this.handleRead(clientId, msg.payload);
          break;
        case 'list':
          this.handleList(clientId, msg.payload);
          break;
        case 'dev:start':
          this.handleDevStart(clientId, msg.payload);
          break;
        case 'dev:stop':
          this.handleDevStop(clientId, msg.payload);
          break;
        case 'dev:build':
          this.handleDevBuild(clientId, msg.payload);
          break;
        case 'dev:detect':
          this.handleDevDetect(clientId, msg.payload);
          break;
        case 'expose':
          this.handleExpose(clientId, msg.payload);
          break;
        case 'subscribe':
          this.handleSubscribe(clientId, msg.payload);
          break;
        case 'destroy':
          this.handleDestroy(clientId, msg.payload);
          break;
        case 'ping':
          this.send(clientId, { type: 'pong', timestamp: Date.now() });
          break;
        default:
          this.send(clientId, { type: 'error', error: `Unknown message type: ${msg.type}` });
      }
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message });
    }
  }

  async handleCreate(clientId, payload) {
    try {
      const sandbox = await sandboxManager.createSandbox(payload.projectId, payload.options);
      const client = this.clients.get(clientId);
      client.sandboxes.add(sandbox.id);
      this.send(clientId, { type: 'created', sandbox: this.serializeSandbox(sandbox) });
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  async handleExec(clientId, payload) {
    const { sandboxId, command, options } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    this.send(clientId, { type: 'exec:start', sandboxId, requestId: payload.requestId });
    
    try {
      const result = await sandboxManager.exec(sandboxId, command, options);
      this.send(clientId, { type: 'exec:result', sandboxId, result, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'exec:error', sandboxId, error: err.message, requestId: payload.requestId });
    }
  }

  async handleWrite(clientId, payload) {
    const { sandboxId, filePath, content } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      await sandboxManager.writeFile(sandboxId, filePath, content);
      this.send(clientId, { type: 'write:result', sandboxId, filePath, success: true, requestId: payload.requestId });
      this.broadcast(sandboxId, { type: 'file:changed', sandboxId, filePath, action: 'write' }, clientId);
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  async handleRead(clientId, payload) {
    const { sandboxId, filePath } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      const content = await sandboxManager.readFile(sandboxId, filePath);
      this.send(clientId, { type: 'read:result', sandboxId, filePath, content, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  async handleList(clientId, payload) {
    const { sandboxId, dirPath } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      const files = await sandboxManager.listFiles(sandboxId, dirPath);
      this.send(clientId, { type: 'list:result', sandboxId, files, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  async handleDevStart(clientId, payload) {
    const { sandboxId, projectPath, customCommand } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    this.send(clientId, { type: 'dev:start:progress', sandboxId, stage: 'detecting', requestId: payload.requestId });
    
    try {
      const result = await devServerManager.startDevServer(sandboxId, projectPath, { customCommand });
      this.send(clientId, { type: 'dev:start:result', sandboxId, result, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'dev:start:error', sandboxId, error: err.message, requestId: payload.requestId });
    }
  }

  async handleDevStop(clientId, payload) {
    const { sandboxId } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      await devServerManager.stopDevServer(sandboxId);
      this.send(clientId, { type: 'dev:stop:result', sandboxId, success: true, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'dev:stop:error', sandboxId, error: err.message, requestId: payload.requestId });
    }
  }

  async handleDevBuild(clientId, payload) {
    const { sandboxId, projectPath } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    this.send(clientId, { type: 'dev:build:progress', sandboxId, stage: 'building', requestId: payload.requestId });
    
    try {
      const result = await devServerManager.buildProject(sandboxId, projectPath);
      this.send(clientId, { type: 'dev:build:result', sandboxId, result, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'dev:build:error', sandboxId, error: err.message, requestId: payload.requestId });
    }
  }

  async handleDevDetect(clientId, payload) {
    const { sandboxId, projectPath } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      const result = await devServerManager.detectFramework(sandboxId, projectPath);
      this.send(clientId, { type: 'dev:detect:result', sandboxId, result, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  async handleExpose(clientId, payload) {
    const { sandboxId, containerPort } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      const result = await sandboxManager.exposePort(sandboxId, containerPort);
      this.send(clientId, { type: 'expose:result', sandboxId, result, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  handleSubscribe(clientId, payload) {
    const { sandboxId, events } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    for (const event of events) {
      client.subscribed.add(`${sandboxId}:${event}`);
    }
    this.send(clientId, { type: 'subscribed', sandboxId, events, requestId: payload.requestId });
  }

  async handleDestroy(clientId, payload) {
    const { sandboxId } = payload;
    const client = this.clients.get(clientId);
    if (!client.sandboxes.has(sandboxId)) {
      return this.send(clientId, { type: 'error', error: 'Sandbox not accessible', requestId: payload.requestId });
    }

    try {
      await sandboxManager.destroy(sandboxId);
      client.sandboxes.delete(sandboxId);
      this.send(clientId, { type: 'destroyed', sandboxId, requestId: payload.requestId });
    } catch (err) {
      this.send(clientId, { type: 'error', error: err.message, requestId: payload.requestId });
    }
  }

  handleClose(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      for (const sandboxId of client.sandboxes) {
        sandboxManager.destroy(sandboxId).catch(() => {});
      }
      this.clients.delete(clientId);
      console.log(`Sandbox WS client disconnected: ${clientId}`);
    }
  }

  handleError(clientId, err) {
    console.error(`Sandbox WS error for ${clientId}:`, err.message);
  }

  send(clientId, msg) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }

  broadcast(sandboxId, msg, excludeClientId = null) {
    for (const [id, client] of this.clients) {
      if (id !== excludeClientId && client.sandboxes.has(sandboxId)) {
        const subKey = `${sandboxId}:${msg.type.split(':')[0]}`;
        if (client.subscribed.has(subKey) || client.subscribed.has(`${sandboxId}:*`)) {
          this.send(id, msg);
        }
      }
    }
  }

  serializeSandbox(sandbox) {
    return {
      id: sandbox.id,
      projectId: sandbox.projectId,
      path: sandbox.path,
      createdAt: sandbox.createdAt,
      lastActivity: sandbox.lastActivity,
      ports: Object.fromEntries(sandbox.ports),
      status: 'running'
    };
  }

  emitLog(sandboxId, log) {
    this.broadcast(sandboxId, { type: 'log', sandboxId, ...log });
  }

  emitFileChange(sandboxId, filePath, action) {
    this.broadcast(sandboxId, { type: 'file:changed', sandboxId, filePath, action });
  }
}

module.exports = SandboxWebSocketServer;