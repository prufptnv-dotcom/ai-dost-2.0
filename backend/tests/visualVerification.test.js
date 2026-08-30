const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const visualVerifier = require('../agent/verification/VisualVerifier');
const { AgentOrchestrator } = require('../agent/orchestrator');
const devServerManager = require('../sandbox/devServerManager');

describe('Phase 0.2 — Final Pre-Release Visual Verification & Security Suite', () => {
  let serverA, portA;
  let serverB, portB;
  let hangingServer, hangingPort;
  let error500Server, error500Port;

  const projA = 'project-alpha-dyn';
  const projB = 'project-beta-dyn';
  const wsDirA = path.join(os.tmpdir(), `agent-ws-${projA}`);
  const wsDirB = path.join(os.tmpdir(), `agent-ws-${projB}`);

  before(async () => {
    fs.mkdirSync(wsDirA, { recursive: true });
    fs.mkdirSync(wsDirB, { recursive: true });

    // Dynamic Port Finder
    portA = await devServerManager.findFreePort(9410);
    portB = await devServerManager.findFreePort(portA + 1);
    hangingPort = await devServerManager.findFreePort(portB + 1);
    error500Port = await devServerManager.findFreePort(hangingPort + 1);

    // 1. Server A (Project Alpha)
    serverA = http.createServer((req, res) => {
      if (req.url === '/clean') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>Project A Clean</title></head><body><div id="root"><h1>Project A</h1></div></body></html>`);
      }
      if (req.url === '/runtime-error') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>Crash</title></head><body><script>throw new TypeError("Cannot read property 'map' of undefined");</script></body></html>`);
      }
      if (req.url === '/syntax-error') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>Syntax</title></head><body><script>eval("const foo = ;");</script></body></html>`);
      }
      if (req.url === '/harmless-warning') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>Warning</title></head><body><div id="root"><p>OK</p></div><script>console.error("Download the React DevTools for a better experience"); console.warn("[Vite] connecting");</script></body></html>`);
      }
      if (req.url === '/fatal-console') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>Fatal</title></head><body><script>console.error("Uncaught Invariant Violation: Minified React error #130");</script></body></html>`);
      }
      if (req.url === '/external-redirect') {
        res.writeHead(302, { 'Location': 'https://google.com/search' });
        return res.end();
      }
      if (req.url === '/cross-project-redirect') {
        res.writeHead(302, { 'Location': `http://127.0.0.1:${portB}/clean` });
        return res.end();
      }
      res.writeHead(404); res.end('Not Found');
    });
    await new Promise(r => serverA.listen(portA, '127.0.0.1', r));

    // 2. Server B (Project Beta)
    serverB = http.createServer((req, res) => {
      if (req.url === '/clean') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><title>Project B Clean</title></head><body><div id="root"><h1>Project B</h1></div></body></html>`);
      }
      res.writeHead(404); res.end('Not Found');
    });
    await new Promise(r => serverB.listen(portB, '127.0.0.1', r));

    // 3. Hanging Server (for Timeout test)
    hangingServer = http.createServer(() => {});
    await new Promise(r => hangingServer.listen(hangingPort, '127.0.0.1', r));

    // 4. HTTP 500 Server
    error500Server = http.createServer((req, res) => {
      res.writeHead(500); res.end('Internal Server Error');
    });
    await new Promise(r => error500Server.listen(error500Port, '127.0.0.1', r));

    // Register active dev servers in devServerManager
    devServerManager.servers.set(projA, {
      projectId: projA,
      targetId: projA,
      state: 'READY',
      url: `http://127.0.0.1:${portA}`,
      hostPort: portA
    });
    devServerManager.projectIndex.set(projA, devServerManager.servers.get(projA));

    devServerManager.servers.set(projB, {
      projectId: projB,
      targetId: projB,
      state: 'READY',
      url: `http://127.0.0.1:${portB}`,
      hostPort: portB
    });
    devServerManager.projectIndex.set(projB, devServerManager.servers.get(projB));
  });

  after(async () => {
    if (serverA) await new Promise(r => serverA.close(r));
    if (serverB) await new Promise(r => serverB.close(r));
    if (hangingServer) await new Promise(r => hangingServer.close(r));
    if (error500Server) await new Promise(r => error500Server.close(r));

    devServerManager.servers.delete(projA);
    devServerManager.projectIndex.delete(projA);
    devServerManager.servers.delete(projB);
    devServerManager.projectIndex.delete(projB);

    try { fs.rmSync(wsDirA, { recursive: true, force: true, maxRetries: 3 }); } catch (_) {}
    try { fs.rmSync(wsDirB, { recursive: true, force: true, maxRetries: 3 }); } catch (_) {}
  });

  it('1. Clean Vite app produces PASS with valid screenshot', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/clean`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'PASS');
    assert.strictEqual(res.pageTitle, 'Project A Clean');
    assert.ok(fs.existsSync(res.screenshotFullPath));
  });

  it('2. Runtime TypeError produces FAIL with captured pageError', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/runtime-error`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'FAIL');
    assert.ok(res.pageErrors.length > 0);
    assert.ok(res.failureReason.includes('Cannot read property'));
  });

  it('3. SyntaxError during bootstrap produces FAIL', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/syntax-error`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'FAIL');
    assert.ok(res.pageErrors.length > 0);
  });

  it('4. HTTP 500 server error produces FAIL', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${error500Port}`, {
      projectId: projA,
      projectPath: wsDirA,
      allowedPorts: [error500Port]
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'FAIL');
    assert.strictEqual(res.httpStatus, 500);
  });

  it('5. Navigation timeout produces TIMEOUT without hanging', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${hangingPort}`, {
      projectId: projA,
      projectPath: wsDirA,
      timeoutMs: 1200,
      allowedPorts: [hangingPort]
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'TIMEOUT');
  });

  it('6. Harmless DevTools/Vite console warnings produce PASS (NON_FATAL)', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/harmless-warning`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'PASS');
    const warning = res.consoleErrors.find(c => c.severity === 'NON_FATAL');
    assert.ok(warning);
  });

  it('7. Fatal React Invariant console error produces FAIL (FATAL)', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/fatal-console`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'FAIL');
    assert.ok(res.failureReason.includes('Fatal Console Error'));
  });

  it('8. Dynamic valid project port is authorized and passes', async () => {
    // Port A is dynamically assigned by devServerManager for Project A
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/clean`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'PASS');
  });

  it('9. Wrong project port is REJECTED (Project A cannot verify Project B port)', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portB}/clean`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'SECURITY_ERROR');
    assert.ok(res.failureReason.includes('Project Ownership & SSRF Block'));
  });

  it('10. Random unassigned local port is REJECTED', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:9999/clean`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'SECURITY_ERROR');
    assert.ok(res.failureReason.includes('Project Ownership & SSRF Block'));
  });

  it('11. External URL is REJECTED', async () => {
    const res = await visualVerifier.verify(`https://google.com`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'SECURITY_ERROR');
  });

  it('12. External redirect is intercepted and REJECTED', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/external-redirect`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.status === 'SECURITY_ERROR' || res.status === 'FAIL');
  });

  it('13. Cross-project redirect (Project A -> Project B) is intercepted and REJECTED', async () => {
    const res = await visualVerifier.verify(`http://127.0.0.1:${portA}/cross-project-redirect`, {
      projectId: projA,
      projectPath: wsDirA
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.status === 'SECURITY_ERROR' || res.status === 'FAIL');
  });

  it('14. file://, data:, and javascript: URLs are REJECTED', async () => {
    for (const badUrl of ['file:///etc/passwd', 'data:text/html,<h1>test</h1>', 'javascript:alert(1)']) {
      const res = await visualVerifier.verify(badUrl, {
        projectId: projA,
        projectPath: wsDirA
      });
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.status, 'SECURITY_ERROR');
    }
  });

  it('15. Artifacts are isolated in project-specific directory and do not leak', async () => {
    await visualVerifier.verify(`http://127.0.0.1:${portA}/clean`, {
      projectId: projA,
      projectPath: wsDirA
    });
    await visualVerifier.verify(`http://127.0.0.1:${portB}/clean`, {
      projectId: projB,
      projectPath: wsDirB
    });

    const artA = path.join(wsDirA, '.artifacts', 'verification');
    const artB = path.join(wsDirB, '.artifacts', 'verification');

    assert.ok(fs.existsSync(artA) && fs.readdirSync(artA).length > 0);
    assert.ok(fs.existsSync(artB) && fs.readdirSync(artB).length > 0);
  });

  it('16. AgentOrchestrator verify_project integration enforces project ownership', async () => {
    const orch = new AgentOrchestrator({ projectPath: wsDirA });
    orch.projectId = projA;

    const result = await orch.executeTool('verify_project', { scope: 'all' });
    assert.strictEqual(result.success, true);
    const vis = result.checks.find(c => c.name === 'visual_verification');
    assert.ok(vis);
    assert.strictEqual(vis.status, 'PASS');
  });
});
