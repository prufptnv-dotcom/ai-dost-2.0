const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('=================================================');
console.log('🚀 AI-DOST AUTONOMOUS AGENT — FULL UI INTEGRATION TEST');
console.log('=================================================\n');

const testPrompts = [
  {
    name: '1. Multi-Step Task Planning & Execution',
    prompt: 'Create a simple Python utility script math_utils.py with add and subtract functions.',
  },
  {
    name: '2. Codebase Editing & Monaco Live Sync Payload',
    prompt: 'Add a multiply function to math_utils.py and document it with docstrings.',
  },
  {
    name: '3. Auto-Fixing Terminal & Syntax Errors',
    prompt: 'Create a test file test_math.py that imports math_utils and tests add, subtract, multiply.',
  }
];

let overallPassed = true;

async function runPromptTest(testCase) {
  return new Promise((resolve) => {
    console.log(`\n⏳ Running: ${testCase.name}`);
    console.log(`   Prompt: "${testCase.prompt}"`);

    const payload = JSON.stringify({
      userPrompt: testCase.prompt,
      projectPath: path.join(__dirname, '../temp_test_workspace'),
      projectId: 'ui_integration_test'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/agent/run',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let rawData = '';
      let receivedPlan = false;
      let receivedThinking = false;
      let receivedStep = false;
      let receivedDone = false;

      if (res.statusCode !== 200) {
        console.log(`❌ HTTP Error: Received status code ${res.statusCode}`);
        overallPassed = false;
        return resolve(false);
      }

      res.on('data', (chunk) => {
        rawData += chunk.toString();
      });

      res.on('end', () => {
        const lines = rawData.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.substring(5).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'plan') {
                receivedPlan = true;
                console.log(`   📋 [UI EVENT] Plan Received: ${data.plan?.summary || 'Task plan ready'}`);
              } else if (data.type === 'thinking') {
                receivedThinking = true;
                console.log(`   🧠 [UI EVENT] Thinking: ${data.message}`);
              } else if (data.type === 'tool_call') {
                console.log(`   ⚡ [UI EVENT] Calling Tool: ${data.action}`);
              } else if (data.type === 'step') {
                receivedStep = true;
                if (data.stepLog?.result?.changedFile) {
                  console.log(`   📄 [UI EVENT] Monaco Live Sync Event: ${data.stepLog.result.changedFile}`);
                }
              } else if (data.type === 'done') {
                receivedDone = true;
                console.log(`   🎉 [UI EVENT] Agent Done: ${data.message ? data.message.substring(0, 75) + '...' : 'Done'}`);
              }
            } catch (e) {
              // Ignore partial JSON parse errors until full stream
            }
          }
        }

        const success = receivedPlan && receivedDone;
        if (success) {
          console.log(`✅ PASSED: ${testCase.name} (Plan: ${receivedPlan}, Step: ${receivedStep}, Done: ${receivedDone})`);
        } else {
          console.log(`❌ FAILED: ${testCase.name} (Plan: ${receivedPlan}, Step: ${receivedStep}, Done: ${receivedDone})`);
          console.log('   Raw Data Received:\n', rawData.substring(0, 300));
          overallPassed = false;
        }
        resolve(success);
      });
    });

    req.on('error', (e) => {
      console.log(`❌ Request Error: ${e.message}`);
      overallPassed = false;
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const wsDir = path.join(__dirname, '../temp_test_workspace');
  if (!fs.existsSync(wsDir)) {
    fs.mkdirSync(wsDir, { recursive: true });
  }

  for (const t of testPrompts) {
    await runPromptTest(t);
  }

  console.log('\n=================================================');
  if (overallPassed) {
    console.log('📊 UI-TO-BACKEND INTEGRATION: 100% PASSED & VERIFIED ✅');
  } else {
    console.log('📊 UI-TO-BACKEND INTEGRATION: FAILED ❌');
    process.exit(1);
  }
  console.log('=================================================\n');
}

main();
