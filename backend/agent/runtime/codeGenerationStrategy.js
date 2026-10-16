'use strict';

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

// =============================================================================
// ADVANCED CODE INTELLIGENCE: Algorithm Families & Reasoning Engine
// =============================================================================

const ALGORITHM_FAMILIES = new Map();

function registerAlgorithmFamily(def) {
  if (!def || !def.id || !def.name) {
    throw new Error('Algorithm family definition must include id and name');
  }
  ALGORITHM_FAMILIES.set(def.id, def);
}

// 1. Arrays & Strings
registerAlgorithmFamily({
  id: 'arrays_strings',
  name: 'Arrays, Strings & Two Pointers',
  matcher: (text) => /\b(two pointer|sliding window|prefix sum|subarray|subsegment|kadane|palindrome|string reversal|substring window)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isFixedWindow) {
      return { algorithm: 'Fixed-Size Sliding Window', rationale: 'Fixed window size allows O(1) state transition per boundary shift without rescanning' };
    }
    if (constraints.isRangeSum) {
      return { algorithm: 'Prefix Sum Array', rationale: 'Precomputing cumulative sums enables O(1) range queries after O(N) precomputation' };
    }
    if (constraints.isMaxSubarray) {
      return { algorithm: "Kadane's Algorithm", rationale: 'Dynamic programming state tracks maximum ending-at-current-index in single O(N) pass' };
    }
    return { algorithm: 'Two-Pointer Technique', rationale: 'Opposite or sliding pointers narrow candidate space monotonically without nested loops' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: constraints.isRangeSum ? 'O(N) precompute, O(1) query' : 'O(N)',
    space: constraints.isRangeSum ? 'O(N)' : 'O(1)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Sequential contiguous memory', 'Elements fit within standard integer limits']
  }),
  invariants: [
    'Window boundary invariant: 0 <= left <= right < N',
    'Prefix sum invariant: P[i] = P[i-1] + arr[i-1] with P[0] = 0',
    'Two-pointer monotonicity: pointers only advance forward to prevent infinite loops'
  ],
  edgeCases: [
    'empty input array or string',
    'single element array',
    'all negative numbers (for max subarray)',
    'all identical elements',
    'window size K > array length N'
  ]
});

// 2. Hashing & Frequency Counting
registerAlgorithmFamily({
  id: 'hashing',
  name: 'Hashing, Dictionaries & Frequency Maps',
  matcher: (text) => /\b(hash map|hash table|hash set|frequency counter|count frequencies|two sum|pair with sum|group anagrams|intersection of arrays)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isGrouping) {
      return { algorithm: 'Hash Map with Canonical Key Grouping', rationale: 'Sorted key or frequency fingerprint groups equivalence classes in expected linear time' };
    }
    if (constraints.isDistinct) {
      return { algorithm: 'Hash Set Membership', rationale: 'Set provides amortized O(1) insertion and presence tests' };
    }
    return { algorithm: 'Complement Hash Map Lookup', rationale: 'Single-pass dictionary checks for target - current element in amortized O(1) time' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(N) expected average',
    space: 'O(N)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Uniform hash distribution', 'Amortized O(1) bucket lookup without excessive collisions']
  }),
  invariants: [
    'Key uniqueness: each key maps to exactly one value or frequency bucket',
    'Amortized lookup: collisions resolved via chaining or open addressing without corrupting keys'
  ],
  edgeCases: [
    'empty collection',
    'all keys identical',
    'negative integers or zero keys',
    'null or undefined keys',
    'keys causing hash collisions'
  ]
});

