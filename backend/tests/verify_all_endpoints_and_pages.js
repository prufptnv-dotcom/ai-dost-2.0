const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('=================================================');
console.log('🚀 AI-DOST DEEP END-TO-END VERIFICATION SUITE');
console.log('=================================================\n');

function makeRequest(urlPath, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(`http://localhost:3000${urlPath}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ status: 500, error: err.message });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

async function runAudit() {
  let total = 0;
  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    total++;
    process.stdout.write(`⏳ [${total}] ${name}... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (e) {
      console.log(`❌ FAILED: ${e.message}`);
      failed++;
    }
  }

  console.log('--- 1. BACKEND ROUTE & API VERIFICATION ---');

  await check('GET /health (Backend Health Check)', async () => {
    const r = await makeRequest('/health');
    if (r.status !== 200 || r.data.status !== 'OK') throw new Error(`Status ${r.status}`);
  });

  await check('GET /api/chat/local-models (Ollama/Local Models)', async () => {
    const r = await makeRequest('/api/chat/local-models');
    if (r.status !== 200 || !r.data.success) throw new Error(`Status ${r.status}`);
  });

  await check('POST /api/chat (Multi-LLM Chat Route)', async () => {
    const r = await makeRequest('/api/chat', 'POST', { message: 'Hello AI Dost', mode: 'chat' });
    if (r.status !== 200 || !r.data.reply) throw new Error(`Status ${r.status}`);
  });

  await check('POST /api/image/generate (Image Generation Route)', async () => {
    const r = await makeRequest('/api/image/generate', 'POST', { prompt: 'Futuristic AI helper' });
    if (r.status !== 200 || !r.data.imageUrl) throw new Error(`Status ${r.status}`);
  });

  await check('POST /api/pdf/generate (PDF Report Route)', async () => {
    const r = await makeRequest('/api/pdf/generate', 'POST', { title: 'Audit Report', content: 'All systems operational' });
    if (r.status !== 200 || !r.data.downloadUrl) throw new Error(`Status ${r.status}`);
  });

  await check('POST /api/agent/search (Codebase RAG Search)', async () => {
    const r = await makeRequest('/api/agent/search', 'POST', { query: 'server', projectPath: path.join(__dirname, '..') });
    if (r.status !== 200 || !Array.isArray(r.data.results)) throw new Error(`Status ${r.status}`);
  });

  await check('GET /api/git/log (Git Log Inspection)', async () => {
    const r = await makeRequest('/api/git/log');
    if (r.status !== 200 || !Array.isArray(r.data.commits)) throw new Error(`Status ${r.status}`);
  });

  await check('POST /api/learning/feedback & GET /stats (Personal Brain)', async () => {
    const r1 = await makeRequest('/api/learning/feedback', 'POST', { type: 'up', aiReply: 'test' });
    if (r1.status !== 200) throw new Error(`Feedback Status ${r1.status}`);
    const r2 = await makeRequest('/api/learning/stats');
    if (r2.status !== 200 || !r2.data.success || r2.data.totalFeedback === undefined) throw new Error(`Stats Status ${r2.status}`);
  });

  await check('POST /api/agent/run (Autonomous Agent SSE Endpoint)', async () => {
    const r = await makeRequest('/api/agent/run', 'POST', { userPrompt: 'echo test', projectPath: path.join(__dirname, '..') });
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });

  console.log('\n=================================================');
  console.log(`📊 FINAL VERIFICATION RESULT: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log('=================================================');
}

runAudit();
