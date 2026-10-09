const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EVAL_SCENARIOS } = require('./eval_scenarios');

/**
 * Eval Harness for AI-Dost Agent
 * Tests agent capabilities across various scenarios.
 *
 * P12.2: scenario DATA moved to eval_scenarios.js (50 scenarios, pure data);
 * this file is execution + scoring only. Two execution paths:
 *   - endpoint 'agent' (default): POST /api/agent/run (ReAct SSE, LLM)
 *   - endpoint 'chat':            POST /api/chat (fast chat/cascade, LLM)
 * Scoring supports OR-groups: 'a|b|c' = ONE expectation, passes if any
 * alternative is found (used for honesty/refusal checks with many valid
 * phrasings).
 */

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
    // Execute the scenario prompt (agent or chat, per scenario.endpoint)
    const result = await executeScenarioPrompt(scenario);

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
      maxScore: scenario.expectedOutput ? scenario.expectedOutput.length : 0,
      feedback: error.message,
      elapsedTime: elapsed
    };
  }
}

/**
 * Dispatch by scenario.endpoint ('agent' default, 'chat' for fast intents).
 */
async function executeScenarioPrompt(scenario) {
  if (scenario && scenario.endpoint === 'chat') {
    return executeChatPrompt(scenario.prompt);
  }
  return executeAgentPrompt(scenario.prompt);
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
    body: JSON.stringify({ userPrompt: prompt, existingProjectFiles: ['dummy.js'] }),
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
 * Execute a chat-intent prompt via POST /api/chat (fast path — travel/
 * language/decision/security/catalog intents, adversarial probes, reasoning).
 */
async function executeChatPrompt(prompt) {
  const PORT = process.env.PORT || 5000;
  const res = await fetch(`http://127.0.0.1:${PORT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt }),
    signal: AbortSignal.timeout(120000)
  });
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`Chat failed (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return String(data.reply || data.response || '');
}

/**
 * Match one expectation against the (lowercased) output.
 * 'a|b|c' = OR-group: ONE expectation, passes when any alternative matches.
 */
function matchesExpectation(outputLower, expectation) {
  const raw = String(expectation || '');
  if (!raw) return false;
  if (raw.includes('|')) {
    return raw.split('|').some((alt) => {
      const t = alt.trim().toLowerCase();
      return t && outputLower.includes(t);
    });
  }
  return outputLower.includes(raw.toLowerCase());
}

/**
 * Evaluate scenario results against expected output
 */
function evaluateScenario(actualOutput, expected) {
  const expectations = Array.isArray(expected.expectedOutput) ? expected.expectedOutput : [];
  const results = {
    score: 0,
    maxScore: expectations.length,
    feedback: '',
    status: 'partial'
  };

  const outputLower = String(actualOutput || '').toLowerCase();
  const found = [];

  expectations.forEach((expect) => {
    if (matchesExpectation(outputLower, expect)) {
      results.score++;
      found.push(expect);
    }
  });

  if (results.score === expectations.length && expectations.length > 0) {
    results.status = 'passed';
    results.feedback = `All ${expectations.length} expectations met.`;
  } else if (results.score > 0) {
    results.status = 'partial';
    results.feedback = `${results.score}/${expectations.length} expectations met: ${found.join(', ')}`;
  } else {
    results.status = 'failed';
    results.feedback = `None of the ${expectations.length} expectations met.`;
  }

  return results;
}

/**
 * Pure summary over per-scenario results (P12.2 — extracted so the math is
 * unit-testable; the old inline version summed a nonexistent `maxScore` field
 * on EVAL_SCENARIOS and produced NaN).
 */
function summarize(results) {
  const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0);
  const totalMax = results.reduce((sum, r) => sum + (r.maxScore || 0), 0);
  const passCount = results.filter(r => r.status === 'passed').length;
  const failCount = results.filter(r => r.status === 'failed').length;
  return {
    totalScenarios: results.length,
    passed: passCount,
    failed: failCount,
    score: totalScore,
    maxScore: totalMax,
    percentage: totalMax > 0 ? ((totalScore / totalMax) * 100) | 0 : 0
  };
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

  const summary = summarize(results);

  console.log(''.repeat(60));
  console.log('📊 EVAL SUMMARY');
  console.log(''.repeat(60));
  console.log(`Total scenarios: ${summary.totalScenarios}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Overall score: ${summary.score}/${summary.maxScore} (${summary.percentage}%)`);
  console.log('');

  results.forEach(r => {
    const statusEmoji = r.status === 'passed' ? '✅' : r.status === 'partial' ? '⚠️' : '❌';
    console.log(`${statusEmoji} ${r.scenarioId}: ${r.status} - ${r.feedback}`);
  });

  console.log('');
  console.log('='.repeat(60));

  return {
    ...summary,
    results
  };
}

module.exports = {
  runAllScenarios,
  EVAL_SCENARIOS,
  runScenario,
  evaluateScenario,
  matchesExpectation,
  executeScenarioPrompt,
  executeAgentPrompt,
  executeChatPrompt,
  summarize
};

// Run if called directly
if (require.main === module) {
  runAllScenarios().then(() => process.exit(0));
}
