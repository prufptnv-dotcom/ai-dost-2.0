const { spawn } = require('child_process');
const path = require('path');

const BACKEND_PORT = process.env.BACKEND_PORT || process.env.PORT || '5000';
const BASE_URL = `http://localhost:${BACKEND_PORT}`;
const BACKEND_DIR = path.resolve(__dirname, '..');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(urlPath, method = 'GET', body = null) {
  const url = new URL(urlPath, BASE_URL);
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
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

async function runChatTests() {
  console.log('\n=================================================');
  console.log('💬 AI DOST CHAT ENDPOINT TESTS');
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

  // 1. Health endpoint
  await test('GET /health', async () => {
    const res = await makeRequest('/health');
    if (res.status !== 200 || res.data.status !== 'OK') {
      throw new Error(`Expected HTTP 200 OK, got ${res.status}`);
    }
    console.log(`   Services: Groq=${res.data.groqKey}, Gemini=${res.data.geminiKey}, NVIDIA=${res.data.nvidiaKey}`);
  });

  // 2. Service health check
  await test('GET /api/chat/health/services', async () => {
    const res = await makeRequest('/api/chat/health/services');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Expected success, got ${res.status}`);
    }
    console.log(`   Available services:`, Object.entries(res.data.services).filter(([k,v]) => v.available).map(([k]) => k).join(', '));
  });

  // 3. Local models endpoint
  await test('GET /api/chat/local-models', async () => {
    const res = await makeRequest('/api/chat/local-models');
    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Expected success, got ${res.status}`);
    }
    console.log(`   Local models: ${res.data.models.length}`);
  });

  // 4. Chat with auto-select (no API keys needed for fallback test)
  await test('POST /api/chat - Auto select (no model)', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Hello, how are you?',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (!res.data.success || !res.data.reply) {
      throw new Error(`Invalid response: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Model used: ${res.data.model}, Duration: ${res.data.duration}ms`);
    console.log(`   Fallbacks attempted: ${res.data.fallbacksAttempted?.join(', ') || 'none'}`);
  });

  // 5. Chat with specific model (groq)
  await test('POST /api/chat - Groq model', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Write a hello world in Python',
      model: 'groq',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Model used: ${res.data.model}`);
    console.log(`   Reply preview: ${res.data.reply?.substring(0, 100)}...`);
  });

  // 6. Chat with coding intent
  await test('POST /api/chat - Coding intent detection', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Debug this code: function add(a,b) { return a - b; }',
      section: 'coding',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`   Model used: ${res.data.model}`);
    console.log(`   Reply contains code: ${res.data.reply?.includes('function') || res.data.reply?.includes('```')}`);
  });

  // 7. Chat with writing intent
  await test('POST /api/chat - Writing intent detection', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Write a blog post about AI',
      section: 'writing',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`   Model used: ${res.data.model}`);
  });

  // 8. Chat with math intent
  await test('POST /api/chat - Math intent detection', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Solve 2x + 5 = 15 step by step',
      section: 'math',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`   Model used: ${res.data.model}`);
  });

  // 9. Chat with translation intent
  await test('POST /api/chat - Translation intent detection', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Translate "Hello world" to Hindi',
      section: 'translation',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`   Model used: ${res.data.model}`);
  });

  // 10. Error handling - empty message
  await test('POST /api/chat - Empty message validation', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: '',
      model: 'groq'
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}`);
    }
    if (!res.data.error || res.data.code !== 'MISSING_MESSAGE') {
      throw new Error(`Expected validation error: ${JSON.stringify(res.data)}`);
    }
    console.log(`   Correctly rejected empty message`);
  });

  // 11. Test with history
  await test('POST /api/chat - With conversation history', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'What did I just ask?',
      model: 'auto',
      history: [
        { role: 'user', content: 'My name is Vikash' },
        { role: 'assistant', content: 'Nice to meet you Vikash!' }
      ],
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`   Model used: ${res.data.model}`);
    console.log(`   Reply mentions name: ${res.data.reply?.toLowerCase().includes('vikash')}`);
  });

  // 12. Test with file content
  await test('POST /api/chat - With file content', async () => {
    const res = await makeRequest('/api/chat', 'POST', {
      message: 'Explain this code',
      model: 'auto',
      fileContent: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }',
      mode: 'chat'
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`   Model used: ${res.data.model}`);
    console.log(`   Reply mentions fibonacci: ${res.data.reply?.toLowerCase().includes('fibonacci')}`);
  });

  // 13. 404 handler
  await test('GET /api/nonexistent (404 handler)', async () => {
    const res = await makeRequest('/api/nonexistent');
    if (res.status !== 404 || !res.data.error) {
      throw new Error(`Expected 404 error response, got ${res.status}`);
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

runChatTests()
  .catch(err => {
    console.error('💥 Test suite crashed:', err);
    process.exit(1);
  });