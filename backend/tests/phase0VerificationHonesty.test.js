'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { initDatabase } = require('../db/index');
const TaskPlanner = require('../agent/runtime/TaskPlanner');
const { createStructuredAgentPlanner } = require('../agent/runtime/structuredAgentPlanner');
const { fallbackPlan, normalizePlan, SPECIALTY_TO_ROLE } = require('../agent/runtime/CopilotDirector');
const toolRegistry = require('../agent/runtime/ToolRegistry');
const { registerAll } = require('../agent/runtime/registerAgentCapabilities');

test('Phase 0 Baseline: request-set.json exists and defines 6 versioned cases with explicit requirements', () => {
  const reqSetPath = path.resolve(__dirname, '../../docs/quality-baselines/phase-0/request-set.json');
  assert.ok(fs.existsSync(reqSetPath), 'request-set.json must exist');

  const content = JSON.parse(fs.readFileSync(reqSetPath, 'utf8'));
  assert.equal(content.version, '1.0.0');
  assert.ok(Array.isArray(content.cases));
  assert.equal(content.cases.length, 6, 'Must contain exactly 6 baseline cases (A through F)');

  const expectedIds = [
    'CASE-A-LANDING-PAGE',
    'CASE-B-DASHBOARD',
    'Case-C-ECOMMERCE',
    'CASE-D-EDUCATION-QUIZ',
    'CASE-E-API-CRUD',
    'CASE-F-MULTI-STEP-REPAIR'
  ];

  content.cases.forEach((c, idx) => {
    assert.equal(c.id, expectedIds[idx]);
    assert.ok(c.prompt && c.prompt.length > 50, `Case ${c.id} must have a detailed prompt`);
    assert.ok(Array.isArray(c.explicitRequirements) && c.explicitRequirements.length >= 4, `Case ${c.id} must have explicit requirements`);
    assert.ok(Array.isArray(c.verificationChecks) && c.verificationChecks.length >= 3, `Case ${c.id} must have verification checks`);
  });
});

test('Phase 0 Baseline: CopilotDirector fallbackPlan creates multi-specialist tasks for complex prompts', () => {
  const complexPrompt = 'Build a SaaS dashboard with CSV export, search filters, and database';
  const plan = fallbackPlan(complexPrompt);
  assert.equal(plan.tasks.length, 3);
  assert.equal(plan.tasks[0].specialty, 'frontend');
  assert.equal(plan.tasks[1].specialty, 'integration');
  assert.equal(plan.tasks[2].specialty, 'testing');
  assert.deepEqual(plan.tasks[1].dependsOn, ['task-1']);
  assert.deepEqual(plan.tasks[2].dependsOn, ['task-2']);
});

test('Phase 0 Root Cause Reproduction: TaskPlanner verification fallback yields list_directory (file existence check only)', async () => {
  initDatabase(':memory:');
  await registerAll();

  const failingAiService = {
    chat: async () => { throw new Error('Simulated upstream model provider failure (e.g. rate limit/429)'); }
  };

  const structuredPlanner = createStructuredAgentPlanner({
    toolRegistry,
    openai: failingAiService
  });

  const planner = new TaskPlanner({
    toolRegistry,
    aiService: structuredPlanner
  });

  const verificationPlan = await planner.generateVerificationPlan('Build a SaaS analytics dashboard with CSV export', { projectId: 'test' });

  assert.ok(verificationPlan && Array.isArray(verificationPlan.steps));
  assert.equal(verificationPlan.steps.length, 1);
  assert.equal(verificationPlan.steps[0].tool, 'list_directory', 'Must fall back to list_directory');
  assert.equal(verificationPlan.steps[0].input.path, '.');

  // Verify that list_directory does NOT execute tests or builds
  const tool = toolRegistry.get('list_directory');
  assert.ok(tool, 'list_directory tool must exist');
  assert.ok(!tool.permissions.includes('execute'), 'list_directory cannot execute code');
  assert.ok(!tool.permissions.includes('write'), 'list_directory is strictly read-only inspection');
});
