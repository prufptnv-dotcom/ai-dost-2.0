const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'production';
process.env.CORS_ORIGINS = 'https://app.example.com';

const hardening = require('../security-hardening');
const express = require('express');

function request(server, { method = 'GET', path = '/', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function withApp(handler) {
  const app = express();
  app.use(require('cors')());
  app.use(express.json());
  handler(app);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await request(server, arguments.length > 1 ? arguments[1] : {});
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('security hardening configuration', () => {
  test('production CORS is deny-by-default', () => {
    assert.deepEqual(hardening.corsOrigins, ['https://app.example.com']);
    assert.equal(hardening.isOriginAllowed('https://app.example.com'), true);
    assert.equal(hardening.isOriginAllowed('https://evil.example'), false);
    assert.equal(hardening.isOriginAllowed(undefined), true);
  });

  test('JSON defaults are bounded and large routes are explicit', () => {
    assert.equal(hardening.smallJsonLimit, '2mb');
    assert.equal(hardening.largeJsonLimit, '50mb');
    assert.ok(hardening.largeJsonPrefixes.includes('/api/image'));
    assert.ok(hardening.largeJsonPrefixes.includes('/api/pdf'));
  });
});

describe('security hardening runtime middleware', () => {
  test('allowed CORS origin succeeds', async () => {
    const app = express();
    app.use(require('cors')());
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const out = await request(server, {
        path: '/ping',
        headers: { Origin: 'https://app.example.com' },
      });
      assert.equal(out.status, 200);
      assert.equal(out.headers['access-control-allow-origin'], 'https://app.example.com');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('disallowed CORS origin is rejected', async () => {
    const app = express();
    app.use(require('cors')());
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const out = await request(server, {
        path: '/ping',
        headers: { Origin: 'https://evil.example' },
      });
      assert.equal(out.status, 500);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('small JSON payload over the default limit is rejected', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/test', (_req, res) => res.json({ ok: true }));
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const body = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024 + 1024) });
      const out = await request(server, {
        method: 'POST',
        path: '/api/test',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      assert.equal(out.status, 413);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('large JSON routes retain the explicit larger allowance', async () => {
    const app = express();
    app.use(express.json());
    app.post('/api/image/generate', (req, res) => res.json({ received: req.body.data.length }));
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const body = JSON.stringify({ data: 'x'.repeat(2 * 1024 * 1024 + 1024) });
      const out = await request(server, {
        method: 'POST',
        path: '/api/image/generate',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      assert.equal(out.status, 200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

test('finish/close duplicate callback releases only once', async () => {
  let calls = 0;
  const server = http.createServer((_req, res) => {
    const release = () => { calls += 1; };
    res.on('finish', release);
    res.on('close', release);
    res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await request(server, { path: '/' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
