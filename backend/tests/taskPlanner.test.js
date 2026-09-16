const test = require('node:test');
const assert = require('node:assert');
const { ToolRegistry } = require('../agent/runtime/ToolRegistry');
const TaskPlanner = require('../agent/runtime/TaskPlanner');

function register(registry, name, validateInput = () => {}) {
  registry.register({ name, description: name, inputSchema: { type: 'object' }, execute: () => {}, validateInput });
}

test('TaskPlanner', async (t) => {
  const toolRegistry = new ToolRegistry();
  register(toolRegistry, 'read_file', (input) => {
    if (typeof input.path !== 'string') throw new Error("Property 'path' must be a string");
  });
  register(toolRegistry, 'take_screenshot');
  register(toolRegistry, 'run_tests');
  register(toolRegistry, 'write_file');

  let mockLLMResponse = null;
  const aiService = {
    generateStructuredPlan: async () => mockLLMResponse,
    generateRepairPlan: async () => mockLLMResponse,
    generateVerificationPlan: async () => mockLLMResponse,
  };
  const planner = new TaskPlanner({ toolRegistry, aiService });

  await t.test('Accepts valid plan', async () => {
    mockLLMResponse = { goal: 'read a file', steps: [{ id: 's1', tool: 'read_file', description: 'step 1', input: { path: 'src/main.js' } }] };
    assert.equal((await planner.generatePlan('test', {})).steps.length, 1);
  });

  await t.test('Rejects missing goal', async () => {
    mockLLMResponse = { steps: [{ id: 's1', tool: 'read_file', description: 'step 1', input: { path: 'x' } }] };
    await assert.rejects(planner.generatePlan('test', {}), /Missing or invalid goal string/);
  });

  await t.test('Rejects unknown tool', async () => {
    mockLLMResponse = { goal: 'hack', steps: [{ id: 's1', tool: 'arbitrary_tool', description: 'step 1', input: {} }] };
    await assert.rejects(planner.generatePlan('test', {}), /Unknown tool 'arbitrary_tool'/);
  });

  await t.test('Rejects duplicate IDs and oversized plans', async () => {
    mockLLMResponse = { goal: 'dup', steps: [{ id: 's1', tool: 'read_file', description: '1', input: { path: 'a' } }, { id: 's1', tool: 'read_file', description: '2', input: { path: 'b' } }] };
    await assert.rejects(planner.generatePlan('test', {}), /Duplicate step ID 's1'/);
    mockLLMResponse = { goal: 'too many', steps: Array.from({ length: 21 }, (_, i) => ({ id: `s${i}`, tool: 'read_file', description: 'x', input: { path: 'a' } })) };
    await assert.rejects(planner.generatePlan('test', {}), /step count exceeds maximum/);
  });

  await t.test('Rejects oversized nested input', async () => {
    mockLLMResponse = { goal: 'bad input', steps: [{ id: 's1', tool: 'read_file', description: 'step 1', input: { path: 'x', blob: 'a'.repeat(12001) } }] };
    await assert.rejects(planner.generatePlan('test', {}), /input string too large/);
  });

  await t.test('Verification accepts visual/test read-only tools', async () => {
    mockLLMResponse = { goal: 'verify', steps: [
      { id: 'v1', tool: 'take_screenshot', description: 'capture UI', input: {} },
      { id: 'v2', tool: 'run_tests', description: 'run tests', input: {} },
    ] };
    const plan = await planner.generateVerificationPlan('verify', {});
    assert.equal(plan.steps.length, 2);
  });

  await t.test('Verification rejects mutation tools', async () => {
    mockLLMResponse = { goal: 'verify', steps: [{ id: 'v1', tool: 'write_file', description: 'mutate', input: {} }] };
    await assert.rejects(planner.generateVerificationPlan('verify', {}), /mutating tool 'write_file'/);
  });

  await t.test('Planner has no FS/DB access', async () => {
    assert.equal(planner.db, undefined);
    assert.equal(planner.fs, undefined);
  });
});