// 3. Sorting & Searching
registerAlgorithmFamily({
  id: 'sorting_searching',
  name: 'Sorting, Binary Search & Order Statistics',
  matcher: (text) => /\b(binary search|lower bound|upper bound|search in rotated|quicksort|merge sort|counting sort|radix sort|dutch national flag)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isRotated) {
      return { algorithm: 'Modified Binary Search (Pivot Aware)', rationale: 'Identifies which half is sorted to discard half the search space in O(log N)' };
    }
    if (constraints.requiresStability) {
      return { algorithm: 'Merge Sort or Timsort', rationale: 'Guarantees O(N log N) worst-case time while preserving relative order of equal keys' };
    }
    if (constraints.isBoundedRange) {
      return { algorithm: 'Counting Sort or Dutch National Flag', rationale: 'Finite key domain allows O(N) linear time distribution' };
    }
    return { algorithm: 'Binary Search (Monotonic Predicate)', rationale: 'Divides sorted candidate interval in half on each step using invariant low <= high' };
  },
  complexityAnalysis: (constraints = {}) => {
    if (constraints.isSearch) {
      return { time: 'O(log N)', space: 'O(1)', isEstimate: !constraints.hasKnownBounds, assumptions: ['Random access indexable collection', 'Strict monotonicity / sorted input'] };
    }
    return { time: 'O(N log N)', space: constraints.requiresStability ? 'O(N)' : 'O(log N)', isEstimate: !constraints.hasKnownBounds, assumptions: ['Comparison-based sorting model'] };
  },
  invariants: [
    'Sorted precondition: arr[i] <= arr[i+1] for all valid indices',
    'Search space invariant: target, if present, strictly lies within [low, high]',
    'Mid calculation: mid = low + Math.floor((high - low) / 2) prevents integer overflow'
  ],
  edgeCases: [
    'empty array',
    'single element match and miss',
    'target smaller than minimum element',
    'target larger than maximum element',
    'duplicate target values (first vs last occurrence)',
    'array with negative and positive numbers'
  ]
});

// 4. Stacks & Queues
registerAlgorithmFamily({
  id: 'stacks_queues',
  name: 'Stacks, Queues & Monotonic Sequences',
  matcher: (text) => /\b(stack|queue|deque|monotonic stack|monotonic queue|next greater element|valid parentheses|min stack|sliding window maximum)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isNextGreater) {
      return { algorithm: 'Monotonic Stack', rationale: 'Maintains descending elements so the next greater element resolves in aggregate O(N) operations' };
    }
    if (constraints.isWindowMax) {
      return { algorithm: 'Monotonic Deque', rationale: 'Maintains indices of maximums within window, discarding smaller elements from back in amortized O(1)' };
    }
    return { algorithm: 'LIFO Stack', rationale: 'Enforces Last-In-First-Out nesting discipline for brackets and state tracking' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(N) aggregate (each element pushed and popped at most once)',
    space: 'O(N)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Stack/deque operations push/pop are O(1)']
  }),
  invariants: [
    'LIFO discipline: top element is always the most recently added unpopped element',
    'Monotonicity invariant: stack elements are strictly ordered (increasing or decreasing)'
  ],
  edgeCases: [
    'empty stack pop or peek',
    'unmatched closing delimiters',
    'unmatched opening delimiters remaining at end',
    'all equal elements',
    'strictly decreasing or strictly increasing input'
  ]
});

// 5. Linked Lists
registerAlgorithmFamily({
  id: 'linked_lists',
  name: 'Linked Lists & Pointer Graph Navigation',
  matcher: (text) => /\b(linked list|singly linked|doubly linked|cycle detection|floyd|tortoise and hare|reverse linked list|merge two sorted lists|lru list)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isCycleDetection) {
      return { algorithm: "Floyd's Tortoise and Hare", rationale: 'Two pointers at speeds 1 and 2 detect cycles in O(N) time with O(1) auxiliary space' };
    }
    if (constraints.isReversal) {
      return { algorithm: 'Iterative 3-Pointer In-Place Reversal', rationale: 'Reverses pointers in single pass using prev, curr, next with zero memory allocation' };
    }
    return { algorithm: 'Sentinel/Dummy Head Navigation', rationale: 'Eliminates boundary edge cases for head node creation and removal' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(N)',
    space: 'O(1) auxiliary space',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Pointer manipulation without memory copying']
  }),
  invariants: [
    'Pointer integrity: next pointer updates preserve reachability without creating accidental cycles',
    'Terminal condition: acyclic list strictly terminates with node.next === null'
  ],
  edgeCases: [
    'empty list (head is null)',
    'single node list',
    'two-node list with cycle',
    'cycle covering the entire list from head',
    'odd vs even node count for midpoint selection'
  ]
});

