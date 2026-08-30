const test = require('node:test');
const assert = require('node:assert');
const { ToolRegistry } = require('../agent/runtime/ToolRegistry');
const TaskPlanner = require('../agent/runtime/TaskPlanner');

test('TaskPlanner', async (t) => {
  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    name: 'read_file',
    description: 'reads',
    inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } },
    execute: () => {}
  });

  // Mock AI Service
  let mockLLMResponse = null;
  const aiService = {
    generateStructuredPlan: async (intent, context) => mockLLMResponse
  };

  const planner = new TaskPlanner({ toolRegistry, aiService });

  await t.test('Accepts valid plan', async () => {
    mockLLMResponse = {
      goal: "read a file",
      steps: [
        { id: "s1", tool: "read_file", description: "step 1", input: { path: "src/main.js" } }
      ]
    };
    const plan = await planner.generatePlan("test", {});
    assert.strictEqual(plan.steps.length, 1);
  });

  await t.test('Rejects missing goal', async () => {
    mockLLMResponse = { steps: [{ id: "s1", tool: "read_file", description: "step 1", input: { path: "src/main.js" } }] };
    await assert.rejects(planner.generatePlan("test", {}), /Missing or invalid goal string/);
  });

  await t.test('Rejects unknown tool', async () => {
    mockLLMResponse = {
      goal: "hack",
      steps: [
        { id: "s1", tool: "arbitrary_tool", description: "step 1", input: {} }
      ]
    };
    await assert.rejects(planner.generatePlan("test", {}), /Unknown tool 'arbitrary_tool'/);
  });

  await t.test('Rejects duplicate step IDs', async () => {
    mockLLMResponse = {
      goal: "dup",
      steps: [
        { id: "s1", tool: "read_file", description: "step 1", input: { path: "a" } },
        { id: "s1", tool: "read_file", description: "step 2", input: { path: "b" } }
      ]
    };
    await assert.rejects(planner.generatePlan("test", {}), /Duplicate step ID 's1'/);
  });

  await t.test('Rejects invalid tool input', async () => {
    mockLLMResponse = {
      goal: "bad input",
      steps: [
        // Missing 'path'
        { id: "s1", tool: "read_file", description: "step 1", input: { } }
      ]
    };
    await assert.rejects(planner.generatePlan("test", {}), /provided invalid input for tool 'read_file'/);
    
    mockLLMResponse = {
      goal: "bad input type",
      steps: [
        // 'path' is not a string
        { id: "s1", tool: "read_file", description: "step 1", input: { path: 123 } }
      ]
    };
    await assert.rejects(planner.generatePlan("test", {}), /Property 'path' must be a string/);
  });

  await t.test('Planner cannot access FS/DB directly (has no dependencies)', async () => {
    assert.strictEqual(planner.db, undefined);
    assert.strictEqual(planner.fs, undefined);
  });
});
