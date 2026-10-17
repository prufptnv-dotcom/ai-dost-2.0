'use strict';

const fs = require('fs');
const path = require('path');
const OpenAIService = require('../../services/openaiService');
const AgentCascadeAiService = require('./AgentCascadeAiService');
const AgentCoordinator = require('./AgentCoordinator');
const { ResultValidator } = require('./resultValidator');
const logger = require('../../logger');
const { validateCrossFileContracts, checkTaskFileCollisions } = require('./crossFileContractValidator');
const {
  analyzeCodeGenerationRequest,
  formatCodeGenerationStrategy,
  classifyRequest,
  deriveAlgorithmTaskContract,
  buildAlgorithmGuidanceBlock,
  validateTaskPlanSchema
} = require('./codeGenerationStrategy');
const { resolveCanonicalCase, CANONICAL_CASE_IDS } = require('../../quality-evaluation/canonicalCaseResolver');
const { AlgorithmVerifier } = require('../../quality-evaluation/algorithmVerifier');
const { GeneratedAppQualityGate, STATUS } = require('../../quality-evaluation/generatedAppQualityGate');
const { TrustedExecutionService } = require('../../quality-evaluation/trustedExecutionService');
const { getAcceptanceFlows } = require('../../quality-evaluation/canonicalAcceptanceFlows');
const { createWorkspaceSnapshot } = require('../../quality-evaluation/workspaceManifest');
const { inspectWorkspace, buildPromptDirective } = require('../../services/workspaceFrameworkIntelligence');
const { reviewProjectFiles } = require('../../services/codeReviewEngine');

// The planner decides the actual count. This is only a defensive ceiling against
// malformed or adversarial model output, not a workflow rule.
const MAX_TASKS = 32;
const MAX_WORKER_RETRIES = 1;
const ALLOWED_ROLES = new Set(['RESEARCHER', 'CODER', 'VERIFIER']);
const SPECIALTY_TO_ROLE = {
  requirements: 'RESEARCHER', research: 'RESEARCHER',
  frontend: 'CODER', backend: 'CODER', integration: 'CODER', data: 'CODER',
  testing: 'VERIFIER', verification: 'VERIFIER', visual_qa: 'VERIFIER',
  security: 'VERIFIER', browser_qa: 'VERIFIER', repair: 'CODER'
};

// P12.8 (E2E run #14): bounded workspace listing for the specialist planner.
// Pass 2 of run #14 regenerated the whole plan from scratch and burned its
// entire repair budget re-creating files that pass 1 had already written
// ("Create package.json" Ã—4 â†’ WRITE_FORBIDDEN â†’ hallucinated-SEARCH apply_diff).
// The planner knew files EXISTED (SURGICAL directive) but not WHICH ones.
function listExistingFilesBounded(root, max = 100) {
  const out = [];
  const skip = new Set(['node_modules', '.git', '.checkpoints']);
  const walk = (dir, depth) => {
    if (out.length >= max || depth > 6) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.isFile()) {
        out.push(path.relative(root, full).split(path.sep).join('/'));
        if (out.length >= max) return;
      }
    }
  };
  walk(root, 0);
  return out.sort();
}

// P12.9 (E2E run #15): knowing the file LIST was not enough â€” the specialist
// still baked SEARCH strings from imagination (31Ã— SEARCH-not-found; it
// assumed pretty-printed 2-space package.json while the file was SINGLE-LINE
// compact JSON). Give the planner the REAL bytes of the key small files so
// SEARCH is copied verbatim, not recalled. Bounded: priority names first,
// â‰¤6 files, â‰¤2600 chars each (truncated marker beyond), â‰¤9000 chars total.

function collectWorkspaceFilesBounded(rootDir) {
  if (!rootDir || !fs.existsSync(rootDir)) return {};
  try {
    const snapshot = createWorkspaceSnapshot(rootDir);
    return snapshot.files;
  } catch (err) {
    if (err && err.message && err.message.startsWith('MANIFEST_LIMIT_EXCEEDED')) {
      throw err;
    }
    return {};
  }
}

function extractAffectedFilesFromContractErrors(errors = []) {
  const affected = new Set();
  for (const err of errors) {
    const fileMatches = String(err).match(/['"]([^'"\s]+\.[a-zA-Z0-9]+)['"]/g);
    if (fileMatches) {
      for (const m of fileMatches) {
        const clean = m.replace(/['"]/g, '').trim();
        if (clean && !clean.startsWith('http') && !clean.includes(' ') && clean.includes('.')) {
          affected.add(clean);
        }
      }
    }
  }
  return Array.from(affected);
}

function detectSupportedAlgorithmOracle(request = '', files = {}) {
  const text = String(request).toLowerCase();
  const oracleMap = [
    { name: 'two_sum', pattern: /\b(two\s*sum|pair\s*sum)\b/i },
    { name: 'hash_map', pattern: /\b(hash\s*map|hashmap|myhashmap)\b/i },
    { name: 'binary_search', pattern: /\b(binary\s*search)\b/i },
    { name: 'valid_parentheses', pattern: /\b(valid\s*parenthes[ei]s|balanced\s*bracket|isvalidparentheses)\b/i },
    { name: 'linked_list_cycle', pattern: /\b(linked\s*list\s*cycle|detect\s*cycle|hascycle)\b/i },
    { name: 'bst_validation', pattern: /\b(bst\s*validation|validate\s*bst|isvalidbst)\b/i },
    { name: 'min_heap', pattern: /\b(min\s*heap|priority\s*queue)\b/i },
    { name: 'lru_cache', pattern: /\b(lru\s*cache|least\s*recently\s*used)\b/i },
    { name: 'merge_intervals', pattern: /\b(merge\s*intervals?)\b/i },
    { name: 'graph_bfs', pattern: /\b(graph\s*bfs|shortest\s*path.*bfs|breadth\s*first)\b/i },
    { name: 'climbing_stairs', pattern: /\b(climbing\s*stairs|climb\s*stairs)\b/i },
    { name: 'coin_change', pattern: /\b(coin\s*change|min\s*coins)\b/i },
    { name: 'trie', pattern: /\b(trie|prefix\s*tree)\b/i },
    { name: 'topological_sort', pattern: /\b(topological\s*sort|topo\s*sort|course\s*schedule)\b/i },
    { name: 'union_find', pattern: /\b(union\s*find|disjoint\s*set|\bdsu\b)\b/i },
    { name: 'string_matching', pattern: /\b(kmp|string\s*matching|strstr)\b/i },
    { name: 'subsets', pattern: /\b(subset|subsets|power\s*set)\b/i },
    { name: 'fenwick_tree', pattern: /\b(fenwick|binary\s*indexed\s*tree)\b/i },
    { name: 'bounded_queue', pattern: /\b(bounded\s*queue|task\s*queue)\b/i },
    { name: 'gcd_lcm', pattern: /\b(gcd|greatest\s*common\s*divisor|lcm)\b/i }
  ];

  for (const item of oracleMap) {
    if (item.pattern.test(text)) return item.name;
  }
  for (const [filePath, content] of Object.entries(files)) {
    for (const item of oracleMap) {
      if (filePath.toLowerCase().includes(item.name) || item.pattern.test(content)) {
        return item.name;
      }
    }
  }
  return null;
}

function extractCandidateCode(files = {}, oracleName = null) {
  const keys = Object.keys(files);
  const prioritized = keys.slice().sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower.includes('solution') && !bLower.includes('solution')) return -1;
    if (bLower.includes('solution') && !aLower.includes('solution')) return 1;
    if (oracleName && aLower.includes(oracleName)) return -1;
    if (oracleName && bLower.includes(oracleName)) return 1;
    return 0;
  });

  for (const key of prioritized) {
    if (/\.(jsx?|tsx?|mjs|cjs)$/i.test(key) && !key.includes('.test.') && !key.includes('.spec.')) {
      return files[key];
    }
  }
  for (const [key, content] of Object.entries(files)) {
    if (/\.(jsx?|tsx?|mjs|cjs)$/i.test(key)) return content;
  }
  return '';
}