// 6. Trees & Hierarchical Structures
registerAlgorithmFamily({
  id: 'trees',
  name: 'Trees, Binary Search Trees & Hierarchies',
  matcher: (text) => /\b(binary tree|bst|binary search tree|lowest common ancestor|lca|tree traversal|inorder|preorder|postorder|level order|diameter of tree|invert binary tree)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isBSTValidation) {
      return { algorithm: 'Range-Bounded Recursive Invariant (min < val < max)', rationale: 'Propagates strict lower and upper bounds down recursive calls in O(N) time' };
    }
    if (constraints.isLevelOrder) {
      return { algorithm: 'Queue-Based Breadth-First Traversal', rationale: 'Processes nodes layer by layer preserving left-to-right visual order' };
    }
    return { algorithm: 'Post-Order Divide and Conquer', rationale: 'Solves left and right subproblems before combining results at the parent node' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(N)',
    space: constraints.isBalanced ? 'O(log N) stack' : 'O(N) worst-case skewed tree stack',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Finite tree with no cyclic cross-edges']
  }),
  invariants: [
    'BST invariant: for every node, all left subtree keys < node.val < all right subtree keys',
    'Tree depth: recursion depth is strictly bounded by tree height H <= N'
  ],
  edgeCases: [
    'empty tree (root is null)',
    'single node tree',
    'degenerate / skewed tree (linear chain like linked list)',
    'duplicate node values in BST',
    'negative or extreme integer values at boundaries'
  ]
});

// 7. Heaps & Priority Queues
registerAlgorithmFamily({
  id: 'heaps',
  name: 'Heaps, Priority Queues & Top-K Selection',
  matcher: (text) => /\b(heap|priority queue|top k|kth largest|kth smallest|min heap|max heap|median from data stream|merge k sorted)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isTopK) {
      return { algorithm: 'Bounded Min-Heap of Size K', rationale: 'Maintains the K largest elements in O(N log K) time and O(K) space instead of O(N log N) full sort' };
    }
    if (constraints.isStreamingMedian) {
      return { algorithm: 'Dual Heap (Max-Heap + Min-Heap)', rationale: 'Balances lower and upper halves to return median in O(1) with O(log N) insertions' };
    }
    return { algorithm: 'Binary Min/Max Heap', rationale: 'Maintains heap-order property supporting O(log N) insertion and extraction of extremum' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: constraints.isTopK ? 'O(N log K)' : 'O(N log N) or O(log N) per operation',
    space: constraints.isTopK ? 'O(K)' : 'O(N)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Array-backed binary heap with parent-child index arithmetic']
  }),
  invariants: [
    'Heap-order property: parent <= children (min-heap) or parent >= children (max-heap)',
    'Complete binary tree property: all levels full except possibly the last level filled from left'
  ],
  edgeCases: [
    'extract from empty heap',
    'K = 1 (equivalent to find min/max)',
    'K >= N (returns all elements sorted)',
    'all duplicate values in heap',
    'negative and zero priorities'
  ]
});

// 8. Graphs & Network Flows
registerAlgorithmFamily({
  id: 'graphs',
  name: 'Graphs, Pathfinding & Topological Sort',
  matcher: (text) => /\b(graph|dijkstra|shortest path|breadth first search|\bbfs\b|depth first search|\bdfs\b|bellman ford|topological sort|detect cycle in graph|bipartite)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isUnweighted) {
      return { algorithm: 'Breadth-First Search (BFS)', rationale: 'Explores vertices in increasing distance order, guaranteeing shortest path in O(V + E)' };
    }
    if (constraints.hasNegativeWeights) {
      return { algorithm: 'Bellman-Ford Algorithm', rationale: 'Relaxes all edges V-1 times and detects reachable negative cycles' };
    }
    if (constraints.isDAG) {
      return { algorithm: "Topological Sort (Kahn's Algorithm)", rationale: 'In-degree queue processing resolves dependencies linearly in O(V + E)' };
    }
    return { algorithm: "Dijkstra's Algorithm with Priority Queue", rationale: 'Greedily extracts minimum tentative distance vertex for non-negative edge weights in O((V + E) log V)' };
  },
  complexityAnalysis: (constraints = {}) => {
    if (constraints.isUnweighted || constraints.isDAG) {
      return { time: 'O(V + E)', space: 'O(V)', isEstimate: !constraints.hasKnownBounds, assumptions: ['Adjacency list representation'] };
    }
    if (constraints.hasNegativeWeights) {
      return { time: 'O(V * E)', space: 'O(V)', isEstimate: !constraints.hasKnownBounds, assumptions: ['Edge list representation'] };
    }
    return { time: 'O((V + E) log V)', space: 'O(V)', isEstimate: !constraints.hasKnownBounds, assumptions: ['Min-heap backed priority queue', 'Non-negative edge weights'] };
  },
  invariants: [
    'Visited tracking: vertices marked visited upon enqueue/processing to prevent infinite loops in cyclic graphs',
    'Distance monotonicity: in Dijkstra, extracted distances are final for non-negative edge weights'
  ],
  edgeCases: [
    'disconnected graph with multiple components',
    'graph with no edges (isolated vertices)',
    'self-loops on vertices',
    'negative weight cycle (must report error or detect cycle)',
    'start vertex equals destination vertex',
    'unreachable target node (must return -1 or infinity)'
  ]
});

