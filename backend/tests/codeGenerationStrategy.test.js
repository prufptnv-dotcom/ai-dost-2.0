'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeCodeGenerationRequest,
  formatCodeGenerationStrategy,
  detectWorkspaceStack,
} = require('../agent/runtime/codeGenerationStrategy');

test('explicit framework and language take precedence in the strategy', () => {
  const strategy = analyzeCodeGenerationRequest('Build a Next.js app in TypeScript');
  assert.equal(strategy.stack.explicitFramework, 'Next.js');
  assert.equal(strategy.stack.explicitLanguage, 'TypeScript');
  assert.match(strategy.stack.policy, /explicitly requested stack/);
});

test('existing package dependencies are used as the stack hint when no stack is requested', () => {
  const stack = detectWorkspaceStack({
    packageJson: { dependencies: { react: '^19.0.0', vite: '^6.0.0' } },
  });
  assert.equal(stack, 'React');
  const strategy = analyzeCodeGenerationRequest('Add a settings page', {
    packageJson: { dependencies: { react: '^19.0.0' } },
  });
  assert.equal(strategy.stack.workspaceStack, 'React');
  assert.match(strategy.stack.policy, /Preserve the detected workspace stack/);
});

test('algorithmic tasks receive complexity, invariant, and adversarial test guidance', () => {
  const strategy = analyzeCodeGenerationRequest('Optimize a shortest path algorithm for large graphs');
  assert.equal(strategy.intent.algorithmic, true);
  assert.equal(strategy.intent.complexity, 'high');
  assert.ok(strategy.algorithmRules.some((rule) => /invariants/.test(rule)));
  assert.ok(strategy.algorithmRules.some((rule) => /time and space complexity/.test(rule)));
  assert.ok(strategy.algorithmRules.some((rule) => /adversarial cases/.test(rule)));
});

test('security-sensitive full-stack work adds trust-boundary checks', () => {
  const strategy = analyzeCodeGenerationRequest('Build a full-stack checkout API with authentication');
  assert.equal(strategy.intent.fullStack, true);
  assert.equal(strategy.intent.securitySensitive, true);
  assert.ok(strategy.verificationGates.some((rule) => /authorization/.test(rule)));
});

test('simple tasks avoid forcing complex multi-agent execution', () => {
  const strategy = analyzeCodeGenerationRequest('Write a function that formats a date');
  assert.equal(strategy.intent.complexity, 'low');
  assert.match(strategy.executionPolicy.simpleTask, /one focused implementation task/);
  assert.match(strategy.executionPolicy.speed, /reducing redundant model\/tool calls/);
});

test('strategy formatting is deterministic JSON with explicit boundaries', () => {
  const strategy = analyzeCodeGenerationRequest('Create a Vue dashboard');
  const formatted = formatCodeGenerationStrategy(strategy);
  assert.match(formatted, /AI-DOST CODE GENERATION STRATEGY/);
  assert.match(formatted, /END CODE GENERATION STRATEGY/);
  assert.equal(formatted, formatCodeGenerationStrategy(analyzeCodeGenerationRequest('Create a Vue dashboard')));
});
