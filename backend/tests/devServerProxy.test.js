const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const express = require('express');

const devServerManager = require('../sandbox/devServerManager');
const previewRouter = require('../routes/preview');

describe('Phase 0.1 — Dev Server & Live Preview Proxy Test Suite', () => {
  let mockServer;
  let mockPort;
  let previewApp;
  let previewServer;
  let previewPort;
  const testProjectId = 'test-phase-preview-1';

  before(async () => {
    // 1. Create a dummy backend dev server simulating a running Vite/Next app
    mockPort = await devServerManager.findFreePort(5900);
    mockServer = http.createServer((req, res) => {
      if (req.url === '/api/test-json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', framework: 'Vite', port: mockPort }));
      }
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('OK');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body><h1>Running on :${mockPort}</h1></body></html>`);
    });

    await new Promise((resolve) => mockServer.listen(mockPort, '127.0.0.1', resolve));

    // 2. Create an Express app hosting the preview router
    previewApp = express();
    previewApp.use(express.json());
    previewApp.use('/api/preview', previewRouter);

    previewPort = await devServerManager.findFreePort(6100);
    previewServer = http.createServer(previewApp);
    await new Promise((resolve) => previewServer.listen(previewPort, '127.0.0.1', resolve));
  });

  after(async () => {
    await devServerManager.cleanup();
    if (mockServer) await new Promise((r) => mockServer.close(r));
    if (previewServer) await new Promise((r) => previewServer.close(r));
    // Clean up temporary test workspace
    const wsDir = path.join(os.tmpdir(), `agent-ws-${testProjectId}`);
    if (fs.existsSync(wsDir)) {
      fs.rmSync(wsDir, { recursive: true, force: true });
    }
  });

  it('1. should find free ports dynamically', async () => {
    const p1 = await devServerManager.findFreePort(7000);
    const p2 = await devServerManager.findFreePort(7000);
    assert.ok(typeof p1 === 'number' && p1 > 1024);
    assert.ok(typeof p2 === 'number' && p2 > 1024);
  });

  it('2. should detect framework from project workspace files', async () => {
    const wsDir = path.join(os.tmpdir(), `agent-ws-${testProjectId}`);
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'vite.config.js'), 'export default {}');
    fs.writeFileSync(path.join(wsDir, 'package.json'), JSON.stringify({ name: 'test-vite', scripts: { dev: 'vite' } }));

    const detected = await devServerManager.detectFramework(testProjectId, '.');
    assert.strictEqual(detected.framework, 'vite');
    assert.strictEqual(detected.config.framework, 'Vite');
  });

  it('3. should track server states (CREATING, STARTING, READY, STOPPED, FAILED)', () => {
    const dummyServer = {
      targetId: 'dummy-1',
      projectId: 'dummy-1',
      state: 'CREATING',
      url: null,
      logs: []
    };
    devServerManager.servers.set('dummy-1', dummyServer);
    devServerManager.projectIndex.set('dummy-1', dummyServer);

    devServerManager.emitState(dummyServer, 'STARTING');
    assert.strictEqual(dummyServer.state, 'STARTING');

    devServerManager.emitState(dummyServer, 'READY');
    assert.strictEqual(dummyServer.state, 'READY');

    devServerManager.emitState(dummyServer, 'FAILED', 'Port conflict');
    assert.strictEqual(dummyServer.state, 'FAILED');
    assert.strictEqual(dummyServer.error, 'Port conflict');

    devServerManager.emitState(dummyServer, 'STOPPED');
    assert.strictEqual(dummyServer.state, 'STOPPED');

    devServerManager.servers.delete('dummy-1');
    devServerManager.projectIndex.delete('dummy-1');
  });

  it('4. should log stdout and stderr into rolling log buffer', () => {
    const server = {
      targetId: 'test-log-proj',
      projectId: 'test-log-proj',
      state: 'STARTING',
      logs: []
    };
    devServerManager.servers.set('test-log-proj', server);
    devServerManager.projectIndex.set('test-log-proj', server);

    devServerManager.emitLog('test-log-proj', 'Vite v5.0.0 ready in 250ms', 'stdout');
    devServerManager.emitLog('test-log-proj', 'Local: http://localhost:5173', 'info');

    const status = devServerManager.getStatus('test-log-proj');
    assert.strictEqual(status.logs.length, 2);
    assert.ok(status.logs[0].message.includes('Vite v5.0.0'));

    devServerManager.servers.delete('test-log-proj');
    devServerManager.projectIndex.delete('test-log-proj');
  });

  it('5. should securely reverse-proxy live dev server HTTP requests when READY', async () => {
    // Register mock dev server as READY for testProjectId
    const liveServer = {
      targetId: testProjectId,
      projectId: testProjectId,
      state: 'READY',
      hostPort: mockPort,
      url: `http://127.0.0.1:${mockPort}`,
      framework: 'Vite',
      logs: []
    };
    devServerManager.servers.set(testProjectId, liveServer);
    devServerManager.projectIndex.set(testProjectId, liveServer);

    // Call proxy route: GET /api/preview/test-phase-preview-1/api/test-json
    const res = await fetch(`http://127.0.0.1:${previewPort}/api/preview/${testProjectId}/api/test-json`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.framework, 'Vite');
    assert.strictEqual(data.port, mockPort);
  });

  it('6. should render sleek loading HTML when server is STARTING', async () => {
    const startingServer = {
      targetId: 'proj-starting-test',
      projectId: 'proj-starting-test',
      state: 'STARTING',
      framework: 'Next.js',
      logs: [{ timestamp: Date.now(), message: 'npm install running...', type: 'info' }]
    };
    devServerManager.servers.set('proj-starting-test', startingServer);
    devServerManager.projectIndex.set('proj-starting-test', startingServer);

    const res = await fetch(`http://127.0.0.1:${previewPort}/api/preview/proj-starting-test`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Booting Dev Server'));
    assert.ok(html.includes('npm install running'));

    devServerManager.servers.delete('proj-starting-test');
    devServerManager.projectIndex.delete('proj-starting-test');
  });

  it('7. should render diagnostic error HTML when server is FAILED', async () => {
    const failedServer = {
      targetId: 'proj-failed-test',
      projectId: 'proj-failed-test',
      state: 'FAILED',
      error: 'Module not found: react',
      logs: []
    };
    devServerManager.servers.set('proj-failed-test', failedServer);
    devServerManager.projectIndex.set('proj-failed-test', failedServer);

    const res = await fetch(`http://127.0.0.1:${previewPort}/api/preview/proj-failed-test`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Dev Server Startup Failed'));
    assert.ok(html.includes('Module not found: react'));

    devServerManager.servers.delete('proj-failed-test');
    devServerManager.projectIndex.delete('proj-failed-test');
  });

  it('8. should fallback to static workspace files when no dev server is running', async () => {
    const staticProjId = 'proj-static-test';
    const wsDir = path.join(os.tmpdir(), `agent-ws-${staticProjId}`);
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'index.html'), '<html><body><h1>Static Hello</h1></body></html>');

    const res = await fetch(`http://127.0.0.1:${previewPort}/api/preview/${staticProjId}/index.html`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Static Hello'));

    fs.rmSync(wsDir, { recursive: true, force: true });
  });

  it('9. should reject path traversal attempts on static preview endpoints', async () => {
    const staticProjId = 'proj-static-sec';
    const wsDir = path.join(os.tmpdir(), `agent-ws-${staticProjId}`);
    fs.mkdirSync(wsDir, { recursive: true });
    fs.writeFileSync(path.join(wsDir, 'test.txt'), 'clean content');

    const res = await fetch(`http://127.0.0.1:${previewPort}/api/preview/${staticProjId}/%2e%2e%2f%2e%2e%2fetc%2fpasswd`);
    assert.ok(res.status === 400 || res.status === 404);
    if (res.status === 400) {
      const json = await res.json();
      assert.ok(json.error.includes('traversal blocked') || json.error.includes('Invalid path'));
    }

    fs.rmSync(wsDir, { recursive: true, force: true });
  });

  it('10. should report status via GET /api/preview/:projectId/status', async () => {
    const res = await fetch(`http://127.0.0.1:${previewPort}/api/preview/${testProjectId}/status`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.running, true);
    assert.strictEqual(json.state, 'READY');
    assert.strictEqual(json.hostPort, mockPort);
  });
});
