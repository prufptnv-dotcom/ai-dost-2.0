const router = require('../routes/agent.js');
const parse = router.parseLLMAction;

// Test 1: Invalid JSON with random text
const raw4 = `Sure, I can help you with that! Let's edit the file.
{"thought": "fixing the code", "action": "apply_diff", "parameters": { "path": "app.js", "search": "old", "replace": "new" }}`;
const t4 = parse(raw4);
console.log('T4 (Corrupted JSON with prose):', t4.action === 'apply_diff' && t4.parameters.path === 'app.js' ? 'PASSED ✅' : 'FAILED ❌');

// Test 2: Absolute garbage
const raw5 = `I will run a terminal command.`;
const t5 = parse(raw5);
console.log('T5 (No JSON, just text):', t5.action === 'FINAL_ANSWER' && t5.answer.includes('terminal command') ? 'PASSED ✅' : 'FAILED ❌');

console.log('Robustness tests complete.');