// 9. Dynamic Programming & Memoization
registerAlgorithmFamily({
  id: 'dynamic_programming',
  name: 'Dynamic Programming & Memoization',
  matcher: (text) => /\b(dynamic programming|\bdp\b|knapsack|longest common subsequence|lcs|longest increasing subsequence|lis|coin change|edit distance|climbing stairs|matrix chain)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isSubsequence) {
      return { algorithm: '2D DP Table with Optimal Substructure', rationale: 'Character comparison recurrence decomposes into prefix subproblems' };
    }
    if (constraints.isKnapsack) {
      return { algorithm: '1D State-Optimized Knapsack DP', rationale: 'Reverse-capacity iteration computes optimal value in O(N * W) time with O(W) space' };
    }
    return { algorithm: 'Bottom-Up Iterative DP or Top-Down Memoization', rationale: 'Solves subproblems in topological order avoiding exponential overlapping recalculations' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: constraints.isLIS ? 'O(N log N) via patience sort' : 'O(N * W) or O(N^2) dependent on state space',
    space: constraints.isSpaceOptimized ? 'O(W) or O(N)' : 'O(N * W)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['State transitions depend strictly on previously computed subproblems']
  }),
  invariants: [
    'Optimal substructure: optimal solution to problem contains optimal solutions to subproblems',
    'Base cases: base states explicitly defined for index 0 or capacity 0'
  ],
  edgeCases: [
    'target capacity or amount is zero',
    'target cannot be formed by any denomination (return -1)',
    'all item weights exceed target capacity',
    'duplicate coin denominations or item values',
    'negative weights or values when non-negative assumed'
  ]
});

// 10. Caching & In-Memory Eviction
registerAlgorithmFamily({
  id: 'caching',
  name: 'Caching, LRU/LFU & In-Memory Storage',
  matcher: (text) => /\b(lru cache|lfu cache|cache eviction|ttl cache|rate limiter|token bucket|sliding window log|cache with expiration)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isLFU) {
      return { algorithm: 'LFU Cache (Hash Map + Frequency Buckets)', rationale: 'Min-frequency pointer and bucket lists maintain O(1) eviction for least frequently used keys' };
    }
    if (constraints.isTTL) {
      return { algorithm: 'TTL Cache with Timestamp Pruning', rationale: 'Stores expiration timestamps and prunes lazily on access or background sweep' };
    }
    return { algorithm: 'LRU Cache (Hash Map + Doubly Linked List)', rationale: 'Hash map provides O(1) key access while doubly linked list maintains access recency order' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(1) average for both get and put',
    space: 'O(Capacity)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Doubly linked list sentinel nodes prevent null pointer edge cases']
  }),
  invariants: [
    'Capacity constraint: cache size never exceeds allocated capacity',
    'Recency ordering: most recently accessed node is always moved to head; least recently accessed is at tail'
  ],
  edgeCases: [
    'capacity = 1 boundary condition',
    'capacity <= 0 invalid configuration',
    'updating value of existing key updates recency without incrementing size',
    'get on non-existent key returns -1 or null without modifying recency',
    'rapid eviction when stream of keys exceeds capacity'
  ]
});

// 11. Union-Find / Disjoint Set Union
registerAlgorithmFamily({
  id: 'union_find',
  name: 'Disjoint Set Union (Union-Find)',
  matcher: (text) => /\b(union find|disjoint set|dsu|connected components|kruskal|redundant connection|number of islands ii)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    return { algorithm: 'DSU with Path Compression and Union by Rank/Size', rationale: 'Path compression flattens trees on find; union by rank keeps depth <= log N for nearly O(1) alpha(N) operations' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(alpha(N)) amortized per operation (~O(1) in practice)',
    space: 'O(N)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Both path compression and union by rank/size are implemented']
  }),
  invariants: [
    'Representative root: each set has exactly one root pointing to itself (parent[root] === root)',
    'Component count: each successful union of disjoint sets decrements total component count by 1'
  ],
  edgeCases: [
    'union on already connected elements returns false (cycle detection)',
    'all elements isolated (N components)',
    'all elements unified into a single component',
    'self-union (node with itself)'
  ]
});

