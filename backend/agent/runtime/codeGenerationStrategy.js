'use strict';

const { resolveCanonicalCase, CANONICAL_CASE_IDS } = require('../../quality-evaluation/canonicalCaseResolver');

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
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
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

function detectFrameworkFromPackageJson(files) {
  for (const fileName of ['frontend/package.json', 'web/package.json', 'package.json']) {
    const source = files[fileName];
    if (typeof source !== 'string') continue;
    try {
      const pkg = JSON.parse(source);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [packageName, framework] of FRAMEWORK_PACKAGE_MAP) {
        if (Object.hasOwn(deps, packageName)) return framework;
      }
    } catch (_) {
      // Ignored: an unreadable package manifest must not block code generation.
    }
  }
  return null;
}

function detectFrameworkFromFiles(context = {}) {
  const files = context?.files && typeof context.files === 'object' ? context.files : null;
  if (!files) return null;
  const pkgFramework = detectFrameworkFromPackageJson(files);
  if (pkgFramework) return pkgFramework;

  // Config files are lower-confidence hints; Vite alone is not a UI framework.
  const names = Object.keys(files).map((name) => name.replaceAll('\\', '/'));
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
    rules.push(
      'For graph problems, make directedness, weights, disconnected vertices, and negative-edge constraints explicit.',
      'Choose BFS for unweighted shortest paths, Dijkstra only for non-negative edge weights, Bellman-Ford when negative edges are allowed, and detect negative cycles when relevant.'
    );
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

  let complexity = 'low';
  if (isAlgorithmic || isSecuritySensitive || isFullStack) {
    complexity = 'high';
  } else if (isUi || isModification) {
    complexity = 'medium';
  }

  const baseArchitectureRules = [
    'Honor explicit framework/language requests; otherwise inspect the existing workspace and preserve its stack and conventions.',
    'For a new project, choose the smallest supported architecture that satisfies the explicit requirements; do not add dependencies without a concrete need.',
    'Separate domain/business logic from UI, persistence, and network I/O when the scope warrants it.',
    'Use real event handlers and data flow for interactive features; do not substitute decorative controls or fake integrations.',
    'Preserve unrelated working code and prefer small, reviewable edits when modifying an existing project.',
  ];

  const uiArchitectureRules = (isUi || isFullStack)
    ? [
        'Design System & Visual Hierarchy: Define a cohesive color palette (primary, secondary, surface, background, border, text, muted), consistent typography scale, and responsive layout wrappers (mobile, tablet, desktop).',
        'Component Decomposition: Structure applications into modular, cohesive components (Header/Navigation, Feature Views, Reusable Form/UI Controls, Modals/Toasts) rather than monolithic single files.',
        'Component Contract & Import/Export Consistency: Every imported component, hook, utility, or icon must be exported by its source module with matching export semantics (default vs. named export). Never use named import `import { X }` for default exported `export default X`.',
        'Real Functional Interactivity: Every button, input, tab, filter, and modal must be wired with real reactive state and handlers; never leave decorative dead buttons, empty stubs, or alert() popups.',
        'View State Completeness: Explicitly implement loading states (skeleton or spinner), empty states (informative icon/text + primary call to action), error recovery states, and data-loaded states.',
        'Persistence & Data Flow: For client-only applications, use browser storage (e.g. localStorage / IndexedDB) with robust JSON serialization, seed fallback, and error handling so state survives refreshes. For API- or database-backed applications, use their actual backend persistence architecture (Express endpoints, database models, or ORM migrations); never substitute client localStorage or mock in-memory arrays when real backend storage is required.',
        'Accessibility & Semantics: Use semantic HTML (button, nav, header, main, dialog), proper label associations (htmlFor/id), and keyboard navigation support (Enter/Escape).',
      ]
    : [];

  const architectureRules = [...baseArchitectureRules, ...uiArchitectureRules];

  const algorithmRules = isAlgorithmic
    ? [
        'Restate the problem as inputs, outputs, constraints, and invariants before selecting an algorithm.',
        'Optimal Data Structures & Invariants: Select the optimal data structure (e.g. HashMap for O(1) lookups, Heap/PriorityQueue for top-K/stream order, Monotonic Stack for next-greater, Two Pointers/Sliding Window for linear scan) and maintain invariants strictly.',
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
      policy: (function getStackPolicy() {
        if (explicitFramework || explicitLanguage) {
          return 'Honor the explicitly requested stack unless technically incompatible; explain any blocker.';
        }
        if (workspaceStack) {
          return 'Preserve the detected workspace stack; do not migrate frameworks without explicit authorization.';
        }
        return 'Choose a well-supported, minimal stack from requirements and available tools.';
      })(),
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
  if (!def?.id || !def?.name) {
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
  matcher: (text) => /(?<!(?:full|tech|mern|mean)[ -])\b(stack|queue|deque|monotonic stack|monotonic queue|next greater element|valid parentheses|min stack|sliding window maximum)\b/i.test(text),
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

// 13. Backtracking & Combinatorial Search
registerAlgorithmFamily({
  id: 'backtracking',
  name: 'Backtracking, Recursion & Combinatorial Search',
  matcher: (text) => /\b(backtrack|backtracking|n-queens|sudoku|permutations|combinations|subset sum|word search|combination sum|generate parentheses)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isConstraintSatisfaction) {
      return { algorithm: 'Constraint Propagation with Backtracking Search', rationale: 'Forward checking and bitmask pruning prune invalid search subtrees early' };
    }
    if (constraints.isDeduplicated) {
      return { algorithm: 'Sorted Index-Bounded Backtracking', rationale: 'Sorts elements initially and skips adjacent identical choices to prevent duplicate branches' };
    }
    return { algorithm: 'Recursive State Space Traversal (Choose-Explore-Unchoose)', rationale: 'Maintains state invariant by undoing mutations upon backtrack returning to caller' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(B^D) or O(N!) factorial worst-case bounded by pruning factor',
    space: 'O(D) call stack where D is maximum recursion depth',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Pruning branches as early as invariants are violated', 'In-place state mutation with symmetric undo']
  }),
  invariants: [
    'State restoration: state after returning from a recursive exploration exactly matches state before the call',
    'Depth bound: recursion depth never exceeds problem domain bound D (prevents stack overflow)'
  ],
  edgeCases: [
    'empty input candidates',
    'target sum = 0 or k = 0',
    'no valid configuration exists (must return empty result safely)',
    'all elements identical in candidate set',
    'recursion depth exceeding safe call stack'
  ]
});

// 14. Range Queries & Advanced Data Structures
registerAlgorithmFamily({
  id: 'range_queries',
  name: 'Range Queries, Segment Trees & Fenwick Trees',
  matcher: (text) => /\b(segment tree|fenwick tree|binary indexed tree|bit|sparse table|range minimum query|rmq|range sum query|lazy propagation)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isStaticRMQ) {
      return { algorithm: 'Sparse Table (ST)', rationale: 'O(N log N) preprocessing allows O(1) idempotent range minimum/maximum queries' };
    }
    if (constraints.hasRangeUpdates) {
      return { algorithm: 'Segment Tree with Lazy Propagation', rationale: 'Deferred updates preserve O(log N) both for range updates and range queries' };
    }
    return { algorithm: 'Fenwick Tree (Binary Indexed Tree)', rationale: 'Lowest Set Bit indexing (i & -i) delivers O(log N) point updates and prefix sums with minimal memory' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(log N) per query/update, O(N) build time',
    space: 'O(N) for BIT or O(4N) for Segment Tree',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['0-indexed or 1-indexed conversion handled consistently', 'Associative merge operation']
  }),
  invariants: [
    'Index bound: queries [L, R] strictly enforce 0 <= L <= R < N',
    'Tree coverage: union of segment tree node intervals at each layer partitions the active range'
  ],
  edgeCases: [
    'range query on single element [i, i]',
    'range encompassing entire array [0, N-1]',
    'updating boundary elements at index 0 or N-1',
    'empty array or range L > R',
    'large updates causing 32-bit integer overflow'
  ]
});