function readKeyFileContents(diskPath, files) {
  const PRIORITY = [
    'package.json', 'frontend/package.json', 'web/package.json',
    'src/styles/global.css', 'src/index.css', 'src/App.jsx',
    'index.html', 'vite.config.js', 'next.config.js', 'next.config.mjs',
    'astro.config.mjs', 'nuxt.config.ts', 'svelte.config.js', 'src/main.jsx'
  ];
  const pick = [];
  for (const p of PRIORITY) if (files.includes(p) && pick.length < 7) pick.push(p);
  for (const p of files) {
    if (pick.length >= 7) break;
    if (!pick.includes(p) && /(^|\/)(package\.json|next\.config\.[^/]+|astro\.config\.[^/]+|nuxt\.config\.[^/]+|svelte\.config\.[^/]+)$/.test(p)) pick.push(p);
  }
  const out = {};
  let budget = 6000;
  for (const p of pick) {
    if (budget <= 0) break;
    try {
      const full = path.join(diskPath, p);
      const st = fs.statSync(full);
      if (!st.isFile() || st.size > 60000) continue;
      let c = fs.readFileSync(full, 'utf-8');
      if (c.length > 1500) c = `${c.slice(0, 1300)}\nâ€¦ [truncated â€” ${c.length} chars total â€” copy the REAL lines you need as SEARCH] â€¦`;
      out[p] = c;
      budget -= c.length;
    } catch (_) {}
  }
  return Object.keys(out).length ? out : null;
}

const DIRECTOR_PLANNER_PROMPT = `You are the AI-Dost Copilot Director/Boss. Convert ONE software outcome request into the minimum sufficient set of specialist tasks. 

CODE-FIRST IMPLEMENTATION RULE (MANDATORY):
When the user asks to build, create, or code an application, website, component, or feature (e.g. "website banao", "portfolio banao", "build app", "code likho"):
- The primary task MUST be code implementation (specialty: frontend or integration, role: CODER).
- The agent MUST immediately create or modify real executable code files (such as 'src/App.jsx', 'App.jsx', 'src/index.css', 'index.html', 'src/main.jsx').
- NEVER plan or create markdown blueprint files (such as 'docs/architecture.md', 'README.md', or design specs) when the user asked for an app, website, or code. The user expects runnable code, not markdown documentation!
- Write complete, beautiful, interactive, production-ready code with responsive styling and working components.

INCREMENTAL UPGRADE RULE: If the request is an upgrade, bug fix, or addition to an existing project, plan targeted surgical code edits directly to the affected files.

Decide the task count dynamically from the actual scope, dependencies, risk, affected files, and verification needs. 

Return ONLY JSON:
{"summary":"string","tasks":[{"id":"string","specialty":"frontend|backend|integration|data|testing|verification|visual_qa|security|browser_qa|repair|research|requirements","objective":"string","dependsOn":["task-id"],"expectedOutput":"string"}]}

Rules:
- Choose 1 to 32 tasks only when justified.
- For building websites/apps/UIs, task 1 MUST have specialty 'frontend' or 'integration' to write working code.
- Dependencies may reference any task id in the returned plan.
- For upgrades/fixes, target the affected subsystem; do not rebuild unrelated areas.
- Include testing, security, browser QA, or verification when the request/risk requires it.
- Runtime failures are automatically retried and repaired; use repair for explicit repair work too.
- Do not include human/manual task assignment.
- APP SPECIFICATION TRACEABILITY (when the request includes a validated AI-Dost App Specification):
  - Preserve every REQ-### identifier from the specification in at least one implementation task objective or expectedOutput; do not merge away or omit explicit requirements.
  - Map relevant AC-## acceptance checks to a dedicated verification/testing task or explicit output evidence. Do not state that checks passed before execution evidence exists.
  - For application UI tasks, include the specified design-system, responsive-width, accessibility, and functional-state requirements in implementation outputs.
  - Treat suggested pages/archetypes as optional guidance; only explicit user requirements are mandatory.
  - If a requirement is ambiguous or impossible with the available tools/configuration, state that as a blocker in the task expectedOutput instead of silently substituting a mock.`;

function escapeControlCharsInStrings(str) {
  let inStr = false;
  let esc = false;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' && !esc) {
      inStr = !inStr;
      out += c;
    } else if (inStr) {
      if (c === '\\') {
        esc = !esc;
        out += c;
      } else {
        esc = false;
        if (c === '\n') {
          out += '\n';
        } else if (c === '\r') {
          // ignore
        } else if (c === '\t') {
          out += '\\t';
        } else if (c.charCodeAt(0) < 32) {
          out += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
        } else {
          out += c;
        }
      }
    } else {
      esc = false;
      out += c;
    }
  }
  return out;
}

function extractJson(text) {
  let source = String(text || '').trim();
  source = source.replace(/^```(?:json)?\s*\n?/i, '');
  source = source.replace(/\n?```\s*$/i, '');
  source = source.trim();
  try {
    return JSON.parse(source);
  } catch (_) {}

  const sanitized = escapeControlCharsInStrings(source);
  try {
    return JSON.parse(sanitized);
  } catch (_) {}

  const start = sanitized.indexOf('{');
  const end = sanitized.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = sanitized.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch (_) {
      try {
        return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
      } catch (_) {}
    }
  }
  throw new Error('Director planner returned invalid JSON');
}

