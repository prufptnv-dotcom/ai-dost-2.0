'use strict';

/**
 * AI-Dost Code Generation Strategy & Algorithm Intelligence Engine
 * Provides structured problem analysis, contract derivation, candidate approach comparison,
 * complexity contracts, test generation, and verification gating.
 */

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

// ── Built-in Extensible Algorithm Families ───────────────────────────────────

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
  ALGORITHM_FAMILIES,
  registerAlgorithmFamily,
  classifyRequest,
  deriveAlgorithmSpecification,
  buildAlgorithmGuidanceBlock,
  evaluateAlgorithmVerification
};
