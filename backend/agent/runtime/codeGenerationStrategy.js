'use strict';

/**
 * AI-Dost Code Generation Strategy & Algorithm Intelligence Engine
 * Unified Canonical Implementation:
 * - Framework & stack detection, architectural guidance, deterministic formatting (PR #18 / Phase 1)
 * - 12-family algorithm intelligence registry, contract derivation, Big-O contracts, verification (PR #19 / Phase 2)
 */

// ── Framework & Stack Intelligence (PR #18 / Phase 1) ───────────────────────

const FRAMEWORKS = [
  ['Next.js', /\bnext(?:\.js)?\b/i],
  ['React', /\breact\b/i],
  ['Vue', /\bvue(?:\.js)?\b/i],
  ['Angular', /\bangular\b/i],
  ['Svelte', /\bsvelte\b/i],
  ['Express.js', /\bexpress(?:\.js)?\b/i],
  ['NestJS', /\bnest(?:\.js)?\b/i],
  ['FastAPI', /\bfastapi\b/i],
  ['Django', /\bdjango\b/i],
  ['Flask', /\bflask\b/i],
  ['Laravel', /\blaravel\b/i],
  ['Spring Boot', /\bspring boot\b/i],
  ['Rails', /\bruby on rails|\brails\b/i],
  ['Astro', /\bastro\b/i],
  ['Nuxt', /\bnuxt(?:\.js)?\b/i],
  ['Remix', /\bremix\b/i],
];