// 15. Greedy Algorithms & Interval Scheduling
registerAlgorithmFamily({
  id: 'greedy',
  name: 'Greedy Algorithms & Interval Scheduling',
  matcher: (text) => /\b(greedy|interval scheduling|merge intervals|insert interval|non-overlapping intervals|fractional knapsack|gas station|jump game|huffman)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isInterval) {
      return { algorithm: 'Interval Sorting by End Time (Earliest Deadline First)', rationale: 'Greedy choice property proves earliest finishing interval leaves maximum room for subsequent intervals' };
    }
    if (constraints.isReachability) {
      return { algorithm: 'Greedy Farthest Reach Window Tracking', rationale: 'Maintains maximum reachable index per step in single pass O(N) time with O(1) auxiliary space' };
    }
    return { algorithm: 'Locally Optimal Choice Greedy Strategy', rationale: 'Proven matroid or optimal substructure guarantees global optimum from sequence of local decisions' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(N log N) if sorting required, otherwise O(N) single-pass',
    space: 'O(1) auxiliary space or O(N) for output collection',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Greedy choice property holds mathematically for the problem']
  }),
  invariants: [
    'Monotonic progression: decisions never backtrack; candidate intervals processed in monotonic order',
    'Feasibility invariant: each chosen element maintains global feasibility with previously selected elements'
  ],
  edgeCases: [
    'empty interval list',
    'single interval input',
    'all intervals completely overlapping',
    'no intervals overlapping (already disjoint)',
    'intervals with identical start and end points [x, x]'
  ]
});

