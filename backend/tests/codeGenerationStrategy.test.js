'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeCodeGenerationRequest,
  formatCodeGenerationStrategy,
  detectWorkspaceStack,
  detectFrameworkFromFiles,
  classifyRequest,
  deriveAlgorithmSpecification,
  buildAlgorithmGuidanceBlock,
  evaluateAlgorithmVerification,
  registerAlgorithmFamily,
  ALGORITHM_FAMILIES
} = require('../agent/runtime/codeGenerationStrategy');

// ── Phase 1 / PR #18: Framework & Stack Intelligence Tests ───────────────────

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
  assert.equal(detectFrameworkFromFiles({
    files: { 'frontend/package.json': JSON.stringify({ dependencies: { next: '^16.0.0', react: '^19.0.0' } }) },
  }), 'Next.js');
  assert.equal(detectFrameworkFromFiles({
    files: { 'web/package.json': JSON.stringify({ devDependencies: { astro: '^5.0.0' } }) },
  }), 'Astro');
});

test('workspace stack detection does not mistake Vite for a UI framework', () => {
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
  assert.equal(detectFrameworkFromFiles({ files: { 'vite.config.js': 'export default {}', 'src/App.vue': '<template><main /></template>' } }), 'Vue');
  assert.equal(detectFrameworkFromFiles({ files: { 'vite.config.js': 'export default {}', 'angular.json': '{}' } }), 'Angular');
});

// ── Phase 2 / PR #19: Algorithm Intelligence & Verification Tests ────────────

test('Phase 2: Code Generation Strategy & Algorithm Intelligence', async (t) => {

  await t.test('1. Fast Path for routine edits and simple UI tweaks', () => {
    const edit1 = 'fix typo in header text';
    const cls1 = classifyRequest(edit1);
    assert.strictEqual(cls1.isRoutine, true);
    assert.strictEqual(cls1.strategy, 'FAST_PATH');

    const spec1 = deriveAlgorithmSpecification(edit1, cls1);
    assert.strictEqual(spec1.specificationNeeded, false);
    assert.strictEqual(spec1.strategy, 'FAST_PATH');

    const guidance = buildAlgorithmGuidanceBlock(spec1);
    assert.strictEqual(guidance, '');
  });

  await t.test('2. Algorithmic problem classification across diverse families', () => {
    const testCases = [
      { req: 'Find if a string is a palindrome without slicing', expectedFamily: 'arrays_strings' },
      { req: 'Implement two sum problem using hash map', expectedFamily: 'hashing_maps' },
      { req: 'Binary search on a sorted rotated array', expectedFamily: 'sorting_binary_search' },
      { req: 'Implement a stack using two queues with push and pop', expectedFamily: 'stacks_queues' },
      { req: 'Detect cycle in linked list with fast and slow pointers', expectedFamily: 'linked_lists' },
      { req: 'Lowest common ancestor in binary search tree', expectedFamily: 'trees_bst' },
      { req: 'Find top k frequent elements using min-heap', expectedFamily: 'heaps_priority_queues' },
      { req: 'Dijkstra shortest path algorithm with priority queue', expectedFamily: 'graphs_traversal_shortest_paths' },
      { req: '0/1 knapsack dynamic programming problem', expectedFamily: 'dynamic_programming' },
      { req: 'Implement an LRU Cache with get and put', expectedFamily: 'caching_optimization' },
      { req: 'Redundant connection in graph using union find', expectedFamily: 'union_find_disjoint_set' },
      { req: 'Implement a trie for autocomplete prefix search', expectedFamily: 'tries_string_matching' }
    ];

    for (const tc of testCases) {
      const cls = classifyRequest(tc.req);
      assert.strictEqual(cls.isRoutine, false, `Failed on: ${tc.req}`);
      assert.strictEqual(cls.kind, 'ALGORITHMIC_PROBLEM', `Failed on: ${tc.req}`);
      assert.strictEqual(cls.family, tc.expectedFamily, `Failed on: ${tc.req}`);
    }
  });

  await t.test('3. Derives explicit structured algorithm specification with contracts & edge cases', () => {
    const req = 'Solve 0/1 knapsack dynamic programming';
    const spec = deriveAlgorithmSpecification(req);
    assert.strictEqual(spec.specificationNeeded, true);
    assert.strictEqual(spec.family, 'dynamic_programming');
    assert.ok(spec.contract.expectedComplexity.time);
    assert.ok(spec.contract.expectedComplexity.space);
    assert.ok(spec.contract.edgeCasesAndInvariants.length > 0);
    assert.ok(spec.contract.edgeCasesAndInvariants.includes('zero capacity / zero target'));

    const guidance = buildAlgorithmGuidanceBlock(spec);
    assert.ok(guidance.includes('ALGORITHM DESIGN & EXECUTION PROTOCOL'));
    assert.ok(guidance.includes('DYNAMIC PROGRAMMING'));
    assert.ok(guidance.includes('ZERO PLACEHOLDERS'));
  });

  await t.test('4. Extensible family registration without touching existing code', () => {
    const initialSize = ALGORITHM_FAMILIES.size;
    registerAlgorithmFamily({
      id: 'computational_geometry',
      name: 'Computational Geometry & Convex Hull',
      matcher: (text) => /\b(convex hull|graham scan|line intersection|polygon area)\b/i.test(text),
      complexity: { time: 'O(N log N)', space: 'O(N)' },
      invariants: ['Cross product orientation test determines turn direction'],
      edgeCases: ['collinear points', 'fewer than 3 points', 'all identical points']
    });

    assert.strictEqual(ALGORITHM_FAMILIES.size, initialSize + 1);

    const cls = classifyRequest('Find the convex hull using Graham scan');
    assert.strictEqual(cls.family, 'computational_geometry');
    const spec = deriveAlgorithmSpecification('Find the convex hull', cls);
    assert.strictEqual(spec.familyName, 'Computational Geometry & Convex Hull');
    assert.ok(spec.contract.edgeCasesAndInvariants.includes('collinear points'));
  });

  await t.test('5. Completion rule: Algorithm is unverified without passing execution evidence', () => {
    // Merely having a complexity statement without execution
    const noExec = evaluateAlgorithmVerification(null);
    assert.strictEqual(noExec.verified, false);
    assert.strictEqual(noExec.status, 'UNVERIFIED');

    // Failed execution
    const failedExec = evaluateAlgorithmVerification({ status: 'TEST_FAILURE', error: 'AssertionError: expected 34 got 0' });
    assert.strictEqual(failedExec.verified, false);
    assert.strictEqual(failedExec.status, 'TEST_FAILURE');

    // Successful execution evidence
    const successExec = evaluateAlgorithmVerification({ status: 'SUCCESS', verified: true, testsPassed: 5, durationMs: 42 });
    assert.strictEqual(successExec.verified, true);
    assert.strictEqual(successExec.status, 'VERIFIED');
  });
});