function fallbackPlan(request) {
  const strategy = analyzeCodeGenerationRequest(request);
  const text = String(request || '').toLowerCase();
  const classification = classifyRequest(request);

  if (classification.category === 'ALGORITHMIC_PROBLEM' || (strategy.intent.algorithmic && !strategy.intent.ui && !strategy.intent.fullStack)) {
    const contract = deriveAlgorithmTaskContract(request, classification);
    if (contract && contract.tasks && contract.tasks.length) {
      return {
        summary: 'Algorithm-focused fallback execution',
        contract,
        tasks: contract.tasks.map((t) => ({
          id: t.id,
          specialty: t.specialty || 'integration',
          role: SPECIALTY_TO_ROLE[t.specialty] || 'CODER',
          objective: t.objective,
          dependsOn: t.dependsOn || [],
          expectedOutput: t.expectedOutput || 'Evidence-backed verified implementation.',
          requirements: t.requirements || []
        }))
      };
    }
  }
  const complex = strategy.intent.fullStack || strategy.intent.securitySensitive || /\b(full|complete|entire|platform|app|application|website|dashboard|integrat|database|backend|frontend|deploy|production|security)\b/.test(text) || /à¤ªà¥‚à¤°à¤¾ à¤à¤ª|à¤à¤ª à¤¬à¤¨à¤¾à¤“|à¤µà¥‡à¤¬à¤¸à¤¾à¤‡à¤Ÿ à¤¬à¤¨à¤¾à¤“|à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡ à¤¬à¤¨à¤¾à¤“|à¤«à¥à¤².?à¤¸à¥à¤Ÿà¥ˆà¤•|à¤ªà¥à¤°à¥‹à¤œà¥‡à¤•à¥à¤Ÿ à¤¬à¤¨à¤¾à¤“|à¤¬à¥ˆà¤•.?à¤à¤‚à¤¡|à¤¡à¥‡à¤Ÿà¤¾à¤¬à¥‡à¤¸|à¤²à¥‰à¤—à¤¿à¤¨ à¤¸à¤¿à¤¸à¥à¤Ÿà¤®/i.test(String(request || ''));
  if (!complex) return {
    summary: 'Single-task adaptive execution',
    tasks: [{ id: 'task-1', specialty: strategy.intent.ui ? 'frontend' : 'integration', objective: `Implement working code for: ${request}`, dependsOn: [], expectedOutput: 'Working requested outcome with verification evidence.' }]
  };
  return {
    summary: 'Adaptive multi-specialist execution',
    tasks: [
      { id: 'task-1', specialty: strategy.intent.ui ? 'frontend' : 'backend', objective: `Implement complete working code for: ${request}`, dependsOn: [], expectedOutput: 'Working runnable source code files.' },
      { id: 'task-2', specialty: 'integration', objective: `Integrate and wire complete functionality for: ${request}`, dependsOn: ['task-1'], expectedOutput: 'Implemented outcome in affected subsystem(s).' },
      { id: 'task-3', specialty: 'testing', objective: `Test the completed implementation for: ${request}`, dependsOn: ['task-2'], expectedOutput: 'Test/build/runtime evidence and actionable failures.' }
    ]
  };
}

function hasDependencyCycle(tasks) {
  const graph = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dep of graph.get(id) || []) if (visit(dep)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return tasks.some((task) => visit(task.id));
}

function normalizePlan(raw, request) {
  const input = raw && typeof raw === 'object' ? raw : fallbackPlan(request);
  const rawTasks = Array.isArray(input.tasks) ? input.tasks.slice(0, MAX_TASKS) : [];
  if (!rawTasks.length) return fallbackPlan(request);
  const ids = new Set();
  const tasks = [];
  for (let i = 0; i < rawTasks.length; i += 1) {
    const task = rawTasks[i] || {};
    const id = String(task.id || `task-${i + 1}`).trim();
    if (!id || ids.has(id)) continue;
    const specialty = String(task.specialty || 'integration').trim().toLowerCase();
    const role = SPECIALTY_TO_ROLE[specialty] || 'CODER';
    const taskObjective = (
      (typeof task.objective === 'string' && task.objective.trim()) ||
      (typeof task.description === 'string' && task.description.trim()) ||
      (typeof task.goal === 'string' && task.goal.trim()) ||
      (typeof task.title === 'string' && task.title.trim()) ||
      (typeof task.summary === 'string' && task.summary.trim()) ||
      String(request || 'Implement requested code outcome').trim()
    );
    tasks.push({
      id,
      specialty,
      role: ALLOWED_ROLES.has(role) ? role : 'CODER',
      objective: taskObjective.slice(0, 12000),
      dependsOn: Array.isArray(task.dependsOn) ? [...new Set(task.dependsOn.map(String).map((dep) => dep.trim()).filter(Boolean))] : [],
      expectedOutput: String(task.expectedOutput || 'Evidence-backed completion of the objective.').trim().slice(0, 4000),
      ...(Array.isArray(task.requirements) ? { requirements: task.requirements } : {}),
      ...(Array.isArray(task.files) ? { files: task.files } : {})
    });
    ids.add(id);
  }
  const validIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    task.dependsOn = task.dependsOn.filter((dep) => validIds.has(dep) && dep !== task.id);
  }
  if (!tasks.length || hasDependencyCycle(tasks)) return fallbackPlan(request);

  const schemaValidation = validateTaskPlanSchema(tasks);
  if (!schemaValidation.valid) {
    logger.warn(`[CopilotDirector] Task plan schema invalid (${schemaValidation.errors.join('; ')}). Falling back to safe sequential plan.`);
    return fallbackPlan(request);
  }

  return { summary: String(input.summary || 'Adaptive Copilot Director plan').slice(0, 2000), tasks };
}

class CopilotDirector {
  constructor({ db, projectAuthorization, workspaceManager, toolRegistry, plannerExecutionLoop, contextAssembler, taskPlanner, executionController, agentTaskDao, agentRunDao, aiService = AgentCascadeAiService, coordinator = null, algorithmVerifier = null, qualityGate = null, trustedRunner = null } = {}) {
    this.db = db;
    this.projectAuthorization = projectAuthorization;
    this.workspaceManager = workspaceManager;
    this.toolRegistry = toolRegistry;
    this.plannerExecutionLoop = plannerExecutionLoop;
    this.contextAssembler = contextAssembler;
    this.taskPlanner = taskPlanner;
    this.executionController = executionController;
    this.agentTaskDao = agentTaskDao;
    this.agentRunDao = agentRunDao;
    this.aiService = aiService;
    this.coordinator = coordinator || new AgentCoordinator({ db, projectAuthService: projectAuthorization, workspaceManager, toolRegistry, plannerExecutionLoop, contextAssembler, executionController, agentTaskDao, agentRunDao });
    this.algorithmVerifier = algorithmVerifier || new AlgorithmVerifier();
    this.qualityGate = qualityGate || new GeneratedAppQualityGate();
    this.trustedRunner = trustedRunner || new TrustedExecutionService();
  }