const STACK_SIGNALS = [
  ['TypeScript', /\btypescript|\bts\b/i],
  ['JavaScript', /\bjavascript|\bjs\b/i],
  ['Python', /\bpython\b/i],
  ['Java', /\bjava\b/i],
  ['C#', /\bc#|\bdotnet|\.net\b/i],
  ['Go', /\bgolang|\bgo language\b/i],
  ['Rust', /\brust\b/i],
];

function firstMatch(text, patterns) {
  return patterns.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

const FRAMEWORK_PACKAGE_MAP = [
  ['next', 'Next.js'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['@angular/core', 'Angular'],
  ['svelte', 'Svelte'],
  ['astro', 'Astro'],
  ['nuxt', 'Nuxt'],
  ['@remix-run/react', 'Remix'],
  ['express', 'Express.js'],
  ['@nestjs/core', 'NestJS'],
  ['fastapi', 'FastAPI'],
  ['django', 'Django'],
  ['flask', 'Flask'],
  ['laravel/framework', 'Laravel'],
];

function detectFrameworkFromFiles(context = {}) {
  const files = context && context.files && typeof context.files === 'object' ? context.files : null;
  if (!files) return null;
  for (const fileName of ['frontend/package.json', 'web/package.json', 'package.json']) {
    const source = files[fileName];
    if (typeof source !== 'string') continue;
    try {
      const pkg = JSON.parse(source);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      for (const [packageName, framework] of FRAMEWORK_PACKAGE_MAP) {
        if (Object.hasOwn(deps, packageName)) return framework;
      }
    } catch (_) {
      // An unreadable package manifest must not block code generation.
    }
  }
  // Config files are lower-confidence hints; Vite alone is not a UI framework.
  const names = Object.keys(files).map((name) => name.replace(/\\/g, '/'));
  if (names.some((name) => /(^|\/)next\.config\.[^/]+$/.test(name))) return 'Next.js';
  if (names.some((name) => /(^|\/)astro\.config\.[^/]+$/.test(name))) return 'Astro';
  if (names.some((name) => /(^|\/)nuxt\.config\.[^/]+$/.test(name))) return 'Nuxt';
  if (names.some((name) => /(^|\/)svelte\.config\.[^/]+$/.test(name))) return 'Svelte';
  // Vue and Angular projects can use Vite without a framework-specific config.
  if (names.some((name) => /(^|\/)src\/App\.vue$/.test(name))) return 'Vue';
  if (names.some((name) => /(^|\/)angular\.json$/.test(name))) return 'Angular';
  return null;
}

function detectWorkspaceStack(context = {}) {
  if (!context || typeof context !== 'object') return null;
  const explicit = [context.projectStack, context.stack, context.framework].find(
    (value) => typeof value === 'string' && value.trim()
  );
  if (explicit) return explicit.trim().slice(0, 100);

  const pkg = context.packageJson && typeof context.packageJson === 'object' ? context.packageJson : null;
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [packageName, framework] of FRAMEWORK_PACKAGE_MAP) {
      if (!Object.hasOwn(deps, packageName)) continue;
      if (packageName === 'vite') break;
      return framework;
    }
    // Vite is a build tool; do not misclassify it as the UI framework.
  }
  return detectFrameworkFromFiles(context);
}

function frameworkGuidance(framework) {
  const key = String(framework || '').toLowerCase();
  if (key === 'next.js') return [
    'Use the existing App Router or Pages Router convention; do not mix routing systems without a reason.',
    'In App Router, default to Server Components and add client boundaries only for browser APIs or interactive state.',
    'Use route handlers/server actions only where they fit the existing architecture; validate inputs at server boundaries.',
  ];
  if (key === 'react') return [
    'Use small composable components, stable keys, and hooks only at component/custom-hook top level.',
    'Keep derived state derived; avoid redundant state and mutation of state objects.',
    'Represent loading, empty, error, success, and disabled states for async or interactive features.',
  ];
  if (key === 'vue') return [
    'Follow the installed Vue version and existing Options API or Composition API convention.',
    'Keep reactive state and side effects explicit; clean up subscriptions/timers and avoid stale async updates.',
  ];
  if (key === 'angular') return [
    'Follow the installed Angular version and existing standalone/module convention.',
    'Use typed services for I/O, reactive forms for complex forms, and lifecycle-safe subscriptions.',
  ];
  if (key === 'express.js') return [
    'Separate route wiring from business logic when scope warrants it; validate request data at the boundary.',
    'Use centralized error middleware and never leak stack traces or secrets to clients.',
  ];
  if (key === 'nestjs') return [
    'Follow module/controller/provider boundaries and use DTO validation at request boundaries.',
    'Keep business logic in injectable providers and preserve the existing dependency-injection conventions.',
  ];
  if (key === 'fastapi') return [
    'Use Pydantic models for request/response contracts and dependency injection for shared services.',
    'Use async handlers only when the called I/O stack is async; do not block the event loop with synchronous heavy work.',
  ];
  if (key === 'django') return [
    'Follow the existing Django app/model/view structure and use migrations for schema changes.',
    'Enforce permissions server-side and validate writes through forms or serializers appropriate to the project.',
  ];
  if (key === 'flask') return [
    'Use app factories/blueprints when consistent with the project; validate inputs and centralize error handling.',
  ];
  if (key === 'svelte') return [
    'Follow the installed Svelte/SvelteKit version and existing component syntax; use stores or runes according to the project version.',
    'Keep browser-only code in the correct lifecycle boundary and clean up subscriptions, listeners, and async work.',
  ];
  if (key === 'astro') return [
    'Prefer Astro components and server-rendered pages by default; add client: directives only for islands that need browser interactivity.',
    'Respect the configured integrations and avoid turning static pages into a client-heavy SPA without a requirement.',
  ];
  if (key === 'nuxt') return [
    'Follow the installed Nuxt version, file-based routing, auto-import conventions, and server/client boundaries.',
    'Keep secrets and privileged data access server-side; validate inputs in server routes and preserve runtime configuration conventions.',
  ];
  if (key === 'remix') return [
    'Use route modules with loaders/actions and the installed router conventions; keep mutations in actions and validate form data server-side.',
    'Handle pending, error, and revalidation states using the framework data lifecycle instead of duplicating server state.',
  ];
  if (key === 'laravel') return [
    'Follow existing Laravel route/controller/model boundaries, middleware, policies, validation requests, and migration conventions.',
    'Use Eloquent relationships and transactions where appropriate; never bypass authorization or mass-assignment protections.',
  ];
  if (key === 'spring boot') return [
    'Follow the existing Spring Boot version and controller/service/repository boundaries; use DTO validation at API edges.',
    'Keep transactions and authorization explicit, and avoid blocking reactive paths or introducing unmanaged concurrency.',
  ];
  if (key === 'rails') return [
    'Follow Rails conventions for routes, controllers, models, migrations, and strong parameters; reuse existing application patterns.',
    'Enforce authorization server-side and use transactions for multi-step writes.',
  ];
  if (key === 'vite') return [
    'Treat Vite as the build tool, not the UI framework; detect and preserve the actual UI framework from dependencies.',
    'Use existing scripts and aliases from vite.config and package.json rather than inventing paths.',
  ];
  return framework ? [
    `Respect the installed ${framework} version and official project conventions; inspect existing configuration before adding packages.`,
  ] : [
    'Before choosing a framework, check existing project files and installed dependencies; do not infer a framework from a build tool alone.',
  ];
}

function algorithmFamilyGuidance(text) {
  const p = String(text || '').toLowerCase();
  const rules = [];
  if (/shortest path|dijkstra|bellman.?ford|floyd.?warshall|graph/.test(p)) {
    rules.push('For graph problems, make directedness, weights, disconnected vertices, and negative-edge constraints explicit.');
    rules.push('Choose BFS for unweighted shortest paths, Dijkstra only for non-negative edge weights, Bellman-Ford when negative edges are allowed, and detect negative cycles when relevant.');
  }
  if (/binary search|sorted array|lower bound|upper bound/.test(p)) {
    rules.push('For binary search, state the sorted-input precondition and use one consistent interval convention; test empty input, one element, duplicates, and targets outside the range.');
  }
  if (/sort|ordering|rank|top.?k/.test(p)) {
    rules.push('For ordering tasks, define comparator/tie-breaking and stability requirements; include duplicates and already/reverse-sorted inputs in tests.');
  }
  if (/dynamic programming|\bdp\b|knapsack|subsequence/.test(p)) {
    rules.push('For dynamic programming, define state, recurrence, base cases, transition order, and reconstruction requirements before coding.');
  }
  if (/backtrack|constraint satisfaction|combinatorial/.test(p)) {
    rules.push('For backtracking/search, state pruning conditions and prove they cannot discard valid solutions; test no-solution and many-solution cases.');
  }
  if (/greedy|activity selection|interval scheduling|minimum spanning tree|\bkruskal\b|\bprim\b/.test(p)) {
    rules.push('For greedy algorithms, state the greedy-choice property and why each local choice is safe; compare against exhaustive search on small generated inputs when feasible.');
  }
  if (/\btree\b|binary tree|bst|binary search tree|trie|segment tree|fenwick|range query/.test(p)) {
    rules.push('For tree and range-query problems, define node invariants, empty-tree behavior, duplicate-key policy, and recursion-depth risks; test skewed trees and boundary ranges.');
  }
  if (/\bheap\b|priority queue|\btop.?k\b/.test(p)) {
    rules.push('For heap/priority-queue solutions, define ordering and tie-breaking, distinguish min-heap from max-heap, and test duplicate priorities and empty-queue behavior.');
  }
  if (/hash map|hash table|dictionary|frequency count|count frequencies|deduplication|\bset\b/.test(p)) {
    rules.push('For hash-based solutions, define key equality/normalization and expected versus worst-case complexity; test collisions conceptually, duplicate keys, and missing keys.');
  }
  if (/union.?find|disjoint set|connected components/.test(p)) {
    rules.push('For disjoint-set union, implement path compression and union by rank/size when appropriate; test repeated unions, self-unions, and disconnected components.');
  }
  if (/\bkmp\b|rabin.?karp|string matching|substring search|prefix function|z.?algorithm/.test(p)) {
    rules.push('For string-matching algorithms, specify indexing and character semantics, handle empty patterns and overlapping matches, and compare against a simple reference implementation on small inputs.');
  }
  if (/concurren|race condition|parallel|scheduler/.test(p)) {
    rules.push('For concurrent work, define shared-state ownership, cancellation, idempotency, ordering, and race-condition tests.');
  }
  return rules;
}

function analyzeCodeGenerationRequest(request, context = {}) {
  const original = String(request || '').trim();
  const text = original.toLowerCase();
  const explicitFramework = firstMatch(original, FRAMEWORKS);
  const explicitLanguage = firstMatch(original, STACK_SIGNALS);
  const workspaceStack = detectWorkspaceStack(context);
  const isModification = /\b(fix|debug|repair|refactor|upgrade|modify|change|existing|bug|error)\b/i.test(original);
  const isAlgorithmic = /\b(algorithm|complexity|big.?o|optimi[sz]|dynamic programming|graph|tree|sort|search|shortest path|dijkstra|bellman.?ford|floyd.?warshall|quick.?sort|merge.?sort|heap.?sort|binary search|breadth.?first|depth.?first|\bbfs\b|\bdfs\b|knapsack|union.?find|path.?finding|scheduler|parser|compiler|constraint|backtrack|recursion|data structure|race condition|concurren|throughput|latency|greedy|priority queue|hash map|hash table|trie|segment tree|fenwick|substring search|kmp|rabin.?karp)\b|एल्गोरिदम|डेटा स्ट्रक्चर|समय जटिलता|स्पेस जटिलता|लॉजिक|लॉजिकल|कोड को ऑप्टिमाइज़|एल्गोरिथम/i.test(original);
  const isFullStack = /\b(full.?stack|frontend|backend|api|database|authentication|authorization|payment|checkout|webhook|server|deploy|integration)\b/i.test(original);
  const isUi = /\b(app|application|website|web.?app|dashboard|landing page|portfolio|component|page|ui|ux|interface)\b|ऐप|वेबसाइट|डैशबोर्ड|पेज|इंटरफेस/i.test(original);
  const isSecuritySensitive = /\b(auth|authentication|authorization|permission|role|secret|token|password|payment|checkout|personal data|upload|sql|injection|security)\b/i.test(original);
  const isPerformanceSensitive = /\b(fast|ultra.?fast|performance|scale|scalable|high.?load|latency|throughput|memory|large dataset|optimi[sz]e)\b|तेज|जल्दी|फास्ट|कम समय|कम मेमोरी|परफॉर्मेंस|ऑप्टिमाइज़/i.test(original);

  const complexity = isAlgorithmic || isSecuritySensitive || isFullStack
    ? 'high'
    : (isUi || isModification ? 'medium' : 'low');

  const architectureRules = [
    'Honor explicit framework/language requests; otherwise inspect the existing workspace and preserve its stack and conventions.',
    'For a new project, choose the smallest supported architecture that satisfies the explicit requirements; do not add dependencies without a concrete need.',
    'Separate domain/business logic from UI, persistence, and network I/O when the scope warrants it.',
    'Use real event handlers and data flow for interactive features; do not substitute decorative controls or fake integrations.',
    'Preserve unrelated working code and prefer small, reviewable edits when modifying an existing project.',
  ];

  const algorithmRules = isAlgorithmic
    ? [
        'Restate the problem as inputs, outputs, constraints, and invariants before selecting an algorithm.',
        'Compare plausible approaches and choose based on correctness, input size, memory, and required latency.',
        'State time and space complexity where meaningful; avoid claiming an optimization without explaining its trade-off.',
        'Handle empty, singleton, duplicate, boundary, malformed, and worst-case inputs as applicable.',
        'Add deterministic tests for normal cases, edge cases, and adversarial cases; use an independent oracle or brute-force comparison for small inputs when feasible.',
      ]
    : [
        'Use the simplest correct algorithm for the actual requirements; do not add speculative abstraction or expensive reasoning stages.',
        'Validate inputs and cover empty, invalid, boundary, and failure states relevant to the feature.',
      ];

  const requestedFramework = explicitFramework || workspaceStack || detectFrameworkFromFiles(context);
  const frameworkRules = frameworkGuidance(requestedFramework);
  const algorithmFamilyRules = algorithmFamilyGuidance(text);

  const verificationGates = [
    'Check imports, file paths, package scripts, and dependency availability against the actual workspace.',
    'Run the narrowest relevant tests first, then build/type-check/lint where configured.',
    'Repair from concrete test/build/runtime errors and rerun the failed checks after a change.',
    'Report verification as passed only when command/tool evidence exists; otherwise label it unverified or blocked.',
  ];
  if (isSecuritySensitive) verificationGates.push('Review trust boundaries, authorization, input validation, secret handling, and failure paths; never hardcode credentials.');
  if (isPerformanceSensitive) verificationGates.push('Prefer measurement before optimization; avoid repeated work and unnecessary serial model/tool calls, but never skip correctness checks.');

  return {
    schemaVersion: '1.0',
    intent: {
      kind: isModification ? 'modify-existing' : 'create-or-implement',
      ui: isUi,
      fullStack: isFullStack,
      algorithmic: isAlgorithmic,
      securitySensitive: isSecuritySensitive,
      performanceSensitive: isPerformanceSensitive,
      complexity,
    },
    stack: {
      explicitFramework,
      explicitLanguage,
      workspaceStack,
      policy: explicitFramework || explicitLanguage
        ? 'Honor the explicitly requested stack unless technically incompatible; explain any blocker.'
        : workspaceStack
          ? 'Preserve the detected workspace stack; do not migrate frameworks without explicit authorization.'
          : 'Choose a well-supported, minimal stack from requirements and available tools.',
    },
    frameworkGuidance: frameworkRules,
    architectureRules,
    algorithmRules: [...algorithmRules, ...algorithmFamilyRules],
    verificationGates,
    executionPolicy: {
      simpleTask: 'Use one focused implementation task when scope and risk are low.',
      complexTask: 'Split only at real boundaries/dependencies; parallelize independent work only when shared-file conflicts and ordering are controlled.',
      repair: 'Use concrete tool output as repair context; do not repeat failed edits or regenerate unrelated files.',
      speed: 'Optimize total time by reducing redundant model/tool calls and limiting context to relevant files; do not trade away correctness, security, or required verification.',
    },
  };
}

function formatCodeGenerationStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') return '';
  return [
    '=== AI-DOST CODE GENERATION STRATEGY (deterministic guidance) ===',
    'Use this as an execution contract, not as a substitute for the original user request.',
    JSON.stringify(strategy, null, 2),
    '=== END CODE GENERATION STRATEGY ===',
  ].join('\n');
}

