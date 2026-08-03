const http = require('http');
const path = require('path');
const os = require('os');

async function testLiveAgentCalculator() {
  console.log('🚀 Sending user prompt to AI-Dost Autonomous Agent SSE endpoint...\n');

  const testWorkspace = path.join(os.tmpdir(), 'agent-live-calc-' + Date.now());
  const body = JSON.stringify({
    userPrompt: 'Create a full calculator app with index.html (modern dark theme glassmorphism UI with buttons), style.css (neon glow styling), and app.py (a python backend calculation script).',
    projectPath: testWorkspace,
    projectId: 'test_calculator_project'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/agent/run',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const req = http.request(options, (res) => {
    console.log(`[Status Code]: ${res.statusCode}`);
    let rawBuffer = '';

    res.on('data', (chunk) => {
      rawBuffer += chunk.toString();
      const lines = rawBuffer.split('\n\n');
      rawBuffer = lines.pop(); // keep partial chunk

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.type === 'start') {
              console.log(`📌 [START]: ${data.message}`);
            } else if (data.type === 'plan') {
              console.log(`\n📋 [DYNAMIC EXECUTION PLAN]: ${data.plan.summary}`);
              data.plan.tasks.forEach(t => console.log(`   - Task ${t.id}: ${t.title} [${t.status}]`));
              console.log('');
            } else if (data.type === 'thinking') {
              console.log(`🧠 [THINKING - Step ${data.step}]: ${data.message}`);
            } else if (data.type === 'tool_call') {
              console.log(`🛠️ [TOOL CALL]: ${data.action} ->`, JSON.stringify(data.parameters));
            } else if (data.type === 'step') {
              console.log(`✅ [STEP ${data.stepLog.step} RESULT]: Action: ${data.stepLog.action}`);
              if (data.stepLog.result) {
                console.log(`   Result:`, data.stepLog.result.message || data.stepLog.result);
              }
            } else if (data.type === 'done') {
              console.log(`\n🎉 [AGENT FINAL COMPLETE]: ${data.answer}`);
              console.log(`📁 Files Created by Agent in Workspace (${testWorkspace}):`);
              if (data.changedFiles && data.changedFiles.length > 0) {
                data.changedFiles.forEach(f => console.log(`   📄 ${f.parameters?.path || f}`));
              }
            } else if (data.type === 'error') {
              console.error(`❌ [AGENT ERROR]: ${data.error}`);
            }
          } catch (e) {}
        }
      }
    });

    res.on('end', () => {
      if (rawBuffer.trim()) {
        const lines = rawBuffer.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'plan') {
                console.log(`\n📋 [DYNAMIC EXECUTION PLAN]: ${data.plan.summary}`);
                data.plan.tasks.forEach(t => console.log(`   - Task ${t.id}: ${t.title} [${t.status}]`));
                console.log('');
              } else if (data.type === 'thinking') {
                console.log(`🧠 [THINKING - Step ${data.step}]: ${data.message}`);
              } else if (data.type === 'tool_call') {
                console.log(`🛠️ [TOOL CALL]: ${data.action} ->`, JSON.stringify(data.parameters));
              } else if (data.type === 'step') {
                console.log(`✅ [STEP ${data.stepLog.step} RESULT]: Action: ${data.stepLog.action}`);
              } else if (data.type === 'done') {
                console.log(`\n🎉 [AGENT FINAL COMPLETE]: ${data.answer}`);
                if (data.changedFiles && data.changedFiles.length > 0) {
                  data.changedFiles.forEach(f => console.log(`   📄 Created/Edited: ${f.parameters?.path || f}`));
                }
              }
            } catch (e) {}
          }
        }
      }
      console.log('\n=================================================');
      console.log('🏁 Agent Execution Completed Successfully!');
      console.log('=================================================');
    });
  });

  req.on('error', (err) => {
    console.error('Request Error:', err);
  });

  req.write(body);
  req.end();
}

testLiveAgentCalculator();