// 16. Concurrency, Streaming & Reactive Pipelines
registerAlgorithmFamily({
  id: 'concurrency_streaming',
  name: 'Concurrency, Streaming & Bounded Queue Processing',
  matcher: (text) => /\b(concurrency|debounce|throttle|worker pool|thread pool|event emitter|pub sub|reactive stream|backpressure|leaky bucket|bounded queue)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isDebounceThrottle) {
      return { algorithm: 'Timer-Cancelled Trailing/Leading Edge Debounce', rationale: 'Clears active timer handles and guarantees at most one execution per quiet interval' };
    }
    if (constraints.isWorkerPool) {
      return { algorithm: 'Bounded Task Queue with Concurrency Semaphore', rationale: 'Limits active asynchronous tasks to maximum concurrency N to prevent resource exhaustion' };
    }
    return { algorithm: 'Asynchronous Bounded Pipeline with Backpressure', rationale: 'Pauses producer when consumer buffer exceeds high-water mark' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(1) per task dispatch / event emission',
    space: 'O(Max Buffer Size)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Clean timer teardown and unref on termination', 'No memory leaks from uncleaned listeners']
  }),
  invariants: [
    'Concurrency ceiling: number of running concurrent tasks <= maxConcurrency at all times',
    'Resource cleanup: all timer handles and listener subscriptions can be disposed via cleanup function'
  ],
  edgeCases: [
    'rapid burst of events exceeding buffer limits',
    'unhandled error in async worker should not crash pool',
    'cancelling in-flight operations gracefully',
    'concurrency limit = 1 (strict sequential execution)',
    'drain event fired only when all pending tasks conclude'
  ]
});

// 17. Numerical & Computational Geometry
registerAlgorithmFamily({
  id: 'numerical_geometry',
  name: 'Numerical Algorithms & Computational Geometry',
  matcher: (text) => /\b(gcd|lcm|sieve of eratosthenes|prime numbers|modular exponentiation|convex hull|point in polygon|cross product|line intersection)\b/i.test(text),
  selectAlgorithm: (constraints = {}) => {
    if (constraints.isConvexHull) {
      return { algorithm: "Monotone Chain / Graham's Scan", rationale: 'Sorts points and constructs upper/lower hulls using 2D cross product in O(N log N)' };
    }
    if (constraints.isModularExp) {
      return { algorithm: 'Binary Exponentiation (Fast Power)', rationale: 'Repeated squaring computes (base^exp) % mod in O(log exp) time' };
    }
    return { algorithm: 'Euclidean Algorithm / Sieve of Eratosthenes', rationale: 'Computes number theoretic functions with minimal operations' };
  },
  complexityAnalysis: (constraints = {}) => ({
    time: 'O(log N) for GCD/exponentiation, O(N log log N) for Sieve, O(N log N) for Geometry',
    space: 'O(1) or O(N)',
    isEstimate: !constraints.hasKnownBounds,
    assumptions: ['Floating-point epsilon checks used for geometry comparisons']
  }),
  invariants: [
    'Non-negativity: modulo invariants maintain positive residues 0 <= r < m',
    'Collinearity handling: cross product sign determines turn direction; zero cross product handles collinear points'
  ],
  edgeCases: [
    'zero arguments in GCD / division by zero',
    'floating point precision errors (must use epsilon tolerance)',
    'degenerate geometries: all points collinear or <= 2 points',
    'negative bases and exponents',
    'primes under 2'
  ]
});

const PRIORITY_ALGORITHM_ORDER = [
  'graphs',
  'dynamic_programming',
  'backtracking',
  'range_queries',
  'greedy',
  'caching',
  'concurrency_streaming',
  'union_find',
  'string_matching',
  'numerical_geometry',
  'trees',
  'heaps',
  'linked_lists',
  'sorting_searching',
  'stacks_queues',
  'hashing',
  'arrays_strings'
];
const PRIORITY_ALGORITHM_SET = new Set(PRIORITY_ALGORITHM_ORDER);

/**
 * Classify a prompt into routine edit vs algorithmic vs application feature.
 */