// 12. String Matching & Tries
registerAlgorithmFamily({
  id: 'string_matching',
  name: 'String Pattern Matching & Tries',
  matcher: (text) => /\b(kmp|knuth morris pratt|rabin karp|string matching|pattern matching|longest prefix suffix|lps|z algorithm|trie|prefix tree)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isPrefixAutocomplete) {
      return { algorithm: 'Trie / Prefix Tree', rationale: 'Tree of character transitions shares prefixes and finds all completions in O(Prefix Length)' };
    }
    if (constraints.isMultiPattern) {
      return { algorithm: 'Rabin-Karp Rolling Hash', rationale: 'Polynomial rolling hash computes window hashes in O(1) to test multiple patterns simultaneously' };
    }
    return { algorithm: 'Knuth-Morris-Pratt (KMP) with LPS Array', rationale: 'Longest Proper Prefix which is also Suffix avoids back-tracking in text during mismatch' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(N + M) where N = text length, M = pattern length',
    space: 'O(M) for LPS array',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Linear scan through text without rewinding text index']
  }),
  invariants: [
    'LPS invariant: lps[i] is the length of the longest proper prefix of pattern[0..i] that matches suffix of pattern[0..i]',
    'Non-backtracking text pointer: text pointer i advances strictly forward 0 <= i < N'
  ],
  edgeCases: [
    'empty pattern (matches at index 0)',
    'empty text with non-empty pattern (no match)',
    'pattern longer than text (no match)',
    'overlapping pattern occurrences (e.g. pattern "AAA" in "AAAAA")',
    'pattern with no repeated prefixes (lps array all zeros)'
  ]
});

/**
 * Classify a prompt into routine edit vs algorithmic vs application feature.
 */
function classifyRequest(request = '') {
  const text = String(request || '').trim();
  const lower = text.toLowerCase();
  if (!text) return { kind: 'ROUTINE_EDIT', isRoutine: true, strategy: 'FAST_PATH', family: null };

  // Fast Path: Routine edits, typo fixes, simple UI tweaks, adding imports/props
  const isRoutine = (
    text.length < 80 &&
    /\b(typo|rename|change text|color|update|fix|button text|copyright|add prop|export|import|margin|padding|bg-|header text)\b/i.test(lower) &&
    !/\b(algorithm|sort|search|tree|graph|dp|cache|dijkstra|knapsack|lru|stack|queue|binary|complexity|big.?o|optimi[sz])\b/i.test(lower)
  );

  if (isRoutine) {
    return {
      kind: 'ROUTINE_EDIT',
      category: 'ROUTINE_EDIT',
      isRoutine: true,
      multiTask: false,
      strategy: 'FAST_PATH',
      family: null,
      familyName: null
    };
  }

  // Check algorithmic families with domain-specific algorithms prioritized over lower-level structures
  const priorityOrder = [
    'graphs',
    'dynamic_programming',
    'caching',
    'union_find',
    'string_matching',
    'trees',
    'heaps',
    'linked_lists',
    'sorting_searching',
    'stacks_queues',
    'hashing',
    'arrays_strings'
  ];

  for (const id of priorityOrder) {
    const fam = ALGORITHM_FAMILIES.get(id);
    if (fam && fam.matcher(lower)) {
      return {
        kind: 'ALGORITHMIC_PROBLEM',
        category: 'ALGORITHMIC_PROBLEM',
        isRoutine: false,
        multiTask: true,
        strategy: 'STRUCTURED_ALGORITHM_SPEC',
        family: id,
        familyName: fam.name
      };
    }
  }

  for (const [id, fam] of ALGORITHM_FAMILIES.entries()) {
    if (!priorityOrder.includes(id) && fam.matcher(lower)) {
      return {
        kind: 'ALGORITHMIC_PROBLEM',
        category: 'ALGORITHMIC_PROBLEM',
        isRoutine: false,
        multiTask: true,
        strategy: 'STRUCTURED_ALGORITHM_SPEC',
        family: id,
        familyName: fam.name
      };
    }
  }

  // Full-stack / Feature request
  return {
    kind: 'APPLICATION_FEATURE',
    category: 'APPLICATION_FEATURE',
    isRoutine: false,
    multiTask: true,
    strategy: 'STANDARD_ENGINEERING',
    family: null,
    familyName: null
  };
}

/**
 * Derives an explicit, validated, structured algorithm contract for algorithmic requests.
 */
