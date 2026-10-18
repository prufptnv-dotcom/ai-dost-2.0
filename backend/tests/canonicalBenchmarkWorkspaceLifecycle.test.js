'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createBenchmarkWorkspace,
  deleteBenchmarkWorkspace
} = require('../scripts/run-canonical-app-benchmark');

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(value); }
  };
}

test('benchmark lifecycle seeds the actual WorkspaceManager-compatible path and deletes it afterward', async () => {
  const originalFetch = global.fetch;
  const projectId = 'aidost-benchmark-lifecycle-test-' + process.pid + '-' + Date.now();
  const workspaceDir = path.join(os.tmpdir(), 'agent-ws-' + projectId);
  const config = { baseUrl: 'http://127.0.0.1:5000', userId: 'local-user' };
  const calls = [];

  global.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    calls.push({ path: url.pathname, method: options.method, headers: options.headers || {} });
    if (url.pathname === '/api/v1/memory/project' && options.method === 'POST') {
      fs.mkdirSync(workspaceDir, { recursive: true });
      return jsonResponse({ project_id: projectId });
    }
    if (url.pathname === '/api/v1/memory/project/' + projectId + '/file' && options.method === 'POST') {
      const body = JSON.parse(options.body);
      const target = path.join(workspaceDir, body.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body.content, 'utf8');
      return jsonResponse({ success: true });
    }
    if (url.pathname === '/api/v1/memory/project/' + projectId && options.method === 'DELETE') {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
      return jsonResponse({ success: true });
    }
    return jsonResponse({ success: false, error: 'Unexpected test route' }, 404);
  };

  try {
    const seeded = await createBenchmarkWorkspace(config, projectId, {
      'package.json': '{"name":"seeded"}\n',
      'src/App.jsx': 'export default function App(){ return null; }\n'
    });
    assert.equal(seeded, workspaceDir);
    assert.equal(fs.readFileSync(path.join(seeded, 'package.json'), 'utf8'), '{"name":"seeded"}\n');
    assert.equal(fs.readFileSync(path.join(seeded, 'src', 'App.jsx'), 'utf8'), 'export default function App(){ return null; }\n');
    assert.ok(calls.every((call) => call.headers['x-user-id'] === 'local-user'));

    await deleteBenchmarkWorkspace(config, projectId);
    assert.equal(fs.existsSync(workspaceDir), false);
    assert.equal(calls.at(-1).method, 'DELETE');
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test('benchmark lifecycle removes a partially seeded project when file persistence cannot be verified', async () => {
  const originalFetch = global.fetch;
  const projectId = 'aidost-benchmark-lifecycle-fail-' + process.pid + '-' + Date.now();
  const workspaceDir = path.join(os.tmpdir(), 'agent-ws-' + projectId);
  const config = { baseUrl: 'http://127.0.0.1:5000', userId: 'local-user' };
  const calls = [];

  global.fetch = async (rawUrl, options = {}) => {
    const url = new URL(rawUrl);
    calls.push({ path: url.pathname, method: options.method });
    if (url.pathname === '/api/v1/memory/project' && options.method === 'POST') {
      fs.mkdirSync(workspaceDir, { recursive: true });
      return jsonResponse({ project_id: projectId });
    }
    if (url.pathname === '/api/v1/memory/project/' + projectId + '/file' && options.method === 'POST') {
      // Simulate an API that claims success but did not actually persist the file.
      return jsonResponse({ success: true });
    }
    if (url.pathname === '/api/v1/memory/project/' + projectId && options.method === 'DELETE') {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
      return jsonResponse({ success: true });
    }
    return jsonResponse({ success: false, error: 'Unexpected test route' }, 404);
  };

  try {
    await assert.rejects(
      createBenchmarkWorkspace(config, projectId, { 'src/seed.js': 'module.exports = true;\n' }),
      /Seed file could not be verified/
    );
    assert.equal(fs.existsSync(workspaceDir), false);
    assert.equal(calls.at(-1).method, 'DELETE', 'Partial benchmark project should be removed.');
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});