  async createPlan(request, context = {}, preferredModel = 'auto') {
    if (!String(request || '').trim()) throw new Error('Director request is required');
    try {
      let workspaceDirective = '';
      if (context.projectId && this.workspaceManager) {
        try {
          const meta = this.workspaceManager.getWorkspaceMetadata(context.projectId, context.userId || 'system');
          if (meta?.diskPath && fs.existsSync(meta.diskPath)) {
            const intelligence = inspectWorkspace(meta.diskPath);
            workspaceDirective = buildPromptDirective(intelligence);
          }
        } catch (_) {}
      }

      const strategy = analyzeCodeGenerationRequest(request, context);
      const classification = classifyRequest(request);
      let algorithmGuidance = '';
      if (classification.category === 'ALGORITHMIC_PROBLEM' || strategy.intent.algorithmic) {
        const contract = deriveAlgorithmTaskContract(request, classification, context);
        algorithmGuidance = buildAlgorithmGuidanceBlock(contract);
      }

      // Task-aware model selection routing
      let effectiveModel = preferredModel;
      if (preferredModel === 'auto') {
        if (classification.category === 'ALGORITHMIC_PROBLEM' || strategy.intent.algorithmic || strategy.intent.fullStack) {
          effectiveModel = 'reasoning'; // Signals planner cascade to prioritize highest-reasoning provider
        } else if (classification.isRoutine) {
          effectiveModel = 'fast';
        }
      }

      const prompt = `${DIRECTOR_PLANNER_PROMPT}\n\n${workspaceDirective ? `${workspaceDirective}\n\n` : ''}${formatCodeGenerationStrategy(strategy)}${algorithmGuidance ? `\n\n${algorithmGuidance}` : ''}\n\nREQUEST:\n${request}\n\nAUTHORIZED WORKSPACE CONTEXT:\n${JSON.stringify(context).slice(0, 30000)}`;
      // P12.4: mode 'planner' (no system prompt) - 'agent' mode's FILE: format
      // instruction fights this prompt's "respond with valid JSON" contract.
      const response = effectiveModel && effectiveModel !== 'auto'
        ? await this.aiService.chat(prompt, [], 'planner', null, effectiveModel)
        : await this.aiService.chat(prompt, [], 'planner');
      return normalizePlan(extractJson(response), request);
    } catch (_) { return normalizePlan(null, request); }
  }