// ── Algorithm Intelligence & Verification (PR #19 / Phase 2) ─────────────────

const ALGORITHM_FAMILIES = new Map();

/**
 * Register an extensible algorithm family specification.
 */
function registerAlgorithmFamily(spec) {
  if (!spec || !spec.id) throw new Error('Algorithm family must have an id');
  ALGORITHM_FAMILIES.set(spec.id, {
    id: spec.id,
    name: spec.name || spec.id,
    matcher: spec.matcher || (() => false),
    complexity: spec.complexity || { time: 'O(N)', space: 'O(1)' },
    invariants: spec.invariants || [],
    edgeCases: spec.edgeCases || ['empty input', 'single element', 'duplicates', 'extreme bounds'],
    testGenerator: spec.testGenerator || null
  });
}

// Built-in Extensible Algorithm Families
registerAlgorithmFamily({
  id: 'arrays_strings',
  name: 'Arrays, Strings & Two Pointers',
  matcher: (text) => /\b(palindrome|two pointer|reverse|subarray|sliding window|prefix sum|anagram|substring|rotate array)\b/i.test(text),
  complexity: { time: 'O(N)', space: 'O(1)' },
  invariants: ['Pointers move monotonically toward each other or boundary', 'Window sum / state correctly reflects current range [L, R]'],
  edgeCases: ['empty string/array', 'single character/item', 'all identical elements', 'case sensitivity', 'unicode/punctuation', 'negative numbers']
});

