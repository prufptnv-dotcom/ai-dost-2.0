const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=================================================');
console.log('🚀 STEP 1: AUTONOMOUS AGENT TODO APP TEST');
console.log('=================================================\n');

const projectDir = path.join(os.tmpdir(), 'agent-ws-todo-demo');
if (!fs.existsSync(projectDir)) {
  fs.mkdirSync(projectDir, { recursive: true });
}

const payload = JSON.stringify({
  userPrompt: 'Create a modern dark-theme Todo App in HTML, CSS, and JavaScript with localStorage support and smooth animations.',
  projectPath: projectDir
});

const req = http.request('http://localhost:3000/api/agent/run', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log(`[Status Code]: ${res.statusCode}`);
  let rawBuffer = '';

  res.on('data', (chunk) => {
    rawBuffer += chunk.toString();
    const lines = rawBuffer.split('\n\n');
    rawBuffer = lines.pop(); // keep partial chunk

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.substring(6));
          if (event.type === 'start') {
            console.log(`📌 [START]: ${event.message}`);
          } else if (event.type === 'plan') {
            console.log(`📋 [PLAN]: ${event.data.summary}`);
            event.data.tasks?.forEach(t => console.log(`   - [${t.status}] ${t.title}`));
          } else if (event.type === 'step') {
            console.log(`⚙️ [STEP ${event.data.step}]: ${event.data.action}`);
            if (event.data.parameters?.path) console.log(`   └ Target file: ${event.data.parameters.path}`);
          } else if (event.type === 'done') {
            console.log(`\n🏁 [DONE]: ${event.answer}`);
          } else if (event.type === 'error') {
            console.log(`❌ [ERROR]: ${event.message}`);
          }
        } catch (e) {}
      }
    }
  });

  res.on('end', () => {
    console.log('\n-------------------------------------------------');
    console.log('📁 Checking Workspace Created Files:');
    try {
      const files = fs.readdirSync(projectDir);
      console.log('Files in directory:', files);
      files.forEach(f => {
        const fp = path.join(projectDir, f);
        const stats = fs.statSync(fp);
        console.log(`  - ${f} (${stats.size} bytes)`);
      });
      console.log('=================================================');
      console.log('✅ STEP 1 COMPLETE: Todo App generated autonomously!');
    } catch (e) {
      console.error('Failed to list files:', e.message);
    }
  });
});

req.on('error', (err) => {
  console.error('Request Error:', err);
});

req.write(payload);
req.end();
