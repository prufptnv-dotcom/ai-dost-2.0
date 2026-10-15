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

test('framework-specific guidance is selected for Next.js and React', () => {
  const next = analyzeCodeGenerationRequest('Build a Next.js app');
  assert.ok(next.frameworkGuidance.some((rule) => /Server Components/.test(rule)));
  const react = analyzeCodeGenerationRequest('Build a React dashboard');
  assert.ok(react.frameworkGuidance.some((rule) => /loading, empty, error/.test(rule)));
});

test('graph algorithm requests receive algorithm-family constraints', () => {
  const strategy = analyzeCodeGenerationRequest('Implement Dijkstra shortest path');
  assert.ok(strategy.algorithmRules.some((rule) => /Dijkstra only for non-negative/.test(rule)));
  assert.ok(strategy.algorithmRules.some((rule) => /negative cycles/.test(rule)));
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


test('greedy, heap, union-find, and string-matching requests receive domain-specific correctness rules', () => {
  const greedy = analyzeCodeGenerationRequest('Implement greedy interval scheduling');
  assert.ok(greedy.algorithmRules.some((rule) => /greedy-choice property/.test(rule)));

  const heap = analyzeCodeGenerationRequest('Implement top-k using a priority queue');
  assert.ok(heap.algorithmRules.some((rule) => /min-heap from max-heap/.test(rule)));

  const dsu = analyzeCodeGenerationRequest('Build a union-find data structure');
  assert.ok(dsu.algorithmRules.some((rule) => /path compression/.test(rule)));

  const strings = analyzeCodeGenerationRequest('Implement KMP substring search');
  assert.ok(strings.algorithmRules.some((rule) => /overlapping matches/.test(rule)));
});

test('Hindi algorithm and performance requests are classified for stronger guidance', () => {
  const strategy = analyzeCodeGenerationRequest('इस लॉजिक को तेज बनाओ और एल्गोरिदम ऑप्टिमाइज़ करो');
  assert.equal(strategy.intent.algorithmic, true);
  assert.equal(strategy.intent.performanceSensitive, true);
  assert.equal(strategy.intent.complexity, 'high');
  assert.ok(strategy.algorithmRules.some((rule) => /invariants/.test(rule)));
});


test('framework-specific guidance covers SvelteKit, Astro islands, and Remix data mutations', () => {
  const svelte = analyzeCodeGenerationRequest('Build a Svelte dashboard');
  assert.ok(svelte.frameworkGuidance.some((rule) => /SvelteKit version/.test(rule)));

  const astro = analyzeCodeGenerationRequest('Build an Astro website');
  assert.ok(astro.frameworkGuidance.some((rule) => /client: directives/.test(rule)));

  const remix = analyzeCodeGenerationRequest('Build a Remix app');
  assert.ok(remix.frameworkGuidance.some((rule) => /loaders\/actions/.test(rule)));
});

test('framework can be detected from nested workspace package manifests', () => {
  const { detectFrameworkFromFiles } = require('../agent/runtime/codeGenerationStrategy');
  assert.equal(detectFrameworkFromFiles({
    files: { 'frontend/package.json': JSON.stringify({ dependencies: { next: '^16.0.0', react: '^19.0.0' } }) },
  }), 'Next.js');
  assert.equal(detectFrameworkFromFiles({
    files: { 'web/package.json': JSON.stringify({ devDependencies: { astro: '^5.0.0' } }) },
  }), 'Astro');
});

test('workspace stack detection does not mistake Vite for a UI framework', () => {
  const { detectFrameworkFromFiles } = require('../agent/runtime/codeGenerationStrategy');
  const context = {
    packageJson: { devDependencies: { vite: '^6.0.0' } },
    files: { 'vite.config.js': 'export default {}' },
  };
  assert.equal(detectWorkspaceStack(context), null);
  assert.equal(detectFrameworkFromFiles(context), null);
  assert.equal(detectFrameworkFromFiles({
    packageJson: { devDependencies: { vite: '^6.0.0' } },
    files: {
      'vite.config.js': 'export default {}',
      'src/App.vue': '<template><main /></template>',
      'frontend/package.json': JSON.stringify({ dependencies: { vue: '^3.5.0' } }),
    },
  }), 'Vue');
});

test('explicit framework takes precedence over files detected in a workspace', () => {
  const strategy = analyzeCodeGenerationRequest('Build an Astro website', {
    files: { 'package.json': JSON.stringify({ dependencies: { next: '^16.0.0', react: '^19.0.0' } }) },
  });
  assert.equal(strategy.stack.explicitFramework, 'Astro');
  assert.ok(strategy.frameworkGuidance.some((rule) => /client: directives/.test(rule)));
});

test('framework file hints detect Vue and Angular in Vite workspaces', () => {
  const { detectFrameworkFromFiles } = require('../agent/runtime/codeGenerationStrategy');
  assert.equal(detectFrameworkFromFiles({ files: { 'vite.config.js': 'export default {}', 'src/App.vue': '<template><main /></template>' } }), 'Vue');
  assert.equal(detectFrameworkFromFiles({ files: { 'vite.config.js': 'export default {}', 'angular.json': '{}' } }), 'Angular');
});