registerAlgorithmFamily({
  id: 'hashing_maps',
  name: 'Hashing & Frequency Maps',
  matcher: (text) => /\b(two sum|frequency|hash map|hash table|hash set|distinct elements|group anagrams|first unique)\b/i.test(text),
  complexity: { time: 'O(N) average', space: 'O(N)' },
  invariants: ['Hash map stores key -> index/count mapping without collision loss', 'One-pass lookup prevents using same element twice'],
  edgeCases: ['target sum using same element twice (forbidden)', 'duplicate values with different indices', 'negative numbers', 'empty array']
});

registerAlgorithmFamily({
  id: 'sorting_binary_search',
  name: 'Sorting & Binary Search',
  matcher: (text) => !/\b(tree|bst)\b/i.test(text) && /\b(binary search|sorted array|bsearch|lower_bound|upper_bound|search in rotated|quick sort|merge sort)\b/i.test(text),
  complexity: { time: 'O(log N)', space: 'O(1)' },
  invariants: ['Search interval [left, right] always contains target if it exists', 'Midpoint calculation avoids integer overflow'],
  edgeCases: ['element not in array', 'target at index 0', 'target at last index', 'single element array', 'duplicate values', 'empty array']
});

registerAlgorithmFamily({
  id: 'stacks_queues',
  name: 'Stacks, Queues & Monotonic Sequences',
  matcher: (text) => !/\b(priority queue|dijkstra|graph)\b/i.test(text) && /\b(stack|queue|monotonic stack|next greater element|valid parentheses|two queues|min stack|deque)\b/i.test(text),
  complexity: { time: 'O(N) total / O(1) amortized', space: 'O(N)' },
  invariants: ['LIFO (stack) or FIFO (queue) contract is preserved across all operations', 'Monotonic stack elements remain strictly ordered'],
  edgeCases: ['pop on empty stack/queue (underflow check)', 'interleaved pushes and pops', 'nested brackets matching', 'large sequence of pushes before pop']
});