function deriveAlgorithmTaskContract(request, classification = null, context = {}) {
  const cls = classification || classifyRequest(request);
  if (cls.isRoutine) {
    return {
      strategy: 'FAST_PATH',
      specificationNeeded: false
    };
  }

  const fam = cls.family ? ALGORITHM_FAMILIES.get(cls.family) : null;
  const familyName = fam ? fam.name : 'General Computer Science Algorithm';

  // Detect explicit constraints from request text
  const text = String(request || '').toLowerCase();
  const hasKnownBounds = /\b(\d+\s*(?:<=|<|to|-)\s*[nN]|[nN]\s*(?:<=|<|to|-)\s*\d+|1e\d|10\^\d)\b/.test(text);
  const isFixedWindow = /\b(fixed|window size|length k|size k)\b/i.test(text);
  const isRangeSum = /\b(range sum|prefix sum|cumulative sum)\b/i.test(text);
  const isMaxSubarray = /\b(maximum subarray|largest sum subarray|kadane)\b/i.test(text);
  const isUnweighted = /\b(unweighted|unit weights|fewest hops|breadth first|bfs)\b/i.test(text);
  const hasNegativeWeights = /\b(negative weight|negative edge|bellman)\b/i.test(text);
  const isDAG = /\b(dag|directed acyclic|topological|dependencies)\b/i.test(text);
  const requiresStability = /\b(stable|preserve order|tie.?breaking)\b/i.test(text);
  const isTopK = /\b(top.?k|kth largest|kth smallest)\b/i.test(text);

  const constraints = {
    hasKnownBounds,
    isFixedWindow,
    isRangeSum,
    isMaxSubarray,
    isUnweighted,
    hasNegativeWeights,
    isDAG,
    requiresStability,
    isTopK
  };

  const selectedAlg = fam && typeof fam.selectAlgorithm === 'function'
    ? fam.selectAlgorithm(constraints)
    : { algorithm: 'Canonical Correct Algorithm', rationale: 'Cleanest deterministic approach meeting problem constraints' };

  const complexity = fam && typeof fam.complexityAnalysis === 'function'
    ? fam.complexityAnalysis(constraints)
    : {
        time: hasKnownBounds ? 'O(N)' : 'O(N) (estimated - input bounds unspecified)',
        space: 'O(1) (estimated)',
        isEstimate: !hasKnownBounds,
        assumptions: ['Linear processing over input elements', 'Standard memory layout']
      };

  const invariants = fam ? fam.invariants : ['Input data contract preserved', 'Boundary conditions validated defensively'];
  const edgeCases = fam ? fam.edgeCases : ['empty input', 'single element', 'duplicate elements', 'negative numbers', 'boundary values'];

  // Alternative candidate algorithms comparison
  const candidateAlgorithms = [
    {
      approach: selectedAlg.algorithm,
      rationale: selectedAlg.rationale,
      isChosen: true,
      tradeOffs: 'Optimizes target time/space constraints without over-engineering'
    },
    {
      approach: 'Exhaustive / Brute Force Approach',
      rationale: 'Simple to reason about but suffers exponential or quadratic complexity on large inputs',
      isChosen: false,
      tradeOffs: 'Unacceptable time complexity for production scales'
    }
  ];

  const requirementId = `REQ-ALG-${(cls.family || 'GEN').toUpperCase().slice(0, 4)}-1`;

  return {
    strategy: 'STRUCTURED_ALGORITHM_SPEC',
    specificationNeeded: true,
    family: cls.family || 'general',
    algorithmFamily: cls.family || 'general',
    familyName,
    selectedAlgorithm: selectedAlg,
    complexity,
    invariants,
    edgeCases,
    requirements: [
      { id: 'REQ-ALG-01', description: `Implement ${selectedAlg.algorithm} solution` },
      { id: 'REQ-ALG-02', description: 'Run independent tests and verification checks' }
    ],
    tasks: [
      {
        id: 'task-1',
        specialty: 'integration',
        role: 'CODER',
        objective: `Implement ${selectedAlg.algorithm} for: ${request}. State assumptions and time and space complexity (${complexity.time} time, ${complexity.space} space). Invariants: ${invariants.join('; ')}.`,
        dependsOn: [],
        requirements: ['REQ-ALG-01'],
        expectedOutput: 'Correct implementation with stated assumptions, complexity analysis, and edge-case handling.'
      },
      {
        id: 'task-2',
        specialty: 'testing',
        role: 'VERIFIER',
        objective: 'Create and run independent falsification tests with boundary and adversarial checks',
        dependsOn: ['task-1'],
        requirements: ['REQ-ALG-02'],
        expectedOutput: 'Passing automated test suite evidence.'
      }
    ],
    contract: {
      problemStatement: `Implement robust, verified ${familyName} solution for: "${String(request || '').trim()}"`,
      inputOutputContract: {
        inputs: 'Explicitly typed input parameters with bounds and format checking',
        outputs: 'Deterministic output value adhering to specification without unrequested side effects',
        dataConstraints: hasKnownBounds
          ? 'Explicit bounds provided in user request'
          : 'Bounds unspecified in request; implementation must handle arbitrary valid sizes safely'
      },
      preconditionsAndInvariants: invariants,
      edgeCases: edgeCases,
      candidateAlgorithms: candidateAlgorithms,
      selectedAlgorithm: selectedAlg.algorithm,
      complexity: complexity,
      expectedFileChanges: [
        'src/algorithms/' + (cls.family || 'algorithm') + '.js',
        'tests/' + (cls.family || 'algorithm') + '.test.js'
      ],
      requirementTrace: [
        {
          requirementId,
          description: `Correct execution of ${selectedAlg.algorithm} meeting ${complexity.time} time complexity`,
          verificationCheck: 'Independent automated unit test and oracle verification'
        }
      ],
      falsificationTests: [
        'Boundary test with empty input collection',
        'Boundary test with single element or minimum capacity',
        'Adversarial test with duplicate or extreme boundary values',
        'Correctness comparison against independent reference output on small inputs'
      ]
    }
  };
}