function classifyRequest(request = '', context = {}) {
  const text = String(request || '').trim();
  const lower = text.toLowerCase();
  if (!text) return { kind: 'ROUTINE_EDIT', isRoutine: true, strategy: 'FAST_PATH', family: null };

  // Fast Path: Routine edits, typo fixes, simple UI tweaks, adding imports/props
  const isRoutine = (
    text.length < 80 &&
    /\b(typo|rename|change text|color|update|fix|button text|copyright|add prop|export|import|margin|padding|bg-|header text)\b/i.test(lower) &&
    !/\b(algorithm|sort|search|tree|graph|dp|cache|dijkstra|knapsack|lru|stack|queue|binary|complexity|big.?o|optimi[sz]|backtrack|segment tree|greedy|interval|stream)\b/i.test(lower)
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
  for (const id of PRIORITY_ALGORITHM_ORDER) {
    const fam = ALGORITHM_FAMILIES.get(id);
    if (fam?.matcher(lower)) {
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
    if (!PRIORITY_ALGORITHM_SET.has(id) && fam?.matcher(lower)) {
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
  const canonicalRes = resolveCanonicalCase(request, context?.files || {});
  return {
    kind: 'APPLICATION_FEATURE',
    category: 'APPLICATION_FEATURE',
    isRoutine: false,
    multiTask: true,
    strategy: 'STANDARD_ENGINEERING',
    family: null,
    familyName: null,
    canonicalCase: canonicalRes.canonicalCase,
    canonicalStatus: canonicalRes.status,
    canonicalReason: canonicalRes.reason
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
  const hasKnownBounds = /\b(?:\d+\s*(?:<=|<|to|-)\s*[nN]|[nN]\s*(?:<=|<|to|-)\s*\d+|1e\d|10\^\d)\b/.test(text);
  const isFixedWindow = /\b(fixed|window size|length k|size k)\b/i.test(text);
  const isRangeSum = /\b(range sum|prefix sum|cumulative sum)\b/i.test(text);
  const isMaxSubarray = /\b(maximum subarray|largest sum subarray|kadane)\b/i.test(text);
  const isUnweighted = /\b(unweighted|unit weights|fewest hops|breadth first|bfs)\b/i.test(text);
  const hasNegativeWeights = /\b(negative weight|negative edge|bellman)\b/i.test(text);
  const isDAG = /\b(dag|directed acyclic|topological|dependencies)\b/i.test(text);
  const requiresStability = /\b(stable|preserve order|tie.?breaking)\b/i.test(text);
  const isTopK = /\b(top.?k|kth largest|kth smallest)\b/i.test(text);
  const isConstraintSatisfaction = /\b(n-queens|sudoku|constraint|exact cover)\b/i.test(text);
  const isDeduplicated = /\b(unique|deduplicate|no duplicates|distinct permutations)\b/i.test(text);
  const isStaticRMQ = /\b(static|immutable|rmq|range minimum query|sparse table)\b/i.test(text);
  const hasRangeUpdates = /\b(range update|lazy propagation|lazy|batch update)\b/i.test(text);
  const isInterval = /\b(interval|meeting rooms|merge intervals|non-overlapping)\b/i.test(text);
  const isReachability = /\b(jump game|reach|gas station)\b/i.test(text);
  const isDebounceThrottle = /\b(debounce|throttle|coalesce)\b/i.test(text);
  const isWorkerPool = /\b(worker pool|concurrency limit|thread pool|semaphore|rate limit)\b/i.test(text);
  const isConvexHull = /\b(convex hull|graham|monotone chain)\b/i.test(text);
  const isModularExp = /\b(modular exponentiation|fast power|power modulo)\b/i.test(text);

  const constraints = {
    hasKnownBounds,
    isFixedWindow,
    isRangeSum,
    isMaxSubarray,
    isUnweighted,
    hasNegativeWeights,
    isDAG,
    requiresStability,
    isTopK,
    isConstraintSatisfaction,
    isDeduplicated,
    isStaticRMQ,
    hasRangeUpdates,
    isInterval,
    isReachability,
    isDebounceThrottle,
    isWorkerPool,
    isConvexHull,
    isModularExp
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
 * Emits the comprehensive 9-stage structured algorithm reasoning pipeline.
 */
function buildAlgorithmGuidanceBlock(spec) {
  if (!spec?.specificationNeeded || !spec?.contract) return '';

  const c = spec.contract;
  return `
[STRUCTURED ALGORITHM REASONING PIPELINE: ${spec.familyName.toUpperCase()}]
Follow these 9 rigorous engineering stages to construct the solution:

STAGE 1: PROBLEM FORMALIZATION
- Problem Statement: ${c.problemStatement}
- Inputs: ${c.inputOutputContract.inputs}
- Outputs: ${c.inputOutputContract.outputs}
- Domain Invariants: ${c.preconditionsAndInvariants.join('; ')}

STAGE 2: CONSTRAINT ANALYSIS & COMPLEXITY BUDGETS
- Data Constraints: ${c.inputOutputContract.dataConstraints}
- Target Time Complexity: ${c.complexity.time}
- Target Space Complexity: ${c.complexity.space}
- Computational Assumptions: ${c.complexity.assumptions.join('; ')}

STAGE 3: ALGORITHM CANDIDATE SELECTION & TRADEOFFS
${c.candidateAlgorithms.map((cand) => `  * [${cand.isChosen ? 'SELECTED' : 'REJECTED'}] ${cand.approach}: ${cand.rationale} (Tradeoff: ${cand.tradeOffs})`).join('\n')}

STAGE 4: CORRECTNESS REASONING & INVARIANTS
${c.preconditionsAndInvariants.map((inv) => `  * Invariant: ${inv}`).join('\n')}

STAGE 5: COMPLEXITY ANALYSIS
- Time: ${c.complexity.time}
- Space: ${c.complexity.space}
- Bounded Memory: Avoid duplicate allocations and recursion depths exceeding call stack limits.

STAGE 6: MULTI-LANGUAGE IMPLEMENTATION STRATEGY
- Follow idiomatic conventions of the active language.
- Zero external package dependencies unless explicitly configured in project.
- Expose clear, typed function signatures with deterministic return values.

STAGE 7: EDGE-CASE & BOUNDARY INVENTORY
Explicitly handle and test every condition:
${c.edgeCases.map((ec) => `  * ${ec}`).join('\n')}

STAGE 8: CODE REVIEW & REFINEMENT GUARDRAILS
- ZERO PLACEHOLDERS: Implement complete runnable logic. Never output "// TODO", "// implement here", or stub responses.
- NO SWALLOWED EXCEPTIONS: Never catch errors silently without reporting or handling.
- RESOURCE INTEGRITY: Ensure memory, file handles, timers, and worker subscriptions are properly released.

STAGE 9: VERIFIED OUTPUT & FALSIFICATION SUITE
Include runnable unit tests covering the falsification suite:
${c.falsificationTests.map((ft) => `  * ${ft}`).join('\n')}
`;
}

function getTaskAssignedFiles(task) {
  if (Array.isArray(task.files)) return task.files;
  if (typeof task.file === 'string') return [task.file];
  if (task.input?.path) return [task.input.path];
  return [];
}

function getTaskDependencies(task) {
  if (Array.isArray(task.dependsOn)) return task.dependsOn;
  if (Array.isArray(task.dependencies)) return task.dependencies;
  return [];
}

function validateTaskEntry(task, index, taskIds, taskMap, fileOwnership, errors, warnings) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    errors.push(`Task at index ${index} must be a valid object`);
    return;
  }

  const id = String(task.id || '').trim();
  if (!id) {
    errors.push(`Task at index ${index} is missing mandatory 'id' field`);
    return;
  }

  if (taskIds.has(id)) {
    errors.push(`Duplicate task ID: "${id}"`);
    return;
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

  const assignedFiles = getTaskAssignedFiles(task);
  for (const file of assignedFiles) {
    const normFile = String(file).replaceAll('\\', '/').trim();
    if (!normFile) continue;
    if (fileOwnership.has(normFile)) {
      const prevTaskId = fileOwnership.get(normFile);
      const deps = getTaskDependencies(task);
      if (!deps.includes(prevTaskId)) {
        errors.push(`Uncoordinated concurrent file write conflict on "${normFile}" between tasks "${prevTaskId}" and "${id}" without explicit dependency order`);
      }
    }
    fileOwnership.set(normFile, id);
  }
}

function buildTaskDependencyGraph(taskMap, taskIds, errors) {
  const adjList = new Map();
  const inDegree = new Map();
  for (const id of taskIds) {
    adjList.set(id, []);
    inDegree.set(id, 0);
  }

  for (const [id, task] of taskMap.entries()) {
    const deps = getTaskDependencies(task);
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
  return { adjList, inDegree };
}

function sortTasksKahn(adjList, inDegree, taskIds, errors) {
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
    const cyclicNodes = Array.from(taskIds).filter((id) => (inDegree.get(id) || 0) > 0);
    errors.push(`Cyclic dependency detected among tasks: ${cyclicNodes.join(', ')}`);
  }
  return sortedTaskIds;
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

  for (let i = 0; i < tasks.length; i++) {
    validateTaskEntry(tasks[i], i, taskIds, taskMap, fileOwnership, errors, warnings);
  }

  const { adjList, inDegree } = buildTaskDependencyGraph(taskMap, taskIds, errors);
  const sortedTaskIds = sortTasksKahn(adjList, inDegree, taskIds, errors);

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

// =============================================================================
// ADVANCED PRODUCT ENGINEERING: Application Archetypes & Design System Engine
// =============================================================================

const APPLICATION_ARCHETYPES = new Map();

function registerApplicationArchetype(def) {
  if (!def?.id || !def?.name) {
    throw new Error('Application archetype definition must include id and name');
  }
  APPLICATION_ARCHETYPES.set(def.id, def);
}

// 1. Dashboard & Analytics Platform
registerApplicationArchetype({
  id: 'dashboard_analytics',
  name: 'Dashboard & Analytics Platform',
  matcher: (text) => /\b(dashboard|analytics|metrics|kpi|charts?|stats|monitoring|overview|reporting)\b|डैशबोर्ड|एनालिटिक्स/i.test(text),
  components: [
    'HeaderWithUserNav',
    'MetricsOverviewGrid',
    'MetricCard',
    'ChartVisualSection',
    'FilterableDataTable',
    'ActivityFeed'
  ],
  sampleEntities: 'KPI stats (revenue, active users, conversion rate, churn), timeline events, data records',
  storageKey: 'aidost_analytics_dashboard_data',
  defaultViewStates: {
    loading: 'MetricCardSkeleton and TableRowSkeleton with aria-busy',
    empty: 'No activity found for selected date range; includes reset filter action',
    error: 'Failed to fetch analytics metrics; includes retry button'
  }
});

// 2. E-Commerce Storefront & Catalog
registerApplicationArchetype({
  id: 'ecommerce_store',
  name: 'E-Commerce Storefront & Catalog',
  matcher: (text) => /\b(e-?commerce|store|shop|cart|catalog|products?|checkout|inventory)\b|दुकान|स्टोर|शॉप/i.test(text),
  components: [
    'NavbarWithCartBadge',
    'ProductCatalogGrid',
    'ProductCard',
    'CategoryFilterSidebar',
    'CartDrawer',
    'CheckoutModal'
  ],
  sampleEntities: 'Products (id, name, price, rating, category, stock, image, description), Cart items (productId, qty)',
  storageKey: 'aidost_ecommerce_cart_items',
  defaultViewStates: {
    loading: 'ProductCardSkeleton grid with pulsating placeholders',
    empty: 'Your shopping cart is empty; includes Browse Products button',
    error: 'Unable to load catalog products; includes reload action'
  }
});

// 3. Productivity & Kanban / Task Board
registerApplicationArchetype({
  id: 'productivity_kanban',
  name: 'Productivity & Kanban Task Board',
  matcher: (text) => /\b(kanban|todo|todos|tasks?|productivity|notes?|board|trello|project management|workflow)\b|टास्क|टू-डू|नोट्स/i.test(text),
  components: [
    'TaskHeader',
    'KanbanBoard',
    'KanbanColumn',
    'TaskCard',
    'CreateEditTaskModal',
    'FilterToolbar'
  ],
  sampleEntities: 'Tasks (id, title, description, status [todo/in_progress/done], priority [low/medium/high], dueDate, createdAt)',
  storageKey: 'aidost_kanban_board_tasks',
  defaultViewStates: {
    loading: 'ColumnSkeleton with ghost task cards',
    empty: 'No tasks in this column; includes Add Task button',
    error: 'Failed to save task update; includes undo and retry buttons'
  }
});

// 4. Admin Portal & CRUD Data Table
registerApplicationArchetype({
  id: 'admin_crud_table',
  name: 'Admin Portal & Data Management Table',
  matcher: (text) => /\b(admin|crud|users? management|management portal|table|directory|records?|portal)\b|मैनेजमेंट|टेबल|एडमिन/i.test(text),
  components: [
    'AdminHeader',
    'DataTable',
    'TableHeaderCell',
    'TableRowActions',
    'RecordFormModal',
    'DeleteConfirmationModal',
    'PaginationBar'
  ],
  sampleEntities: 'Records (id, name, email/code, category/role, status [active/inactive/pending], createdAt, lastModified)',
  storageKey: 'aidost_admin_crud_records',
  defaultViewStates: {
    loading: 'TableSkeleton rows with pulsing cells',
    empty: 'No records found matching query; includes Clear Search and Create New buttons',
    error: 'Failed to execute data mutation; includes dismissible error banner'
  }
});

// 5. Portfolio & Showcase / Landing Page
registerApplicationArchetype({
  id: 'portfolio_showcase',
  name: 'Portfolio, Landing Page & Showcase',
  matcher: (text) => /\b(portfolio|showcase|landing page|resume|cv|personal site|agency|product page)\b|पोर्टफोलियो|लैंडिंग पेज/i.test(text),
  components: [
    'NavigationHeader',
    'HeroSection',
    'FeatureGrid',
    'ProjectShowcaseGallery',
    'ProjectCard',
    'ContactSection',
    'Footer'
  ],
  sampleEntities: 'Projects (id, title, description, tags, link), Testimonials, Contact inquiries',
  storageKey: 'aidost_portfolio_inquiries',
  defaultViewStates: {
    loading: 'SectionSkeleton with layout placeholders',
    empty: 'No projects found in this category; includes View All button',
    error: 'Message delivery failed; includes retry button'
  }
});

// 6. General Interactive Application (Fallback)
registerApplicationArchetype({
  id: 'general_app',
  name: 'Interactive Application',
  matcher: () => true,
  components: [
    'AppHeader',
    'MainContainer',
    'InteractiveControlsBar',
    'ContentDisplaySection',
    'ActionModal',
    'ToastContainer'
  ],
  sampleEntities: 'App items (id, title, details, timestamp, status)',
  storageKey: 'aidost_app_general_state',
  defaultViewStates: {
    loading: 'ContentSkeleton with shimmer animation',
    empty: 'No items created yet; includes Create First Item button',
    error: 'An unexpected error occurred; includes Reload button'
  }
});

/**
 * Derives an explicit, validated application contract for UI and full-stack software requests.
 */
function deriveApplicationTaskContract(request, classification = null, context = {}) {
  const text = String(request || '').trim();
  const lower = text.toLowerCase();

  let selectedArchetype = APPLICATION_ARCHETYPES.get('general_app');
  for (const [id, def] of APPLICATION_ARCHETYPES.entries()) {
    if (id !== 'general_app' && def.matcher(lower)) {
      selectedArchetype = def;
      break;
    }
  }

  const isDarkMode = /\b(dark\s*mode|dark\s*theme|dark)\b/i.test(lower);
  const colorPalette = {
    primary: '#4f46e5',
    secondary: '#06b6d4',
    accent: '#f59e0b',
    success: '#10b981',
    danger: '#ef4444',
    surface: isDarkMode ? '#1e293b' : '#ffffff',
    background: isDarkMode ? '#0f172a' : '#f8fafc',
    text: isDarkMode ? '#f8fafc' : '#0f172a',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#334155' : '#e2e8f0',
  };

  const isBackendBacked = /\b(backend|api|server|express|database|db|sql|sqlite|postgres(?:ql)?|mongodb|prisma|knex|full.?stack)\b/i.test(lower);
  const persistenceDescription = isBackendBacked
    ? 'Implement backend API and database persistence architecture'
    : 'Implement client-side persistence (localStorage/IndexedDB) with seed data fallback';

  const tasks = [
    {
      id: 'task-1',
      specialty: isBackendBacked ? 'backend' : 'frontend',
      role: 'CODER',
      objective: isBackendBacked
        ? `Implement modular architecture, schema models, API endpoints, and database persistence for ${selectedArchetype.name}: "${request}". Create backend/storage layer and essential UI primitives.`
        : `Implement modular architecture, design system tokens, and storage persistence for ${selectedArchetype.name}: "${request}". Create reusable UI primitives and browser storage manager (localStorage).`,
      dependsOn: [],
      requirements: ['REQ-APP-01', 'REQ-APP-02'],
      expectedOutput: isBackendBacked
        ? 'Clean modular component structure, database models/API routes, and backend persistence architecture.'
        : 'Clean modular component structure, design system styles, and storage persistence service.'
    },
    {
      id: 'task-2',
      specialty: 'integration',
      role: 'CODER',
      objective: `Integrate interactive views, state management, search/filter controls, and modals for ${selectedArchetype.name}: "${request}". Wire all buttons, forms, and handle empty/loading/error states.`,
      dependsOn: ['task-1'],
      requirements: ['REQ-APP-03', 'REQ-APP-04'],
      expectedOutput: 'Fully interactive application with active handlers, modals, search/filtering, and complete states.'
    },
    {
      id: 'task-3',
      specialty: 'testing',
      role: 'VERIFIER',
      objective: `Verify the completed implementation for: "${request}". Inspect workspace files, verify cross-file contracts, and validate usability.`,
      dependsOn: ['task-2'],
      requirements: ['REQ-APP-05'],
      expectedOutput: 'Verification evidence confirming complete implementation, working imports, and zero stubs.'
    }
  ];

  return {
    strategy: 'STRUCTURED_APPLICATION_SPEC',
    archetype: selectedArchetype.id,
    archetypeName: selectedArchetype.name,
    isBackendBacked,
    components: selectedArchetype.components,
    colorPalette,
    storageKey: selectedArchetype.storageKey,
    sampleEntities: selectedArchetype.sampleEntities,
    defaultViewStates: selectedArchetype.defaultViewStates,
    requirements: [
      { id: 'REQ-APP-01', description: 'Decompose into modular components with clean imports and exports' },
      { id: 'REQ-APP-02', description: persistenceDescription },
      { id: 'REQ-APP-03', description: 'Ensure all buttons, inputs, filters, and modals have real functional state handlers' },
      { id: 'REQ-APP-04', description: 'Provide complete loading, empty, and error states for all data views' },
      { id: 'REQ-APP-05', description: 'Validate cross-component contracts and responsive styling' }
    ],
    tasks
  };
}

/**
 * Builds the application engineering instruction block to inject into agent/copilot prompts.
 */
function buildApplicationGuidanceBlock(spec) {
  if (!spec || spec.strategy !== 'STRUCTURED_APPLICATION_SPEC') return '';

  return `
[STRUCTURED APPLICATION ENGINEERING PIPELINE: ${spec.archetypeName.toUpperCase()}]
Follow these 8 rigorous engineering stages to construct the application:

STAGE 1: COMPONENT ARCHITECTURE & MODULAR DECOMPOSITION
- Never write a monolithic single-file application.
- Structure files cleanly:
  * Entry & Layout: src/App.jsx (or main entry), src/index.css (design tokens)
  * Components: src/components/ (e.g. ${spec.components.slice(0, 4).join(', ')})
  * Persistence: ${spec.isBackendBacked ? 'API/Database layer (server.js, routes/, db/) with real data models and endpoints' : `Storage Service: src/services/storage.js (browser storage with key "${spec.storageKey}")`}
- Ensure all component exports match imports across files.

STAGE 2: DESIGN SYSTEM & VISUAL POLISH
- Cohesive color palette with CSS variables or Tailwind classes:
  * Primary: ${spec.colorPalette.primary} | Accent: ${spec.colorPalette.accent} | Success: ${spec.colorPalette.success} | Danger: ${spec.colorPalette.danger}
  * Background: ${spec.colorPalette.background} | Surface: ${spec.colorPalette.surface} | Text: ${spec.colorPalette.text} | Border: ${spec.colorPalette.border}
  * Spacing & Borders: rounded-xl, subtle borders, shadow-sm to shadow-md, responsive flex/grid wrappers.
- Typography scale: clear visual hierarchy (H1 bold, H2 semibold, body text, muted captions).
- Responsive layouts: mobile-first flex/grid containers that adapt across mobile, tablet, and desktop breakpoints.

STAGE 3: REAL FUNCTIONAL INTERACTIVITY & ZERO-STUB CONTRACT
- ZERO STUBS: Every button, input, filter, and modal must have an operational handler.
- Form inputs must bind to state (value + onChange); forms must validate and submit.
- Search inputs must actively filter the displayed dataset in real time.
- Modals, drawers, and tabs must open, close, and switch views with real state.
- Never use alert() or empty () => {} placeholders for interactive controls.

STAGE 4: STATE MANAGEMENT & DATA FLOW
- Single source of truth for application state.
- Keep derived values (filtered items count, active filters, computed totals) computed on the fly.
- Avoid direct state mutation; use immutable updates (e.g. prev => [...prev, newItem]).

STAGE 5: APPLICATION PERSISTENCE ARCHITECTURE
- For client-only applications: Persist state in browser storage (localStorage or IndexedDB under "${spec.storageKey}") so user changes survive page refreshes. Provide initial realistic seed data when storage is empty (${spec.sampleEntities}). Handle JSON parse errors and quota limits gracefully.
- For API- or database-backed applications: Implement actual persistence through the application's backend architecture (REST/GraphQL API endpoints, database schema/models, SQLite/PostgreSQL/MongoDB repositories). Never pretend data is saved on the server if it only resides in client localStorage or in-memory arrays.

STAGE 6: VIEW STATES & ERROR HANDLING
- Loading state: ${spec.defaultViewStates.loading}.
- Empty state: ${spec.defaultViewStates.empty}.
- Error state: ${spec.defaultViewStates.error}.
- Success feedback: Provide toast notifications or status badges on operations (create, update, delete).

STAGE 7: ACCESSIBILITY & SECURITY HYGIENE
- Semantic HTML: Use <button>, <nav>, <header>, <main>, <section>, <dialog>.
- Form labels: Use <label htmlFor="..."> for all form fields.
- Keyboard support: Support Escape key to close modals, Enter to submit forms.
- Never commit plaintext API keys or credentials.

STAGE 8: VERIFICATION EVIDENCE & USABILITY ACCEPTANCE
- Verify all components render cleanly without console errors or unbalanced tags.
- Confirm all user interactions (add, edit, delete, filter, sort, modal toggle) work end-to-end.
`;
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
  resolveCanonicalCase,
  CANONICAL_CASE_IDS,
  deriveAlgorithmTaskContract,
  buildAlgorithmGuidanceBlock,
  validateTaskPlanSchema,
  evaluateAlgorithmVerification,
  // Product Engineering exports
  APPLICATION_ARCHETYPES,
  registerApplicationArchetype,
  deriveApplicationTaskContract,
  buildApplicationGuidanceBlock,
};