registerAlgorithmFamily({
  id: 'linked_lists',
  name: 'Linked Lists & Pointer Mutation',
  matcher: (text) => !/\b(lru cache|lfu cache)\b/i.test(text) && /\b(linked list|reverse list|detect cycle|fast and slow|floyd|merge two lists|remove nth node)\b/i.test(text),
  complexity: { time: 'O(N)', space: 'O(1)' },
  invariants: ['Sentinel/dummy head prevents null dereference on head mutation', 'Pointer reassignment does not orphan remaining chain'],
  edgeCases: ['empty list (null head)', 'single node', 'two nodes', 'even vs odd length lists', 'cycles (infinite loop guard)']
});

registerAlgorithmFamily({
  id: 'trees_bst',
  name: 'Binary Trees & Binary Search Trees',
  matcher: (text) => /\b(binary tree|bst|inorder|preorder|postorder|lowest common ancestor|lca|tree depth|balanced binary tree|level order)\b/i.test(text),
  complexity: { time: 'O(N) traversal / O(log N) balanced BST', space: 'O(H) recursion stack' },
  invariants: ['BST invariant: all left subtree keys < node key < all right subtree keys', 'Leaf node base cases return deterministic identity value'],
  edgeCases: ['null root', 'single node tree', 'skewed tree (degenerate list)', 'negative node values', 'duplicate keys']
});