/**
 * Builds the algorithmic instruction block to inject into agent/copilot prompts.
 */
function buildAlgorithmGuidanceBlock(spec) {
  if (!spec || !spec.specificationNeeded || !spec.contract) return '';

  const c = spec.contract;
  return `
[ALGORITHM TASK CONTRACT: ${spec.familyName.toUpperCase()}]
1. PROBLEM STATEMENT:
   ${c.problemStatement}

2. INPUT/OUTPUT CONTRACT & CONSTRAINTS:
   - Inputs: ${c.inputOutputContract.inputs}
   - Outputs: ${c.inputOutputContract.outputs}
   - Complexity: Time ${c.complexity.time}, Space ${c.complexity.space}
   - Assumptions: ${c.complexity.assumptions.join('; ')}

3. CORRECTNESS INVARIANTS:
${c.preconditionsAndInvariants.map((inv) => `   * ${inv}`).join('\n')}

4. EDGE CASES TO HANDLE EXPLICITLY:
${c.edgeCases.map((ec) => `   * ${ec}`).join('\n')}

5. SELECTED APPROACH & RATIONALE:
   - Approach: ${c.selectedAlgorithm}
   - Chosen because: ${c.candidateAlgorithms.find((a) => a.isChosen)?.rationale || 'Optimal constraint fit'}

6. IMPLEMENTATION RULES:
   - ZERO PLACEHOLDERS: Implement complete runnable logic. Never write "// TODO" or stub returns.
   - DEFENSIVE BOUNDARIES: Validate empty, null, singleton, and extreme inputs at the function entry.
   - INDEPENDENT VERIFICATION: Include executable tests addressing the falsification suite:
${c.falsificationTests.map((ft) => `     - ${ft}`).join('\n')}
`;
}

/**
 * Validates task plan structure, dependencies, duplicate IDs, and file conflicts deterministically.
 */
