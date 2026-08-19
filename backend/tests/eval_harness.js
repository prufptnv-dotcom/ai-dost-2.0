const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Eval Harness for AI-Dost Agent
 * Tests agent capabilities across various scenarios
 */

const EVAL_SCENARIOS = [
  {
    id: '1',
    name: 'Todo App',
    description: 'Create a todo app with add, complete, and delete functionality',
    prompt: 'Todo app banao with add, complete aur delete functionality. Sab files likho.',
    expectedOutput: ['index.html', 'todo', 'javascript'],
    difficulty: 'medium',
    estimatedTime: '5-10 minutes'
  },
  {
    id: '2',
    name: 'Hindi Blog Post',
    description: 'Generate a blog post about Hindi computing in Hindi or Hinglish',
    prompt: 'Hindi computing par blog post likho - 500 words me Hindi mein samjhao ki computer kaise use karein.',
    expectedOutput: ['blog', 'hindi'],
    difficulty: 'easy',
    estimatedTime: '2-3 minutes'
  },
  {
    id: '3',
    name: 'Bihar Report PDF',
    description: 'Generate a PDF report about Bihar with Hindi font support',
    prompt: 'Bihar par report PDF me banao jinme heading Hindi me ho.',
    expectedOutput: ['pdf', 'bihar'],
    difficulty: 'easy',
    estimatedTime: '3-5 minutes'
  },
  {
    id: '4',
    name: 'CSV Data Export',
    description: 'Create a CSV data file with headers (agent writes it via write_file)',
    prompt: 'Sales data ka CSV file banao jisme headers hain - date, product, amount.',
    expectedOutput: ['csv', 'date', 'product', 'amount'],
    difficulty: 'medium',
    estimatedTime: '2-4 minutes'
  },
  {
    id: '5',
    name: 'Agent Self-Correction',
    description: 'Test agent memory and correction learning',
    prompt: 'Bihar ki rajdhani Delhi hai. Correction: Bihar ki rajdhani Patna hai. Is correction ko yaad rakho.',
    expectedOutput: ['patna'],
    difficulty: 'easy',
    estimatedTime: '2-4 minutes'
  }
];

/**
 * Run a single eval scenario
 */
async function runScenario(scenario) {
  console.log(`\n▶ Running: ${scenario.name}`);
  console.log(`   ID: ${scenario.id}`);
  console.log(`   Difficulty: ${scenario.difficulty}`);
  console.log(`   Prompt: ${(scenario.prompt || '').substring(0, 50)}...`);
  
  const startTime = Date.now();
  
  try {
    // Execute the agent prompt
    const result = await executeAgentPrompt(scenario.prompt);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Evaluate results
    const evaluation = evaluateScenario(result, scenario);
    
    console.log(`   ✅ Status: ${evaluation.status}`);
    console.log(`   📊 Score: ${evaluation.score}/${evaluation.maxScore}`);
    console.log(`   ⏱️ Time: ${elapsed}s`);
    console.log(`   📝 Feedback: ${evaluation.feedback}`);
    
    return {
      scenarioId: scenario.id,
      status: evaluation.status,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      feedback: evaluation.feedback,
      elapsedTime: elapsed,
      output: result.substring(0, 500) // Truncate for logging
    };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`   ❌ Status: FAILED`);
    console.log(`   ⏱️ Time: ${elapsed}s`);
    console.log(`   💥 Error: ${error.message}`);
    
    return {
      scenarioId: scenario.id,
      status: 'failed',
      score: 0,
      maxScore: 0,
      feedback: error.message,
      elapsedTime: elapsed
    };
  }
}

/**
 * Execute agent prompt via the real backend /api/agent/run (SSE)
 */
async function executeAgentPrompt(prompt) {
  const PORT = process.env.PORT || 5000;
  const url = `http://127.0.0.1:${PORT}/api/agent/run`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt: prompt }),
    signal: AbortSignal.timeout(300000)
  });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Agent run failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  const text = await res.text();
  let output = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const msg = JSON.parse(line.slice(6));
      if (msg.type === 'step' && msg.stepLog) {
        const log = msg.stepLog;
        if (typeof log === 'string') output += log + '\n';
        else if (log.thought) {
          output += log.thought + ' ';
          if (log.action) output += `[${log.action}] `;
          if (log.parameters) output += JSON.stringify(log.parameters).slice(0, 300);
          output += '\n';
        } else output += JSON.stringify(log).slice(0, 300) + '\n';
      } else if (msg.type === 'done' && msg.message) {
        output += msg.message + '\n';
      } else if (msg.message && typeof msg.message === 'string') {
        output += msg.message + '\n';
      }
    } catch { /* skip malformed SSE lines */ }
  }
  return output || text.slice(0, 500);
}

/**
 * Evaluate scenario results against expected output
 */
function evaluateScenario(actualOutput, expected) {
  const results = {
    score: 0,
    maxScore: expected.expectedOutput.length,
    feedback: '',
    status: 'partial'
  };
  
  const found = [];
  
  expected.expectedOutput.forEach((expect, i) => {
    if (actualOutput.toLowerCase().includes(expect.toLowerCase())) {
      results.score++;
      found.push(expect);
    }
  });
  
  if (results.score === expected.expectedOutput.length) {
    results.status = 'passed';
    results.feedback = `All ${expected.expectedOutput.length} expectations met.`;
  } else if (results.score > 0) {
    results.status = 'partial';
    results.feedback = `${results.score}/${expected.expectedOutput.length} expectations met: ${found.join(', ')}`;
  } else {
    results.status = 'failed';
    results.feedback = `None of the ${expected.expectedOutput.length} expectations met.`;
  }
  
  return results;
}

/**
 * Run all eval scenarios
 */
async function runAllScenarios() {
  console.log('='.repeat(60));
  console.log('🧪 AI-Dost Agent Eval Harness');
  console.log('='.repeat(60));
  console.log(`Total scenarios: ${EVAL_SCENARIOS.length}`);
  console.log('');
  
  const results = [];
  
  for (const scenario of EVAL_SCENARIOS) {
    const result = await runScenario(scenario);
    results.push(result);
  }
  
  // Summary
  const totalScore = results.reduce((sum, r) => sum + r.score, 0);
  const totalMax = EVAL_SCENARIOS.reduce((sum, r) => sum + r.maxScore, 0);
  const passCount = results.filter(r => r.status === 'passed').length;
  const failCount = results.filter(r => r.status === 'failed').length;
  
  console.log(''.repeat(60));
  console.log('📊 EVAL SUMMARY');
  console.log(''.repeat(60));
  console.log(`Total scenarios: ${results.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Overall score: ${totalScore}/${totalMax} (${((totalScore/totalMax*100)|0)}%)`);
  console.log('');
  
  results.forEach(r => {
    const statusEmoji = r.status === 'passed' ? '✅' : r.status === 'partial' ? '⚠️' : '❌';
    console.log(`${statusEmoji} ${r.scenarioId}: ${r.status} - ${r.feedback}`);
  });
  
  console.log('');
  console.log('='.repeat(60));
  
  return {
    totalScenarios: results.length,
    passed: passCount,
    failed: failCount,
    score: totalScore,
    maxScore: totalMax,
    percentage: (totalScore/totalMax*100)|0,
    results
  };
}

module.exports = { runAllScenarios, EVAL_SCENARIOS, runScenario };

// Run if called directly
if (require.main === module) {
  runAllScenarios().then(() => process.exit(0));
}