registerAlgorithmFamily({
  id: 'heaps_priority_queues',
  name: 'Heaps & Priority Queues',
  matcher: (text) => !/\b(dijkstra|shortest path|graph)\b/i.test(text) && /\b(heap|priority queue|min-heap|max-heap|top k|kth largest|median finder|merge k sorted)\b/i.test(text),
  complexity: { time: 'O(N log K) or O(log N) per op', space: 'O(K)' },
  invariants: ['Heap property: parent is always <= child (min-heap) or >= child (max-heap)', 'Size bounded to K elements for top-K problems'],
  edgeCases: ['k larger than array length', 'k == 1', 'all identical elements', 'empty input']
});

registerAlgorithmFamily({
  id: 'graphs_traversal_shortest_paths',
  name: 'Graphs, BFS/DFS, Dijkstra & Topological Sort',
  matcher: (text) => !/\b(union find|disjoint set|dsu)\b/i.test(text) && /\b(graph|dijkstra|shortest path|bfs|dfs|topological sort|cycle detection|connected components|bipartite|kruskal|prim)\b/i.test(text),
  complexity: { time: 'O(V + E) for BFS/DFS; O((V + E) log V) for Dijkstra', space: 'O(V + E)' },
  invariants: ['Visited set prevents infinite cycles', 'Dijkstra priority queue greedily settles shortest distances with non-negative weights'],
  edgeCases: ['disconnected graph / unreachable target', 'self-loops and multiple edges between same pair', 'graph with 0 or 1 vertex', 'negative weight cycle (fails Dijkstra)']
});