function validateTaskPlanSchema(tasks, options = {}) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(tasks)) {
    return {
      valid: false,
      errors: ['Tasks must be an array'],
      warnings: [],
      sortedTaskIds: []
    };
  }

  const taskIds = new Set();
  const taskMap = new Map();
  const fileOwnership = new Map(); // filePath -> taskId

  // Pass 1: Validate individual task shapes and detect duplicates
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      errors.push(`Task at index ${i} must be a valid object`);
      continue;
    }

    const id = String(task.id || '').trim();
    if (!id) {
      errors.push(`Task at index ${i} is missing mandatory 'id' field`);
      continue;
    }

    if (taskIds.has(id)) {
      errors.push(`Duplicate task ID: "${id}"`);
      continue;
    }

    taskIds.add(id);
    taskMap.set(id, task);

    const title = String(task.title || task.description || task.goal || task.objective || '').trim();
    if (!title) {
      errors.push(`Task "${id}" is missing mandatory description or title`);
    }

    const role = String(task.role || task.specialty || '').trim();
    if (!role && !task.tool) {
      warnings.push(`Task "${id}" has neither role nor tool specified`);
    }

    // Check file assignments if specified
    const assignedFiles = Array.isArray(task.files)
      ? task.files
      : (typeof task.file === 'string' ? [task.file] : (task.input?.path ? [task.input.path] : []));

    for (const file of assignedFiles) {
      const normFile = String(file).replace(/\\/g, '/').trim();
      if (!normFile) continue;
      // If task has dependencies on the previous owner, that is a coordinated handover.
      // If tasks are independent/parallel and target the same file, flag collision.
      if (fileOwnership.has(normFile)) {
        const prevTaskId = fileOwnership.get(normFile);
        const deps = Array.isArray(task.dependsOn) ? task.dependsOn : (Array.isArray(task.dependencies) ? task.dependencies : []);
        if (!deps.includes(prevTaskId)) {
          errors.push(`Uncoordinated concurrent file write conflict on "${normFile}" between tasks "${prevTaskId}" and "${id}" without explicit dependency order`);
        }
      }
      fileOwnership.set(normFile, id);
    }
  }

  // Pass 2: Dependency validation and cycle detection
  const adjList = new Map();
  const inDegree = new Map();
  for (const id of taskIds) {
    adjList.set(id, []);
    inDegree.set(id, 0);
  }

  for (const [id, task] of taskMap.entries()) {
    const deps = Array.isArray(task.dependsOn) ? task.dependsOn : (Array.isArray(task.dependencies) ? task.dependencies : []);
    for (const depId of deps) {
      const normDep = String(depId).trim();
      if (normDep === id) {
        errors.push(`Task "${id}" cannot depend on itself (self-dependency)`);
        continue;
      }
      if (!taskIds.has(normDep)) {
        errors.push(`Task "${id}" references unknown dependency "${normDep}"`);
        continue;
      }
      adjList.get(normDep).push(id);
      inDegree.set(id, (inDegree.get(id) || 0) + 1);
    }
  }

  // Topological sort via Kahn's algorithm
  const queue = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const sortedTaskIds = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    sortedTaskIds.push(curr);
    for (const neighbor of adjList.get(curr) || []) {
      const nextDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, nextDeg);
      if (nextDeg === 0) queue.push(neighbor);
    }
  }

  if (sortedTaskIds.length < taskIds.size && taskIds.size > 0) {
    // Cycle detected
    const cyclicNodes = Array.from(taskIds).filter((id) => (inDegree.get(id) || 0) > 0);
    errors.push(`Cyclic dependency detected among tasks: ${cyclicNodes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sortedTaskIds: errors.length === 0 ? sortedTaskIds : []
  };
}

/**
 * Execution verification evaluator for algorithms.
 * An algorithm is ONLY verified if genuine executable evidence passed.
 */
function evaluateAlgorithmVerification(executionResult) {
  if (!executionResult) {
    return {
      verified: false,
      status: 'UNVERIFIED',
      testsRun: 0,
      testsPassed: 0,
      durationMs: 0,
      reason: 'No execution evidence provided'
    };
  }

  const testsRun = typeof executionResult.testsRun === 'number' ? executionResult.testsRun : (executionResult.testsPassed || 0);
  const testsPassed = typeof executionResult.testsPassed === 'number' ? executionResult.testsPassed : 0;
  const durationMs = typeof executionResult.durationMs === 'number' ? executionResult.durationMs : 0;

  // Real passing evidence requires testsRun > 0, testsPassed === testsRun, and success status
  const successStatus = executionResult.status === 'SUCCESS' || executionResult.status === 'PASSED';
  if (successStatus && testsRun > 0 && testsPassed === testsRun) {
    return {
      verified: true,
      status: 'VERIFIED',
      testsRun,
      testsPassed,
      durationMs,
      reason: `All ${testsPassed} independent automated tests and assertions passed`
    };
  }

  return {
    verified: false,
    status: executionResult.status || 'FAILED',
    testsRun,
    testsPassed,
    durationMs,
    reason: executionResult.error || executionResult.stderr || `Tests did not confirm correctness (${testsPassed}/${testsRun} passed)`
  };
}

module.exports = {
  // Existing exports
  analyzeCodeGenerationRequest,
  formatCodeGenerationStrategy,
  detectWorkspaceStack,
  detectFrameworkFromFiles,
  // Advanced Code Intelligence exports
  ALGORITHM_FAMILIES,
  registerAlgorithmFamily,
  classifyRequest,
  deriveAlgorithmTaskContract,
  buildAlgorithmGuidanceBlock,
  validateTaskPlanSchema,
  evaluateAlgorithmVerification,
};