  async executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs, onEvent = () => {}, permissionLevel = 'auto', approvalToken = null, approvalState = null, preferredModel = 'auto' }) {
    let hasExistingFiles = false;
    let existingFiles = [];
    let existingFileContents = null;
    let meta = null;
    try {
      meta = this.workspaceManager?.getWorkspaceMetadata?.(projectId, userId);
      hasExistingFiles = Boolean(meta && meta.fileCount > 0);
      // P12.8 (E2E run #14): pass the REAL file list to the specialist planner.
      // The SURGICAL directive alone was not enough â€” the planner kept emitting
      // "Create package.json"/"Create App.jsx" for files that already existed
      // (WRITE_FORBIDDEN Ã—4 burned the whole repair budget on pass 2). With the
      // list in AUTHORIZED CONTEXT it can plan read_file + apply_diff instead.
      if (hasExistingFiles && meta?.diskPath && fs.existsSync(meta.diskPath)) {
        existingFiles = listExistingFilesBounded(meta.diskPath, 100);
        // P12.9 (E2E run #15): the LIST alone still left SEARCH guessing â€”
        // the planner baked imagined content (31Ã— SEARCH-not-found). Hand it
        // the actual bytes of the key small files so SEARCH is verbatim.
        existingFileContents = existingFiles.length ? readKeyFileContents(meta.diskPath, existingFiles) : null;
      }
    } catch (_) {}

    const directive = hasExistingFiles
      ? `[SURGICAL_DIRECTIVE: Inspect existing workspace files first. Apply surgical targeted edits to affected files only without wiping or regenerating unrelated code.` +
        (existingFiles.length ? ` EXISTING FILES (these paths ALREADY EXIST â€” never plan write_file for them, it is REJECTED; to change one, read_file it then apply_diff): ${existingFiles.join(', ')}` : '') +
        `]`
      : `[GREENFIELD_DIRECTIVE: Workspace is new/empty. Create required source and component files directly using write_file. Do not attempt to read non-existent legacy files.]`;

    let workspacePackageJson = null;
    try {
      const packageSource = existingFileContents?.['package.json'];
      if (packageSource) workspacePackageJson = JSON.parse(packageSource);
    } catch (_) {}
    const codeStrategy = analyzeCodeGenerationRequest(request || task.objective, {
      ...(workspacePackageJson ? { packageJson: workspacePackageJson } : {}),
      ...(existingFileContents ? { files: existingFileContents } : {})
    });
    const objectiveWithDirective = `${directive}\n${formatCodeGenerationStrategy(codeStrategy)}\n${task.objective}`;
    
    let attempt = 0;
    let lastResult = null;
    let lastError = null;
    const maxSelfHealingAttempts = Math.min(maxRepairs || 1, 2);

    while (attempt <= maxSelfHealingAttempts) {
      attempt++;
      try {
        const currentObjective = attempt === 1 
          ? objectiveWithDirective 
          : `REPAIR ATTEMPT ${attempt}: The previous implementation failed with error: ${lastError}. Please analyze the failure, read the relevant logs, and provide a corrected fix. Original objective: ${objectiveWithDirective}`;

        onEvent({ type: 'thinking', message: `ðŸ› ï¸ Specialist [${task.id}] planning steps (attempt ${attempt}/${maxSelfHealingAttempts + 1})...` });

        const workerPlan = await this.taskPlanner.generatePlan(currentObjective, { 
          projectId, 
          role: task.role, 
          specialty: task.specialty, 
          directorTaskId: task.id, 
          request, 
          expectedOutput: task.expectedOutput,
          ...(existingFiles.length ? { existingFiles } : {}),
          ...(existingFileContents ? { existingFileContents } : {}),
          ...(preferredModel && preferredModel !== 'auto' ? { preferredModel } : {})
        });

        onEvent({ type: 'thinking', message: `âš¡ Specialist [${task.id}] executing ${workerPlan.steps?.length || 0} step(s)...` });

        // --- VERIFICATION GATE: Execute and then Verify ---
        lastResult = await this.plannerExecutionLoop.runWithPlan(
          projectId, 
          userId, 
          workerPlan, 
          maxRepairs || 3, 
          () => Boolean(signal?.aborted), 
          `copilot_${delegated.workerRun.id}_att${attempt}`,
          { onEvent, permissionLevel, approvalToken: approvalToken || undefined, approvalState: approvalState || undefined, ...(preferredModel && preferredModel !== 'auto' ? { preferredModel } : {}) }
        );

        // Execution completed all steps successfully
        if (lastResult?.status === 'SUCCEEDED') {
          // Cross-file contract validation on real workspace files
          if (meta?.diskPath && fs.existsSync(meta.diskPath)) {
            const currentFiles = collectWorkspaceFilesBounded(meta.diskPath);
            if (Object.keys(currentFiles).length > 0) {
              const contractValidation = validateCrossFileContracts(currentFiles, {
                existingFramework: codeStrategy?.framework || (workspacePackageJson ? 'react' : null)
              });
              if (!contractValidation.valid && contractValidation.errors.length > 0) {
                const affectedFiles = extractAffectedFilesFromContractErrors(contractValidation.errors);
                onEvent({
                  type: 'contract_validation_failed',
                  taskId: task.id,
                  attempt,
                  errors: contractValidation.errors,
                  affectedFiles
                });
                lastError = `Cross-file contract validation failed: ${contractValidation.errors.join('; ')}. TARGETED REPAIR REQUIRED: Only modify the affected files [${affectedFiles.join(', ')}]. Do not touch or rewrite unrelated files.`;
                logger.warn(`[CopilotDirector] Worker ${task.id} contract validation error: ${lastError}`);
                continue;
              }

              // Run Stage 1-10 static code review
              const staticReview = reviewProjectFiles(currentFiles, codeStrategy);
              if (!staticReview.passed && staticReview.findingsCount.errors > 0) {
                const errorMessages = staticReview.findings
                  .filter(f => f.severity === 'ERROR')
                  .map(f => `${f.filePath ? f.filePath + ': ' : ''}${f.message}`);
                const affected = staticReview.repairPlan.targetFiles;
                onEvent({
                  type: 'code_review_findings',
                  taskId: task.id,
                  attempt,
                  score: staticReview.score,
                  errors: errorMessages,
                  affectedFiles: affected
                });
                lastError = `Static code review found critical defect(s): ${errorMessages.slice(0, 3).join('; ')}. TARGETED REPAIR REQUIRED: Only modify affected files [${affected.join(', ')}].`;
                logger.warn(`[CopilotDirector] Worker ${task.id} static review failure: ${lastError}`);
                continue;
              }
            }
          }
          return lastResult;
        } else {
          lastError = lastResult?.error || lastResult?.reason || 'Unknown execution failure';
        }
        // P12.3: an approval gate cannot self-heal â€” a repair plan without a
        // token hits the same gate. Propagate immediately (code preserved) so
        // the run pauses honestly instead of burning repair/LLM budget.
        if (typeof lastError === 'string' && lastError.startsWith('APPROVAL_REQUIRED')) {
          throw Object.assign(new Error(lastError), { code: 'APPROVAL_REQUIRED' });
        }
        logger.warn(`[CopilotDirector] Worker ${task.id} attempt ${attempt} status: ${lastResult?.status}, error: ${lastError}`);
      } catch (error) {
        if (error?.code === 'APPROVAL_REQUIRED') throw error;
        lastError = error.message;
        logger.warn(`[CopilotDirector] Worker ${task.id} attempt ${attempt} caught error: ${lastError}`);
      }
    }

    throw new Error(`Worker ${task.id} failed after ${attempt} self-healing attempts. Final error: ${lastError}`);
  }

  async run({ userId, projectId, request, signal = null, onEvent = () => {}, maxRepairs = 3, plan: presetPlan = null, permissionLevel = 'auto', approvalToken = null, preferredModel = 'auto' }) {
    // P12.3: ONE shared mutable approval state for this run â€” every worker (and
    // the final verification) gets the SAME holder. ExecutionController's
    // single-use rotation writes through the ChatPlanner context proxy into it,
    // so a worker that builds its context later reads the ROTATED token instead
    // of the original one an earlier worker already consumed
    // ("already consumed (replay rejected)" used to kill every later gated step).
    const approvalState = { token: approvalToken || null };
    // Plan-mode override: use the user-approved plan (normalized + validated â€”
    // bad shapes fall back to a generic sequential plan, never crash).
    const plan = presetPlan ? normalizePlan(presetPlan, request) : await this.createPlan(request, { projectId }, preferredModel);
    const supervisorResult = await this.coordinator.createSupervisorTask({ userId, projectId, title: `Copilot Director: ${String(request).slice(0, 180)}`, prompt: request, metadata: { source: 'copilot-director', plannedTaskCount: plan.tasks.length } });
    const supervisorTaskId = supervisorResult.task.id;
    const supervisorRunId = supervisorResult.run.id;
    const completed = new Map();
    const results = [];
    const markCancelled = (reason = 'Task canceled by user') => {
      this.agentTaskDao.updateStatus(supervisorTaskId, 'CANCELLED');
      this.agentRunDao.updateStatus(supervisorRunId, 'CANCELLED', reason, null, new Date().toISOString());
      return { status: 'CANCELLED', taskId: supervisorTaskId, runId: supervisorRunId, plan, results };
    };
    onEvent({ type: 'director_plan', status: 'PLANNED', summary: plan.summary, taskCount: plan.tasks.length, tasks: plan.tasks.map(({ id, specialty, role, dependsOn }) => ({ id, specialty, role, dependsOn })) });
    this.agentTaskDao.updateStatus(supervisorTaskId, 'RUNNING');
    this.agentRunDao.updateStatus(supervisorRunId, 'RUNNING');
    try {
      const pending = new Set(plan.tasks.map((task) => task.id));
      while (pending.size) {
        if (signal?.aborted) return markCancelled();
        const ready = plan.tasks.filter((task) => pending.has(task.id) && task.dependsOn.every((dep) => completed.get(dep) === 'SUCCEEDED'));
        if (!ready.length) {
          // P12.3: remaining tasks are blocked by skipped/failed deps â€” report
          // them honestly and proceed to verification instead of crashing the
          // whole run ("dependency-blocked" used to discard completed work).
          for (const stuck of plan.tasks.filter((task) => pending.has(task.id))) {
            pending.delete(stuck.id);
            results.push({ task: stuck, status: 'SKIPPED', error: 'Dependency did not succeed' });
            onEvent({ type: 'director_task', status: 'SKIPPED', taskId: stuck.id, specialty: stuck.specialty, role: stuck.role, error: 'Dependency did not succeed' });
          }
          break;
        }
        for (const task of ready) {
          pending.delete(task.id);
          let delegated = null;
          let executionResult = null;
          let lastError = null;
          let delegateFailed = null;
          for (let attempt = 1; attempt <= MAX_WORKER_RETRIES + 1; attempt += 1) {
            onEvent({ type: 'director_task', status: attempt === 1 ? 'DELEGATING' : 'RETRYING', attempt, taskId: task.id, specialty: task.specialty, role: task.role, objective: task.objective });
            try {
              delegated = await this.coordinator.delegate({ supervisorRunId, role: task.role, objective: task.objective, constraints: { specialty: task.specialty, directorTaskId: task.id, attempt }, expectedOutput: task.expectedOutput });
            } catch (delegateErr) {
              // P12.3: a spawn failure (worker cap, project limits) must not
              // nuke completed work â€” skip this task honestly and move on;
              // its dependents are skipped by the !ready branch above.
              logger.warn(`[CopilotDirector] delegate failed for task ${task.id}: ${delegateErr.message}`);
              delegateFailed = delegateErr;
              break;
            }
            try {
              executionResult = await this.coordinator.startWorker(delegated.workerRun.id, { autoPlan: false, runner: () => this.executeWorker({ task, delegated, projectId, userId, request, signal, maxRepairs, onEvent, permissionLevel, approvalToken, approvalState, preferredModel }) });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              if (signal?.aborted || ['APPROVAL_REQUIRED', 'TASK_CANCELED'].includes(error?.code)) break;
            }
          }
          if (delegateFailed) {
            results.push({ task, status: 'SKIPPED', error: delegateFailed.message });
            onEvent({ type: 'director_task', status: 'SKIPPED', taskId: task.id, specialty: task.specialty, role: task.role, error: delegateFailed.message });
            continue;
          }
          if (lastError && (signal?.aborted || lastError?.code === 'TASK_CANCELED')) {
            return markCancelled(lastError.message || 'Task canceled by user');
          }
          if (lastError) {
            completed.set(task.id, 'FAILED');
            results.push({ task, status: 'FAILED', error: lastError.message });
            onEvent({ type: 'director_task', status: 'FAILED', taskId: task.id, specialty: task.specialty, role: task.role, error: lastError.message });
            throw lastError;
          }
          const executionStatus = String(executionResult?.status || '').toUpperCase();
          const taskStatus = executionStatus === 'CANCELLED'
            ? 'CANCELLED'
            : ['SUCCEEDED', 'COMPLETED'].includes(executionStatus)
              ? 'SUCCEEDED'
              : 'FAILED';
          if (taskStatus === 'FAILED') {
            const failureMessage = executionResult?.error || executionResult?.reason ||
              `Worker ${task.id} returned non-success status "${executionResult?.status || 'unknown'}".`;
            completed.set(task.id, 'FAILED');
            results.push({ task, status: 'FAILED', error: failureMessage, workerRunId: delegated.workerRun.id, result: executionResult });
            onEvent({ type: 'director_task', status: 'FAILED', taskId: task.id, specialty: task.specialty, role: task.role, workerRunId: delegated.workerRun.id, error: failureMessage, result: executionResult });
            throw new Error(failureMessage);
          }

          completed.set(task.id, taskStatus);
          results.push({ task, status: taskStatus, workerRunId: delegated.workerRun.id, result: executionResult });
          onEvent({ type: 'director_task', status: taskStatus, taskId: task.id, specialty: task.specialty, role: task.role, workerRunId: delegated.workerRun.id, result: executionResult });

          if (Array.isArray(executionResult?.stepLogs)) {
            for (const step of executionResult.stepLogs) {
              const act = step?.action || step?.tool || '';
              const target = step?.params?.path || step?.params?.filePath || step?.params?.TargetFile || step?.params?.file;
              if (target && (act.includes('write') || act.includes('edit') || act.includes('patch') || act.includes('replace') || act.includes('diff'))) {
                const fname = String(target).split(/[/\\]/).pop();
                onEvent({
                  type: 'director_file_diff',
                  file: fname,
                  fullPath: target,
                  action: act,
                  taskId: task.id,
                  specialty: task.specialty,
                  summary: step?.result?.message || `Surgical edit applied to ${fname}`,
                  timestamp: Date.now()
                });
              }
            }
          }

          if (taskStatus === 'CANCELLED') return markCancelled('Worker canceled execution');
        }
      }
      onEvent({ type: 'director_verification', status: 'DELEGATING' });
      // Final cross-file contract validation across the entire workspace
      const meta = this.workspaceManager?.getWorkspaceMetadata?.(projectId, userId);
      let finalFiles = {};
      try {
        if (meta?.diskPath && fs.existsSync(meta.diskPath)) {
          finalFiles = collectWorkspaceFilesBounded(meta.diskPath);
          if (Object.keys(finalFiles).length > 0) {
            const finalValidation = validateCrossFileContracts(finalFiles);
            if (!finalValidation.valid && finalValidation.errors.length > 0) {
              const contractErr = `Final workspace contract validation failed: ${finalValidation.errors.join('; ')}`;
              onEvent({ type: 'contract_validation_failed', status: 'FAILED', errors: finalValidation.errors });
              throw new Error(contractErr);
            }

            // Stage 1-10 static code review across all workspace files
            const staticReview = reviewProjectFiles(finalFiles);
            onEvent({
              type: 'static_code_review',
              status: staticReview.passed ? 'PASSED' : 'WARNING',
              score: staticReview.score,
              findingsCount: staticReview.findingsCount,
              review: staticReview
            });
          }
        }
      } catch (err) {
        if (err.message && err.message.startsWith('Final workspace contract validation failed')) {
          throw err;
        }
      }

      const classification = classifyRequest(request, { files: finalFiles });
      const canonicalResolution = resolveCanonicalCase(request, finalFiles);
      let algorithmVerificationOutcome = null;

      // â”€â”€ Layer A: Algorithm Oracle Verification Path â”€â”€
      if (classification.category === 'ALGORITHMIC_PROBLEM' || classification.isAlgorithm) {
        const oracleName = detectSupportedAlgorithmOracle(request, finalFiles);
        if (oracleName) {
          const candidateCode = extractCandidateCode(finalFiles, oracleName);
          if (candidateCode) {
            onEvent({ type: 'director_verification', phase: 'algorithm_oracle', oracle: oracleName });
            const algoResult = await this.algorithmVerifier.verifyAlgorithm(oracleName, candidateCode);
            if (!algoResult.verified) {
              const err = `Algorithm oracle verification failed for [${oracleName}]: ${algoResult.error || 'Test failure'}`;
              onEvent({ type: 'director_verification', status: 'FAILED', error: err, algorithmResult: algoResult });
              throw new Error(err);
            } else {
              algorithmVerificationOutcome = { verified: true, oracle: oracleName, algoResult };
              onEvent({ type: 'director_verification', status: 'SUCCEEDED', oracle: oracleName, algorithmResult: algoResult });
            }
          } else {
            const err = `No candidate implementation found for algorithm [${oracleName}] in workspace`;
            onEvent({ type: 'director_verification', status: 'FAILED', error: err });
            throw new Error(err);
          }
        } else {
          // Explicitly UNVERIFIED: do not claim verification when no matching oracle exists
          algorithmVerificationOutcome = { verified: false, unverified: true, reason: 'No matching independent algorithm oracle for this problem' };
          onEvent({ type: 'director_verification', status: 'UNVERIFIED', reason: algorithmVerificationOutcome.reason });
        }
      }

      // â”€â”€ Layer B: Generated App Quality Gate Path â”€â”€
      let qualityGateOutcome = null;
      const isAppGeneration = Boolean(
        classification.category === 'APPLICATION_FEATURE' &&
        meta?.diskPath &&
        (fs.existsSync(path.join(meta.diskPath, 'package.json')) || Object.keys(finalFiles).length >= 2)
      );

      if (isAppGeneration && meta?.diskPath) {
        if (canonicalResolution.canonicalCase) {
          try {
            const flows = getAcceptanceFlows(canonicalResolution.canonicalCase);
            const evidence = await this.trustedRunner.execute({
              projectDir: meta.diskPath,
              files: finalFiles,
              runId: supervisorRunId,
              caseId: canonicalResolution.canonicalCase,
              acceptanceFlows: flows
            });
            const gateResult = await this.qualityGate.evaluate({
              projectDir: meta.diskPath,
              files: finalFiles,
              caseId: canonicalResolution.canonicalCase,
              runId: supervisorRunId,
              executionEvidence: evidence
            });
            qualityGateOutcome = gateResult;
            onEvent({ type: 'quality_gate_evaluation', status: gateResult.status, gateResult });

            if (gateResult.status === STATUS.FAILED) {
              const detail = (gateResult.defects || []).map((d) => d.detail).join('; ') || 'Quality gate validation failed';
              const err = `Generated app quality gate failed: ${detail}`;
              onEvent({ type: 'quality_gate_evaluation', status: STATUS.FAILED, error: err });
              throw new Error(err);
            }
          } catch (err) {
            // Fail closed! Missing runner secret, artifact mutation, failed build/tests must NOT be swallowed as warnings
            onEvent({ type: 'quality_gate_evaluation', status: STATUS.FAILED, error: err.message });
            logger.warn(`[CopilotDirector] Quality gate failure recorded: ${err.message}`);
            if (err.message && err.message.startsWith('Generated app quality gate failed')) {
              throw err;
            }
            throw new Error(`Generated app quality gate failed: ${err.message}`);
          }
        } else {
          // Request does not match a canonical benchmark: report NOT_EVALUATED honestly without failing the generation
          qualityGateOutcome = { status: STATUS.NOT_EVALUATED, reason: canonicalResolution.reason };
          onEvent({ type: 'quality_gate_evaluation', status: STATUS.NOT_EVALUATED, reason: canonicalResolution.reason });
        }
      }

      const verifier = await this.coordinator.delegate({ supervisorRunId, role: 'VERIFIER', objective: `Perform the final read-only verification gate for the requested outcome: ${request}. Inspect the current workspace state and confirm tests/build/runtime evidence where supported. Do not mutate the workspace.`, constraints: { specialty: 'verification', generatedByDirector: true }, expectedOutput: 'Final verification evidence and any remaining blockers.' });
      const finalVerification = await this.coordinator.startWorker(verifier.workerRun.id, { runner: async () => { const verificationPlan = await this.taskPlanner.generateVerificationPlan(request, { projectId, request, role: 'VERIFIER', ...(preferredModel && preferredModel !== 'auto' ? { preferredModel } : {}) }); return this.plannerExecutionLoop.runWithPlan(projectId, userId, verificationPlan, 0, () => Boolean(signal?.aborted), `copilot_verify_${verifier.workerRun.id}`, { onEvent, permissionLevel, approvalToken: approvalToken || undefined, approvalState: approvalState || undefined, ...(preferredModel && preferredModel !== 'auto' ? { preferredModel } : {}) }); } });
      const verificationStatus = String(finalVerification?.status || 'FAILED').toUpperCase();
      const verificationSummary = String(
        finalVerification?.summary || finalVerification?.result?.summary || finalVerification?.message || ''
      ).trim().slice(0, 400);
      const verificationArtifacts = Array.isArray(finalVerification?.artifact_refs)
        ? finalVerification.artifact_refs.filter((ref) => typeof ref === 'string' && ref.trim()).slice(0, 10)
        : [];
      onEvent({
        type: 'director_verification',
        status: verificationStatus,
        workerRunId: verifier.workerRun.id,
        summary: verificationSummary || undefined,
        artifact_refs: verificationArtifacts,
        result: finalVerification
      });
      if (verificationStatus !== 'SUCCEEDED') throw new Error('Final Director verification gate did not pass');

      const artifactRefs = [
        ...results.flatMap((item) => item.result?.result?.artifact_refs || item.result?.artifact_refs || []),
        ...verificationArtifacts
      ].filter((ref, index, all) => typeof ref === 'string' && ref.trim() && all.indexOf(ref) === index).slice(0, 10);
      const incompleteTasks = results.filter((item) => item.status !== 'SUCCEEDED');
      if (incompleteTasks.length > 0) {
        const taskSummary = incompleteTasks
          .slice(0, 8)
          .map(({ task, status }) => `${task.id} (${status})`)
          .join(', ');
        const remainder = incompleteTasks.length > 8 ? `, and ${incompleteTasks.length - 8} more` : '';
        const summary = `Director verification passed, but ${incompleteTasks.length} planned task(s) did not succeed: ${taskSummary}${remainder}.`.slice(0, 480);
        this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
        this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', summary, null, new Date().toISOString());
        const completion = {
          type: 'director_complete',
          status: 'FAILED',
          taskId: supervisorTaskId,
          runId: supervisorRunId,
          taskCount: plan.tasks.length,
          tasksSkipped: incompleteTasks.length,
          message: summary,
          summary,
          verification: {
            status: verificationStatus,
            summary: verificationSummary || 'Partial workspace verification passed; plan incomplete.',
            artifact_refs: verificationArtifacts
          }
        };
        onEvent(completion);
        return ResultValidator.validate({
          status: 'FAILED',
          summary,
          artifact_refs: artifactRefs,
          context_refs: [],
          verification_status: 'PASSED',
          errors: [{ code: 'INCOMPLETE_PLAN', message: summary.slice(0, 256) }]
        });
      }

      // Fail closed: algorithm verification failure
      if (algorithmVerificationOutcome && algorithmVerificationOutcome.failed) {
        const summary = `Algorithm verification failed: ${algorithmVerificationOutcome.error || 'Test failure'}`.slice(0, 480);
        this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
        this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', summary, null, new Date().toISOString());
        const completion = {
          type: 'director_complete',
          status: 'FAILED',
          taskId: supervisorTaskId,
          runId: supervisorRunId,
          taskCount: plan.tasks.length,
          message: summary,
          summary,
          verification: {
            status: 'FAILED',
            summary,
            artifact_refs: verificationArtifacts
          }
        };
        onEvent(completion);
        return ResultValidator.validate({
          status: 'FAILED',
          summary,
          artifact_refs: artifactRefs,
          context_refs: [],
          verification_status: 'FAILED',
          errors: [{ code: 'ALGORITHM_VERIFICATION_FAILED', message: summary.slice(0, 256) }]
        });
      }

      // Fail closed: quality gate failure (verifier worker cannot convert failure to success)
      if (qualityGateOutcome && qualityGateOutcome.status === STATUS.FAILED) {
        const summary = `Generated app quality gate failed: ${qualityGateOutcome.error || 'Quality gate defects detected'}`.slice(0, 480);
        this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
        this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', summary, null, new Date().toISOString());
        const completion = {
          type: 'director_complete',
          status: 'FAILED',
          taskId: supervisorTaskId,
          runId: supervisorRunId,
          taskCount: plan.tasks.length,
          message: summary,
          summary,
          verification: {
            status: 'FAILED',
            summary,
            artifact_refs: verificationArtifacts
          }
        };
        onEvent(completion);
        return ResultValidator.validate({
          status: 'FAILED',
          summary,
          artifact_refs: artifactRefs,
          context_refs: [],
          verification_status: 'FAILED',
          errors: [{ code: 'QUALITY_GATE_FAILED', message: summary.slice(0, 256) }]
        });
      }

      if (qualityGateOutcome && qualityGateOutcome.status === STATUS.PARTIAL) {
        const summary = `Director completed tasks with PARTIAL verification (acceptance criteria or build evidence incomplete).`;
        this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
        this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
        const completion = {
          type: 'director_complete',
          status: 'PARTIAL',
          taskId: supervisorTaskId,
          runId: supervisorRunId,
          taskCount: plan.tasks.length,
          verification: {
            status: 'PARTIAL',
            summary,
            artifact_refs: verificationArtifacts
          }
        };
        onEvent(completion);
        return ResultValidator.validate({
          status: 'PARTIAL',
          summary,
          artifact_refs: artifactRefs,
          context_refs: [],
          verification_status: 'PARTIAL',
          errors: [{ code: 'PARTIAL_VERIFICATION', message: 'Required acceptance criteria or execution evidence incomplete.' }]
        });
      }

      if (qualityGateOutcome && qualityGateOutcome.status === STATUS.NOT_EVALUATED) {
        const summary = `Director completed tasks (canonical benchmark: NOT_EVALUATED - ${qualityGateOutcome.reason || 'unmatched scope'}).`;
        this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
        this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
        const completion = {
          type: 'director_complete',
          status: 'COMPLETED',
          taskId: supervisorTaskId,
          runId: supervisorRunId,
          taskCount: plan.tasks.length,
          verification: {
            status: 'UNVERIFIED',
            summary: qualityGateOutcome.reason || 'Benchmark scope not evaluated.',
            artifact_refs: verificationArtifacts
          }
        };
        onEvent(completion);
        return ResultValidator.validate({
          status: 'COMPLETED',
          summary,
          artifact_refs: artifactRefs,
          context_refs: [],
          verification_status: 'UNVERIFIED',
          errors: []
        });
      }

      if (algorithmVerificationOutcome && algorithmVerificationOutcome.unverified) {
        const summary = `Director completed tasks, but outcome is UNVERIFIED (no matching oracle).`;
        this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
        this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
        const completion = {
          type: 'director_complete',
          status: 'UNVERIFIED',
          taskId: supervisorTaskId,
          runId: supervisorRunId,
          taskCount: plan.tasks.length,
          verification: {
            status: 'UNVERIFIED',
            summary,
            artifact_refs: verificationArtifacts
          }
        };
        onEvent(completion);
        return ResultValidator.validate({
          status: 'UNVERIFIED',
          summary,
          artifact_refs: artifactRefs,
          context_refs: [],
          verification_status: 'UNVERIFIED',
          errors: []
        });
      }

      this.agentTaskDao.updateStatus(supervisorTaskId, 'COMPLETED');
      this.agentRunDao.updateStatus(supervisorRunId, 'SUCCEEDED');
      const completion = {
        type: 'director_complete',
        status: 'SUCCEEDED',
        taskId: supervisorTaskId,
        runId: supervisorRunId,
        taskCount: plan.tasks.length,
        verification: {
          status: verificationStatus,
          summary: verificationSummary || 'Final verification passed.',
          artifact_refs: verificationArtifacts
        }
      };
      onEvent(completion);
      return ResultValidator.validate({
        status: 'COMPLETED',
        summary: `Director completed ${plan.tasks.length} adaptive task(s) and final verification.`,
        artifact_refs: artifactRefs,
        context_refs: [],
        verification_status: 'PASSED',
        errors: []
      });
    } catch (error) {
      if (signal?.aborted || error?.code === 'TASK_CANCELED') {
        return markCancelled(error.message || 'Task canceled by user');
      }
      this.agentTaskDao.updateStatus(supervisorTaskId, 'FAILED');
      this.agentRunDao.updateStatus(supervisorRunId, 'FAILED', error.message);
      throw error;
    }
  }
}

module.exports = { CopilotDirector, normalizePlan, fallbackPlan, SPECIALTY_TO_ROLE, MAX_TASKS, hasDependencyCycle };