registerAlgorithmFamily({
  id: 'dynamic_programming',
  name: 'Dynamic Programming & Memoization',
  matcher: (text) => /\b(dynamic programming|dp|knapsack|longest common subsequence|lcs|longest increasing subsequence|lis|coin change|edit distance|climbing stairs)\b/i.test(text),
  complexity: { time: 'O(N * W) or O(N^2)', space: 'O(N * W) or O(W) with space optimization' },
  invariants: ['Optimal substructure: solution to problem is constructed from optimal solutions to subproblems', 'Base cases explicitly defined for capacity=0 or index=0'],
  edgeCases: ['zero capacity / zero target', 'capacity smaller than any item weight', 'all items exceed capacity', 'duplicate denominations']
});

registerAlgorithmFamily({
  id: 'caching_optimization',
  name: 'Caching, LRU/LFU & In-Memory Storage',
  matcher: (text) => /\b(lru cache|lfu cache|cache eviction|ttl cache|rate limiter|token bucket|sliding window rate)\b/i.test(text),
  complexity: { time: 'O(1) average get/put', space: 'O(Capacity)' },
  invariants: ['Capacity bound is strictly enforced on put', 'Get and put operations update recency order in O(1)'],
  edgeCases: ['capacity = 1', 'updating value of existing key does not increment count', 'eviction correctly targets least recently accessed item', 'get on non-existent key returns -1 or null']
});

registerAlgorithmFamily({
  id: 'union_find_disjoint_set',
  name: 'Disjoint Set Union (Union-Find)',
  matcher: (text) => /\b(union find|disjoint set|dsu|connected components in graph|redundant connection|kruskal)\b/i.test(text),
  complexity: { time: 'O(alpha(N)) ~ O(1) with path compression and rank', space: 'O(N)' },
  invariants: ['Path compression flattens tree on find', 'Union by rank/size keeps tree height minimal'],
  edgeCases: ['union on already connected components returns false / detects cycle', 'all elements in single set', 'every element isolated']
});

registerAlgorithmFamily({
  id: 'tries_string_matching',
  name: 'Trie & String Matching (KMP, Rabin-Karp)',
  matcher: (text) => /\b(trie|prefix tree|autocomplete|kmp|rabin[- ]karp|pattern matching|word search)\b/i.test(text),
  complexity: { time: 'O(M) per word insertion/lookup; O(N + M) for KMP', space: 'O(Total characters)' },
  invariants: ['isEndOfWord flag accurately differentiates prefixes from full words', 'Failure/LPS array correctly tracks longest proper prefix that is also suffix'],
  edgeCases: ['empty search string', 'prefix exists but word does not', 'case sensitivity', 'non-ASCII characters']
});

/**
 * Classify a prompt into routine edit vs algorithmic vs application feature.
 */
function classifyRequest(request = '') {
  const text = String(request || '').trim().toLowerCase();
  if (!text) return { kind: 'ROUTINE_EDIT', isRoutine: true, family: null };

  // Fast Path: Routine edits, typo fixes, simple UI tweaks, adding imports/props
  const isRoutine = (
    text.length < 50 &&
    /\b(typo|rename|change text|color|update title|button text|add prop|export|import|margin|padding|bg-|header text)\b/i.test(text) &&
    !/\b(algorithm|sort|search|tree|graph|dp|cache|dijkstra|knapsack|lru|stack|queue|binary)\b/i.test(text)
  );

  if (isRoutine) {
    return {
      kind: 'ROUTINE_EDIT',
      isRoutine: true,
      family: null,
      strategy: 'FAST_PATH'
    };
  }

  // Check algorithmic families
  for (const [id, fam] of ALGORITHM_FAMILIES.entries()) {
    if (fam.matcher(text)) {
      return {
        kind: 'ALGORITHMIC_PROBLEM',
        isRoutine: false,
        family: id,
        familyName: fam.name,
        strategy: 'STRUCTURED_ALGORITHM_SPEC'
      };
    }
  }

  // Full-stack / Feature request
  return {
    kind: 'APPLICATION_FEATURE',
    isRoutine: false,
    family: null,
    strategy: 'STANDARD_ENGINEERING'
  };
}

/**
 * Derives an explicit, structured algorithm specification for algorithmic requests.
 */
