const { spawn } = require('child_process');
const path = require('path');

const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || '5000';
const BASE_URL = `http://localhost:${BACKEND_PORT}`;
const BACKEND_DIR = path.resolve(__dirname, '..');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeStreamRequest(urlPath, method = 'GET', body = null) {
  const url = new URL(urlPath, BASE_URL);
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${urlPath} failed: ${response.status} ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`${method} ${urlPath} failed: stream body unavailable`);
  }

  const { value, done } = await reader.read();
  if (done && !value) {
    throw new Error(`${method} ${urlPath} failed: empty stream`);
  }

  const chunk = value ? new TextDecoder().decode(value) : '';
  try { await reader.cancel(); } catch (_) {}
  return { status: response.status, data: { raw: chunk } };
}

async function isServerHealthy() {
  try {
    const res = await makeRequest('/health');
    return res.status === 200 && res.data?.status === 'OK';
  } catch (error) {
    return false;
  }
}

async function ensureServerRunning() {
  if (await isServerHealthy()) {
    return null;
  }

  const serverProcess = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
  serverProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await isServerHealthy()) {
      return serverProcess;
    }
    await sleep(500);
  }

  serverProcess.kill();
  throw new Error(`Backend server did not become healthy on ${BASE_URL}`);
}

function makeRequest(urlPath, method = 'GET', body = null) {
  const url = new URL(urlPath, BASE_URL);
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  }).then(async (res) => {
    const text = await res.text();
    try {
      return { status: res.status, data: text ? JSON.parse(text) : {} };
    } catch (e) {
      return { status: res.status, data: { raw: text } };
    }
  }).catch((err) => {
    throw new Error(`${method} ${urlPath} failed: ${err?.cause?.code || err?.name || err?.message}`);
  });
}

async function runAllBackendTests() {
  console.log('\n=================================================');
  console.log('🚀 AI DOST COMPREHENSIVE BACKEND TEST SUITE');
  console.log('=================================================\n');

  let passed = 0;
  let failed = 0;
  let serverProcess = null;
  let serverStartedByTest = false;

  try {
    const healthyBeforeStart = await isServerHealthy();
    if (!healthyBeforeStart) {
      serverProcess = await ensureServerRunning();
      serverStartedByTest = true;
    }
  } catch (error) {
    console.error(`💥 Unable to start backend server: ${error.message}`);
    process.exit(1);
  }

  async function test(name, fn) {
    try {
      console.log(`⏳ Testing: ${name}...`);
      await fn();
      console.log(`✅ PASSED: ${name}\n`);
      passed++;
    } catch (e) {
      console.error(`❌ FAILED: ${name} -> ${e.message}\n`);
      failed++;
    }
  }

  // 1. Health Endpoint
  await test('GET /health (Server Health & API Keys Status)', async () => {
    const res = await makeRequest('/health');
    if (res.status !== 200 || res.data.status !== 'OK') {
      throw new Error(`Expected HTTP 200 OK, got ${res.status}`);
    }
  });

  // 2. 404 Route Handler
  await test('GET /api/nonexistent (404 Error Handler)', async () => {
    const res = await makeRequest('/api/nonexistent');
    if (res.status !== 404 || !res.data.error) {
      throw new Error(`Expected 404 error response, got ${res.status}`);
    }
  });

  // 3. Image Generation Endpoint
  await test('POST /api/image/generate (Pollinations.ai Free Image Prompt)', async () => {
    const res = await makeRequest('/api/image/generate', 'POST', { prompt: 'A futuristic cybernetic robot friend writing code' });
    if (res.status !== 200 || !res.data.success || !res.data.imageUrl) {
      throw new Error(`Failed image generation response: ${JSON.stringify(res.data)}`);
    }
  });

  // 4. Git Operations
  await test('POST /api/git/init & /api/git/commit & GET /api/git/log', async () => {
    const initRes = await makeRequest('/api/git/init', 'POST', {});
    if (initRes.status !== 200 || !initRes.data.success) {
      throw new Error(`Git init failed: ${JSON.stringify(initRes.data)}`);
    }

    const commitRes = await makeRequest('/api/git/commit', 'POST', { message: 'Test commit from automated test suite' });
    if (commitRes.status !== 200 || (!commitRes.data.success && !commitRes.data.details?.includes('nothing to commit'))) {
      throw new Error(`Git commit failed: ${JSON.stringify(commitRes.data)}`);
    }

    const logRes = await makeRequest('/api/git/log', 'GET');
    if (logRes.status !== 200 || !logRes.data.success || !Array.isArray(logRes.data.commits)) {
      throw new Error(`Git log failed: ${JSON.stringify(logRes.data)}`);
    }
  });

  // 5. Personal Brain Learning & Feedback
  await test('POST /api/learning/feedback & GET /api/learning/stats', async () => {
    const fbRes = await makeRequest('/api/learning/feedback', 'POST', {
      type: 'up',
      message: 'Write a python script',
      aiReply: 'print("Hello")',
      category: 'coding'
    });
    if (fbRes.status !== 200 || !fbRes.data.success) {
      throw new Error(`Learning feedback failed: ${JSON.stringify(fbRes.data)}`);
    }

    const statsRes = await makeRequest('/api/learning/stats', 'GET');
    if (statsRes.status !== 200 || !statsRes.data.success) {
      throw new Error(`Learning stats failed: ${JSON.stringify(statsRes.data)}`);
    }
  });

  // 6. Codebase RAG Search Endpoint
  await test('POST /api/agent/search (In-memory Codebase RAG Search)', async () => {
    const res = await makeRequest('/api/agent/search', 'POST', {
      query: 'function executeTool',
      projectFiles: [
        { path: 'routes/agent.js', content: 'function executeTool(action, parameters) { return safeJoin(); }' }
      ]
    });
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Codebase search failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 7. PDF Generator Route
  await test('POST /api/pdf/generate (PDF Report Compiler)', async () => {
    const res = await makeRequest('/api/pdf/generate', 'POST', {
      title: 'Automated Test Report',
      content: '# Test Results\nAll backend services are operating smoothly with full error resilience.'
    });
    if (res.status !== 200 || !res.data.success || !res.data.downloadUrl) {
      throw new Error(`PDF generation failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 8. Chat Route Validation
  await test('POST /api/chat (Auto-Select Cascading Chat Model)', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Hi',
      model: 'groq',
      mode: 'chat'
    });
    if (res.status !== 200 || !res.data.success || !res.data.reply) {
      throw new Error(`Chat request failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 9. Agent ReAct Execution Loop & Streaming SSE Endpoint
  await test('POST /api/agent/run (Autonomous Agent ReAct Loop)', async () => {
    const res = await makeStreamRequest('/api/agent/run', 'POST', {
      userPrompt: 'Create a simple hello.py file that prints hello world',
      projectId: 'test_proj_123',
      projectFiles: [
        { path: 'main.py', content: 'print("main")' }
      ]
    });
    if (res.status !== 200 || !String(res.data.raw || '').includes('data:')) {
      throw new Error(`Agent run failed: ${JSON.stringify(res.data)}`);
    }
  });

  console.log('=================================================');
  console.log(`📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================\n');

  if (serverStartedByTest && serverProcess) {
    serverProcess.kill();
  }

  if (failed > 0) process.exit(1);
}

runAllBackendTests()
  .catch(err => {
    console.error('💥 Test suite crashed:', err);
    process.exit(1);
  });