function deriveAlgorithmSpecification(request, classification = null) {
  const cls = classification || classifyRequest(request);
  if (cls.isRoutine) {
    return {
      strategy: 'FAST_PATH',
      specificationNeeded: false
    };
  }

  const fam = cls.family ? ALGORITHM_FAMILIES.get(cls.family) : null;
  const familyName = fam ? fam.name : 'General Computer Science Algorithm';
  const defaultComplexity = fam ? fam.complexity : { time: 'O(N)', space: 'O(1)' };
  const invariants = fam ? fam.invariants : ['Input data contract preserved', 'Boundary conditions validated'];
  const edgeCases = fam ? fam.edgeCases : ['empty input', 'single element', 'extreme values', 'negative numbers'];

  return {
    strategy: 'STRUCTURED_ALGORITHM_SPEC',
    specificationNeeded: true,
    family: cls.family || 'general',
    familyName,
    contract: {
      inputDescription: `Strictly defined typed inputs for: ${request}`,
      outputDescription: 'Deterministic return value adhering to contract without side effects unless required',
      constraintsAndAssumptions: [
        'Validate input bounds (N <= 1e5 standard unless noted)',
        'Check for null/undefined or empty inputs',
        'Handle negative, zero, and boundary values cleanly'
      ],
      edgeCasesAndInvariants: [
        ...invariants,
        ...edgeCases
      ],
      expectedComplexity: defaultComplexity,
      simplestCorrectApproachRationale: 'Select simplest algorithm meeting complexity constraint; do not over-engineer with unnecessary data structures',
      verificationMethod: 'Independent executable tests including boundary conditions, adversarial inputs, and property assertions'
    }
  };
}

/**
 * Builds the algorithmic instruction block to inject into agent/copilot prompts.
 */
function buildAlgorithmGuidanceBlock(spec) {
  if (!spec || !spec.specificationNeeded) return '';

  const c = spec.contract;
  return `
[ALGORITHM DESIGN & EXECUTION PROTOCOL: ${spec.familyName.toUpperCase()}]
1. PROBLEM ANALYSIS & CONTRACT:
   - Target Family: ${spec.familyName}
   - Expected Complexity: Time ${c.expectedComplexity.time}, Space ${c.expectedComplexity.space}
   - Primary Invariants:
${c.edgeCasesAndInvariants.map((inv) => `     * ${inv}`).join('\n')}

2. IMPLEMENTATION RULES:
   - ZERO PLACEHOLDERS: Implement 100% of the logic. Never write 'pass', '// TODO', or ellipses.
   - SIMPLEST CORRECT APPROACH: Select the cleanest algorithm satisfying the complexity constraints.
   - EDGE-CASE SAFETY: Handle empty inputs, single elements, negative numbers, duplicates, and extreme bounds defensively.
   - VERIFICATION REQUIREMENT: Provide working runnable tests covering public and edge cases. An algorithm is only considered complete when backed by executable evidence.
`;
}

/**
 * Completion verification rule: An algorithm is only verified if execution evidence passed.
 */
function evaluateAlgorithmVerification(executionResult) {
  if (!executionResult) {
    return {
      verified: false,
      status: 'UNVERIFIED',
      reason: 'No execution evidence provided'
    };
  }

  if (executionResult.status === 'SUCCESS' && (executionResult.testsPassed > 0 || executionResult.verified === true)) {
    return {
      verified: true,
      status: 'VERIFIED',
      durationMs: executionResult.durationMs || 0,
      reason: 'All automated tests and property assertions passed'
    };
  }

  return {
    verified: false,
    status: executionResult.status || 'FAILED',
    reason: executionResult.error || 'Execution did not confirm correctness'
  };
}

module.exports = {
  // Framework stack detection & strategy (PR #18 / Phase 1)
  analyzeCodeGenerationRequest,
  formatCodeGenerationStrategy,
  detectWorkspaceStack,
  detectFrameworkFromFiles,
  // Algorithm intelligence & verification (PR #19 / Phase 2)
  ALGORITHM_FAMILIES,
  registerAlgorithmFamily,
  classifyRequest,
  deriveAlgorithmSpecification,
  buildAlgorithmGuidanceBlock,
  evaluateAlgorithmVerification
};
