'use strict';

/**
 * AI-Dost 2.0 — Dedicated Capability Discovery & Intent Matching Service
 * 
 * Thin deterministic orchestration layer around CapabilityRegistry.
 * Prioritizes deterministic matching before any fallback:
 * 1. Exact capability ID
 * 2. Exact canonical capability name
 * 3. Existing registry intent aliases
 * 4. Deterministic keyword / phrase matching
 * 5. Multi-capability clause decomposition
 * 6. Dependency resolution (transitive, deduplicated, deterministic)
 * 7. On-demand skill and tool discovery
 * 8. Ambiguity detection
 * 9. Availability / status propagation
 * 
 * Operates strictly offline, sub-millisecond latency, zero external network calls.
 * CapabilityRegistry remains the single source of truth and is deeply immutable.
 */

const {
  capabilityRegistry,
  STATUS,
  AVAILABILITY,
  CATEGORIES,
  RISK,
  APPROVAL
} = require('./CapabilityRegistry');

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

const MATCH_TYPE = Object.freeze({
  EXACT: 'EXACT',
  ALIAS: 'ALIAS',
  KEYWORD: 'KEYWORD',
  DEPENDENCY: 'DEPENDENCY'
});

// Domain keyword patterns precisely mapped to the 83 canonical capability IDs
const EXTENDED_KEYWORD_PATTERNS = Object.freeze([
  // Category 1: Coding & Software Engineering (12)
  { pattern: /\b(?:scaffold|full[\s-]stack|generate\s+project|create\s+project|new\s+app|boilerplate|saas\s+app)\b/i, id: 'coding.full_stack_delivery', weight: 0.95 },
  { pattern: /\b(?:production[\s-]grade|production\s+code|production\s+readiness)\b/i, id: 'coding.production_code', weight: 0.90 },
  { pattern: /\b(?:refactor|legacy\s+refactor|clean\s+up\s+code|modernize\s+code)\b/i, id: 'coding.legacy_refactoring', weight: 0.90 },
  { pattern: /\b(?:fix\s+bug|bug\s+fix|automated\s+bug|resolve\s+error|crash\s+fix|runtime\s+error)\b/i, id: 'coding.automated_bug_resolution', weight: 0.90 },
  { pattern: /\b(?:zero[\s-]knowledge|no[\s-]leak\s+architecture|client[\s-]side\s+storage)\b/i, id: 'coding.zero_knowledge_architecture', weight: 0.88 },
  { pattern: /\b(?:git\s+commit|git\s+status|git\s+rollback|commit\s+changes?|git\s+log|git\s+branch)\b/i, id: 'coding.git_operations', weight: 0.95 },
  { pattern: /\b(?:multi[\s-]file|file\s+context|across\s+files|cross[\s-]file)\b/i, id: 'coding.multi_file_context', weight: 0.88 },
  { pattern: /\b(?:api\s+integration|external\s+api|third[\s-]party\s+api|rest\s+client)\b/i, id: 'coding.api_integration', weight: 0.90 },
  { pattern: /\b(?:database\s+schema|schema\s+generation|prisma\s+schema|sql\s+table|db\s+migration|schema\s+migration|postgresql(?:\s+database)?|postgres(?:\s+db)?|sqlite\s+schema|mysql\s+schema)\b/i, id: 'coding.database_schema_generation', weight: 0.92 },
  { pattern: /\b(?:linting|prettier|eslint|format\s+code|lint\s+code)\b/i, id: 'coding.linting_formatting', weight: 0.90 },
  { pattern: /\b(?:explain\s+code|code\s+walkthrough|what\s+does\s+this\s+code\s+do|code\s+explanation)\b/i, id: 'coding.code_explanation', weight: 0.90 },
  { pattern: /\b(?:unit\s+tests?|test\s+cases?|test\s+generation|write\s+tests?|jest\s+test|playwright\s+test|tests?)\b/i, id: 'coding.test_case_generation', weight: 0.92 },

  // Category 2: UI/UX & Visual Design (11)
  { pattern: /\b(?:pixel[\s-]perfect|exact\s+design|fidelity\s+match)\b/i, id: 'ui.pixel_perfect', weight: 0.90 },
  { pattern: /\b(?:responsive\s+design|mobile\s+view|flex\s+wrap|viewport\s+repair|mobile\s+responsive|adaptive\s+layout)\b/i, id: 'ui.responsive_design', weight: 0.90 },
  { pattern: /\b(?:tailwind|tailwind\s+optimization|utility\s+classes)\b/i, id: 'ui.tailwind_css_optimization', weight: 0.90 },
  { pattern: /\b(?:theme\s+switching|dark\s+mode|light\s+mode|color\s+theme|toggle\s+theme)\b/i, id: 'ui.theme_switching', weight: 0.95 },
  { pattern: /\b(?:visual\s+bug|visual\s+heal|layout\s+bug|broken\s+alignment|visual\s+verification)\b/i, id: 'ui.visual_bug_detection', weight: 0.95 },
  { pattern: /\b(?:component[\s-]based|ui\s+components?|modular\s+ui|button\s+component)\b/i, id: 'ui.component_based_ui', weight: 0.88 },
  { pattern: /\b(?:microinteraction|animation|css\s+transition|framer\s+motion|smooth\s+motion)\b/i, id: 'ui.micro_animations', weight: 0.88 },
  { pattern: /\b(?:dynamic\s+chart|bar\s+chart|line\s+chart|pie\s+chart|data\s+visualization|graph\s+widget)\b/i, id: 'ui.dynamic_chart_generation', weight: 0.92 },
  { pattern: /\b(?:seo[\s-]friendly|meta\s+tags|open\s+graph|sitemap|structured\s+data)\b/i, id: 'ui.seo_friendly_layout', weight: 0.88 },
  { pattern: /\b(?:asset\s+loading|image\s+assets?|lazy\s+loading|cdn\s+assets?)\b/i, id: 'ui.asset_auto_loading', weight: 0.88 },
  { pattern: /\b(?:typography|font\s+hierarchy|type\s+scale|google\s+fonts)\b/i, id: 'ui.typography_hierarchy', weight: 0.88 },

  // Category 3: DevOps & Execution (10)
  { pattern: /\b(?:cloud\s+deploy|deploy\s+to\s+cloud|deploy\s+to\s+vercel|deploy\s+to\s+netlify|production\s+deploy)\b/i, id: 'devops.cloud_deployment', weight: 0.95 },
  { pattern: /\b(?:docker|dockerfile|containerization|docker[\s-]compose)\b/i, id: 'devops.docker', weight: 0.95 },
  { pattern: /\b(?:run\s+terminal|execute\s+command|shell\s+command|bash\s+command|terminal\s+tool)\b/i, id: 'devops.terminal', weight: 0.90 },
  { pattern: /\b(?:ci[\s/]cd|github\s+actions|build\s+pipeline|ci\s+workflow|automated\s+deploy\s+pipeline)\b/i, id: 'devops.ci_cd_pipeline', weight: 0.90 },
  { pattern: /\b(?:environment\s+variables?|\.env\s+management|secrets\s+management|env\s+config)\b/i, id: 'devops.env_management', weight: 0.88 },
  { pattern: /\b(?:port\s+conflict|port\s+already\s+in\s+use|eaddrinuse|find\s+free\s+port)\b/i, id: 'devops.port_conflict_resolution', weight: 0.90 },
  { pattern: /\b(?:serverless|cloud\s+function|lambda|edge\s+worker|serverless\s+api)\b/i, id: 'devops.serverless_function_setup', weight: 0.90 },
  { pattern: /\b(?:log\s+analysis|system\s+logs|error\s+logs|winston\s+logs|log\s+stream)\b/i, id: 'devops.log_analysis', weight: 0.88 },
  { pattern: /\b(?:ssl\s+automation|certbot|https\s+certificate|tls\s+certificate)\b/i, id: 'devops.ssl_automation', weight: 0.92 },
  { pattern: /\b(?:cron\s+job|scheduled\s+task|background\s+timer|cron\s+schedule)\b/i, id: 'devops.cron_job_setup', weight: 0.92 },

  // Category 4: Autonomy & Agentic Logic (9)
  { pattern: /\b(?:self[\s-]correction|auto[\s-]healing|recursive\s+healing|retry\s+correction)\b/i, id: 'autonomy.self_correction', weight: 0.92 },
  { pattern: /\b(?:multi[\s-]agent|agent\s+orchestration|swarm|worker\s+agents?)\b/i, id: 'autonomy.multi_agent', weight: 0.90 },
  { pattern: /\b(?:agent\s+memory|persistent\s+memory|recall\s+memory|remember\s+fact|sqlite\s+memory)\b/i, id: 'autonomy.memory', weight: 0.92 },
  { pattern: /\b(?:conflict\s+resolution|arbitrat(?:ion|or)|merge\s+conflict\s+resolution)\b/i, id: 'autonomy.conflict_resolution', weight: 0.90 },
  { pattern: /\b(?:task\s+prioritization|task\s+queue|scheduler\s+priority)\b/i, id: 'autonomy.task_prioritization', weight: 0.90 },
  { pattern: /\b(?:web\s+acquisition|web\s+research|tavily\s+search|search\s+web)\b/i, id: 'autonomy.web_acquisition', weight: 0.92 },
  { pattern: /\b(?:user[\s-]in[\s-]the[\s-]loop|approval\s+prompt|human\s+confirmation)\b/i, id: 'autonomy.user_in_the_loop', weight: 0.88 },
  { pattern: /\b(?:predictive\s+diagnostics|preflight\s+check|diagnostic\s+probe)\b/i, id: 'autonomy.predictive_diagnostics', weight: 0.88 },
  { pattern: /\b(?:dynamic\s+policy|adaptive\s+policy|runtime\s+policy)\b/i, id: 'autonomy.dynamic_policy_adaptation', weight: 0.88 },

  // Category 5: Performance & Cost (8)
  { pattern: /\b(?:zero[\s-]cost|free[\s-]tier|zero\s+api\s+cost|free\s+apis?)\b/i, id: 'performance.zero_cost_strategy', weight: 0.90 },
  { pattern: /\b(?:token\s+compression|context\s+compression|compress\s+context|summarize\s+history)\b/i, id: 'performance.token_compression', weight: 0.90 },
  { pattern: /\b(?:low[\s-]latency|fast\s+response|sub[\s-]second\s+inference)\b/i, id: 'performance.low_latency', weight: 0.88 },
  { pattern: /\b(?:offline\s+ai|local\s+model|ollama|qwen\s+local|offline\s+inference)\b/i, id: 'performance.offline_ai', weight: 0.95 },
  { pattern: /\b(?:resource\s+optimization|cpu\s+optimization|memory\s+limit)\b/i, id: 'performance.resource_optimization', weight: 0.88 },
  { pattern: /\b(?:caching|cache\s+strategy|redis\s+cache|memory\s+cache)\b/i, id: 'performance.caching', weight: 0.90 },
  { pattern: /\b(?:incremental\s+updates|partial\s+rebuild|hot\s+reload)\b/i, id: 'performance.incremental_updates', weight: 0.88 },
  { pattern: /\b(?:model\s+routing|cascade\s+routing|provider\s+fallback)\b/i, id: 'performance.model_routing', weight: 0.90 },

  // Category 6: SaaS & Business Features (9)
  { pattern: /\b(?:authentication|user\s+auth|login|signup|oauth|jwt\s+auth|user\s+registration|password\s+auth)\b/i, id: 'saas.authentication', weight: 0.95 },
  { pattern: /\b(?:stripe|payment\s+gateway|checkout\s+flow|subscription\s+billing|payments?)\b/i, id: 'saas.payments', weight: 0.95 },
  { pattern: /\b(?:database\s+relations|foreign\s+keys?|table\s+joins?|orm\s+relations?)\b/i, id: 'saas.database_relations', weight: 0.90 },
  { pattern: /\b(?:admin\s+dashboard|management\s+dashboard|admin\s+panel|metrics\s+dashboard)\b/i, id: 'saas.admin_dashboard', weight: 0.92 },
  { pattern: /\b(?:product\s+analytics|telemetry\s+tracking|pageview\s+analytics|usage\s+metrics)\b/i, id: 'saas.analytics', weight: 0.88 },
  { pattern: /\b(?:subscription\s+tiers|pricing\s+plans?|freemium|tier\s+gating)\b/i, id: 'saas.subscription_tiers', weight: 0.90 },
  { pattern: /\b(?:email\s+automation|transactional\s+email|sendgrid|email\s+alerts?)\b/i, id: 'saas.email_automation', weight: 0.90 },
  { pattern: /\b(?:data\s+import|data\s+export|csv\s+import|json\s+export)\b/i, id: 'saas.data_import_export', weight: 0.90 },
  { pattern: /\b(?:rbac|role[\s-]based\s+access|user\s+permissions?|admin\s+role|role\s+permission)\b/i, id: 'saas.rbac', weight: 0.92 },

  // Category 7: Security & Privacy (8)
  { pattern: /\b(?:sql\s+injection|sqli\s+prevention|parameterized\s+query)\b/i, id: 'security.sql_injection', weight: 0.95 },
  { pattern: /\b(?:xss|cross[\s-]site\s+scripting|html\s+escape|dom\s+sanitization)\b/i, id: 'security.xss', weight: 0.92 },
  { pattern: /\b(?:cors|cors\s+headers?|cross[\s-]origin|cors\s+policy)\b/i, id: 'security.cors', weight: 0.92 },
  { pattern: /\b(?:password\s+hashing|bcrypt|argon2|hash\s+password)\b/i, id: 'security.password_hashing', weight: 0.92 },
  { pattern: /\b(?:session\s+jwt|jwt\s+token|jwt\s+signing|bearer\s+token)\b/i, id: 'security.session_jwt', weight: 0.92 },
  { pattern: /\b(?:api\s+key\s+protection|credential\s+leak|secret\s+masking)\b/i, id: 'security.api_key_protection', weight: 0.92 },
  { pattern: /\b(?:privacy\s+compliance|gdpr|data\s+retention|anonymize)\b/i, id: 'security.privacy_compliance', weight: 0.88 },
  { pattern: /\b(?:rate\s+limiting|rate\s+limiter|ddos\s+protection|throttle\s+requests?)\b/i, id: 'security.rate_limiting', weight: 0.90 },

  // Category 8: Data & Advanced AI (7)
  { pattern: /\b(?:csv\s+analysis|pandas\s+csv|analyze\s+csv|spreadsheet\s+analysis)\b/i, id: 'data.csv_analysis', weight: 0.92 },
  { pattern: /\b(?:embedded\s+chatbot|chat\s+widget|conversational\s+ui)\b/i, id: 'data.embedded_chatbot', weight: 0.90 },
  { pattern: /\b(?:ml\s+pipelines?|machine\s+learning|model\s+training|scikit)\b/i, id: 'data.ml_pipelines', weight: 0.90 },
  { pattern: /\b(?:nl[\s-]to[\s-]sql|natural\s+language\s+to\s+sql|text\s+to\s+sql)\b/i, id: 'data.nl_to_sql', weight: 0.95 },
  { pattern: /\b(?:vector\s+db|vector\s+database|chroma|pinecone|faiss|embeddings?)\b/i, id: 'data.vector_db', weight: 0.92 },
  { pattern: /\b(?:rag|retrieval\s+augmented|knowledge\s+base|llamaindex)\b/i, id: 'data.rag', weight: 0.95 },
  { pattern: /\b(?:pdf\s+report|generate\s+pdf|pdf\s+generation|download\s+pdf)\b/i, id: 'data.pdf_report_generation', weight: 0.92 },

  // Category 9: UX & Transparency (9)
  { pattern: /\b(?:live\s+preview|browser\s+preview|sandboxed\s+preview|iframe\s+preview)\b/i, id: 'ux.live_preview', weight: 0.90 },
  { pattern: /\b(?:interactive\s+terminal|web\s+terminal|xterm|terminal\s+emulator)\b/i, id: 'ux.interactive_terminal', weight: 0.90 },
  { pattern: /\b(?:architecture\s+decision|explain\s+decision|why\s+did\s+agent)\b/i, id: 'ux.architecture_decision_explanation', weight: 0.88 },
  { pattern: /\b(?:omnichannel|telegram\s+bot|mobile\s+companion)\b/i, id: 'ux.omnichannel_input', weight: 0.90 },
  { pattern: /\b(?:seamless\s+rollback|revert\s+changes?|undo\s+action|restore\s+checkpoint)\b/i, id: 'ux.seamless_rollback', weight: 0.92 },
  { pattern: /\b(?:step[\s-]by[\s-]step\s+approval|plan\s+approval|human\s+gate)\b/i, id: 'ux.step_by_step_approval', weight: 0.90 },
  { pattern: /\b(?:capability\s+honesty|unsupported\s+feature|honest\s+boundary)\b/i, id: 'ux.capability_honesty', weight: 0.88 },
  { pattern: /\b(?:multilingual|hinglish\s+support|hindi\s+language)\b/i, id: 'ux.multilingual', weight: 0.90 },
  { pattern: /\b(?:export\s+workspace|download\s+zip|export\s+project\s+zip)\b/i, id: 'ux.exportable_workspace', weight: 0.92 }
]);

// Ambiguous query patterns that lack clarifying qualifiers
const AMBIGUOUS_PATTERNS = Object.freeze([
  {
    pattern: /^(?:deploy|deploy\s+my\s+app|deployment|host\s+my\s+app|how\s+to\s+deploy)$/i,
    candidates: [
      'devops.cloud_deployment',
      'devops.docker',
      'devops.serverless_function_setup',
      'devops.ssl_automation'
    ]
  },
  {
    pattern: /^(?:backup|backup\s+my\s+app|save\s+app|backup\s+data)$/i,
    candidates: [
      'coding.git_operations',
      'ux.exportable_workspace',
      'ux.seamless_rollback'
    ]
  },
  {
    pattern: /^(?:optimize|speed\s+up|make\s+faster)$/i,
    candidates: [
      'performance.resource_optimization',
      'performance.caching',
      'performance.incremental_updates'
    ]
  },
  {
    pattern: /^(?:security|secure\s+my\s+app|protect)$/i,
    candidates: [
      'security.cors',
      'security.sql_injection',
      'security.xss',
      'security.rate_limiting'
    ]
  }
]);

class CapabilityDiscovery {
  constructor(registry = capabilityRegistry) {
    this.registry = registry;
    this._exactIdMap = new Map();
    this._exactNameMap = new Map();
    this._initLookupTables();
  }

  _initLookupTables() {
    for (const cap of this.registry.getAllCapabilities()) {
      this._exactIdMap.set(cap.capability_id.toLowerCase(), cap.capability_id);
      this._exactNameMap.set(cap.name.toLowerCase(), cap.capability_id);
    }
  }

  /**
   * Discover capabilities matching user request.
   * 
   * @param {string} prompt - Natural language request
   * @param {object} [options] - Discovery options (requestId, runtimeContext, maxMatches)
   * @returns {object} Machine-readable discovery result contract
   */
  discover(prompt, options = {}) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const requestId = options.requestId || null;
    const runtimeContext = options.runtimeContext || {};

    // 1. Handle empty / invalid input gracefully
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      return deepFreeze({
        request_id: requestId,
        matched: [],
        dependencies: [],
        required_skills: [],
        required_tools: [],
        unavailable_capabilities: [],
        ambiguous: false,
        unresolved_intent: true,
        duration_ms: Math.round(durationMs * 100) / 100
      });
    }

    const cleanPrompt = prompt.trim();
    const lowerPrompt = cleanPrompt.toLowerCase();

    // 2. Check for ambiguous intents first
    for (const amb of AMBIGUOUS_PATTERNS) {
      if (amb.pattern.test(lowerPrompt)) {
        const candidateCaps = amb.candidates
          .map(id => this.registry.getCapability(id))
          .filter(Boolean);

        const matched = candidateCaps.map(cap => ({
          capability_id: cap.capability_id,
          confidence: 0.5,
          match_type: MATCH_TYPE.KEYWORD,
          status: cap.status
        }));

        const dependencies = this.resolveDependencies(candidateCaps.map(c => c.capability_id));
        const allIds = [...candidateCaps.map(c => c.capability_id), ...dependencies];
        const skills = this.getRequiredSkills(allIds);
        const tools = this.getRequiredTools(allIds);
        const unavailable = this._collectUnavailable(allIds, runtimeContext);

        const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
        return deepFreeze({
          request_id: requestId,
          matched,
          dependencies,
          required_skills: skills,
          required_tools: tools,
          unavailable_capabilities: unavailable,
          ambiguous: true,
          unresolved_intent: false,
          duration_ms: Math.round(durationMs * 100) / 100
        });
      }
    }

    // 3. Exact Capability ID Match (Confidence: 1.0)
    if (this._exactIdMap.has(lowerPrompt)) {
      const capId = this._exactIdMap.get(lowerPrompt);
      const cap = this.registry.getCapability(capId);
      const dependencies = this.resolveDependencies([capId]);
      const allIds = [capId, ...dependencies];
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

      return deepFreeze({
        request_id: requestId,
        matched: [
          {
            capability_id: cap.capability_id,
            confidence: 1.0,
            match_type: MATCH_TYPE.EXACT,
            status: cap.status
          }
        ],
        dependencies,
        required_skills: this.getRequiredSkills(allIds),
        required_tools: this.getRequiredTools(allIds),
        unavailable_capabilities: this._collectUnavailable(allIds, runtimeContext),
        ambiguous: false,
        unresolved_intent: false,
        duration_ms: Math.round(durationMs * 100) / 100
      });
    }

    // 4. Exact Canonical Name Match (Confidence: 1.0)
    if (this._exactNameMap.has(lowerPrompt)) {
      const capId = this._exactNameMap.get(lowerPrompt);
      const cap = this.registry.getCapability(capId);
      const dependencies = this.resolveDependencies([capId]);
      const allIds = [capId, ...dependencies];
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

      return deepFreeze({
        request_id: requestId,
        matched: [
          {
            capability_id: cap.capability_id,
            confidence: 1.0,
            match_type: MATCH_TYPE.EXACT,
            status: cap.status
          }
        ],
        dependencies,
        required_skills: this.getRequiredSkills(allIds),
        required_tools: this.getRequiredTools(allIds),
        unavailable_capabilities: this._collectUnavailable(allIds, runtimeContext),
        ambiguous: false,
        unresolved_intent: false,
        duration_ms: Math.round(durationMs * 100) / 100
      });
    }

    // 5. Multi-clause & Keyword / Alias Matching
    const clauses = this._decomposeClauses(cleanPrompt);
    const matchedMap = new Map(); // capId -> { capability_id, confidence, match_type, status }

    for (const clause of clauses) {
      const clauseMatches = this._matchSingleClause(clause);
      for (const m of clauseMatches) {
        if (!matchedMap.has(m.capability_id) || matchedMap.get(m.capability_id).confidence < m.confidence) {
          matchedMap.set(m.capability_id, m);
        }
      }
    }

    // If whole prompt matching yields stronger or additional signals, merge them
    const wholeMatches = this._matchSingleClause(cleanPrompt);
    for (const m of wholeMatches) {
      if (!matchedMap.has(m.capability_id) || matchedMap.get(m.capability_id).confidence < m.confidence) {
        matchedMap.set(m.capability_id, m);
      }
    }

    const matchedList = Array.from(matchedMap.values());

    // 6. Handle No Matches (Fallback)
    if (matchedList.length === 0) {
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      return deepFreeze({
        request_id: requestId,
        matched: [],
        dependencies: [],
        required_skills: [],
        required_tools: [],
        unavailable_capabilities: [],
        ambiguous: false,
        unresolved_intent: true,
        duration_ms: Math.round(durationMs * 100) / 100
      });
    }

    // Sort matched by confidence descending, then alphabetically by capability_id for stability
    matchedList.sort((a, b) => b.confidence - a.confidence || a.capability_id.localeCompare(b.capability_id));

    // 7. Resolve transitive dependencies across all matched capabilities
    const matchedIds = matchedList.map(m => m.capability_id);
    const dependencies = this.resolveDependencies(matchedIds);

    // 8. Gather all required skills and tools
    const allIds = [...matchedIds, ...dependencies];
    const skills = this.getRequiredSkills(allIds);
    const tools = this.getRequiredTools(allIds);
    const unavailable = this._collectUnavailable(allIds, runtimeContext);

    const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;

    return deepFreeze({
      request_id: requestId,
      matched: matchedList,
      dependencies,
      required_skills: skills,
      required_tools: tools,
      unavailable_capabilities: unavailable,
      ambiguous: false,
      unresolved_intent: false,
      duration_ms: Math.round(durationMs * 100) / 100
    });
  }

  /**
   * Split a prompt into logical sub-clauses for multi-capability detection.
   */
  _decomposeClauses(prompt) {
    const rawParts = prompt.split(/(?:,\s*|\s+(?:and|with|plus|including|along\s+with|as\s+well\s+as)\s+|;\s*)/i);
    const result = [];
    for (const p of rawParts) {
      // Strip leading/trailing punctuation and trim
      const trimmed = p.replace(/^[\s,.;:!?]+|[\s,.;:!?]+$/g, '').trim();
      if (trimmed.length > 1) {
        result.push(trimmed);
      }
    }
    return result.length > 0 ? result : [prompt.trim()];
  }

  /**
   * Match a single clause against registry intent aliases and keyword patterns.
   */
  _matchSingleClause(clause) {
    const lower = clause.toLowerCase().replace(/^[\s,.;:!?]+|[\s,.;:!?]+$/g, '').trim();
    if (!lower) return [];

    const matches = [];
    const seen = new Set();

    // Direct check if clause is exact ID or exact name
    if (this._exactIdMap.has(lower)) {
      const id = this._exactIdMap.get(lower);
      seen.add(id);
      matches.push({
        capability_id: id,
        confidence: 1.0,
        match_type: MATCH_TYPE.EXACT,
        status: this.registry.getCapability(id).status
      });
      return matches;
    }

    if (this._exactNameMap.has(lower)) {
      const id = this._exactNameMap.get(lower);
      seen.add(id);
      matches.push({
        capability_id: id,
        confidence: 1.0,
        match_type: MATCH_TYPE.EXACT,
        status: this.registry.getCapability(id).status
      });
      return matches;
    }

    // Check registry intent aliases (support plural/stemming: e.g. "test" matches "tests")
    const aliases = this.registry.getIntentAliases ? this.registry.getIntentAliases() : {};
    for (const [alias, capId] of Object.entries(aliases)) {
      if (seen.has(capId)) continue;
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|\\b)${escaped}s?(?:\\b|$)`, 'i');
      if (regex.test(lower)) {
        seen.add(capId);
        const cap = this.registry.getCapability(capId);
        if (cap) {
          matches.push({
            capability_id: capId,
            confidence: 0.95,
            match_type: MATCH_TYPE.ALIAS,
            status: cap.status
          });
        }
      }
    }

    // Check extended keyword patterns
    for (const item of EXTENDED_KEYWORD_PATTERNS) {
      if (seen.has(item.id)) continue;
      if (item.pattern.test(lower)) {
        seen.add(item.id);
        const cap = this.registry.getCapability(item.id);
        if (cap) {
          matches.push({
            capability_id: item.id,
            confidence: item.weight,
            match_type: MATCH_TYPE.KEYWORD,
            status: cap.status
          });
        }
      }
    }

    return matches;
  }

  /**
   * Resolves direct and transitive dependencies for given capability IDs.
   * Preserves deterministic order, deduplicates, and excludes initial capability IDs.
   * 
   * @param {string[]} capabilityIds 
   * @returns {string[]} Deterministic transitive dependencies
   */
  resolveDependencies(capabilityIds) {
    if (!Array.isArray(capabilityIds)) return [];

    const rootSet = new Set(capabilityIds);
    const resolved = [];
    const visited = new Set();

    const traverse = (id) => {
      const cap = this.registry.getCapability(id);
      if (!cap) return;
      const directDeps = cap.dependencies || [];
      for (const depId of directDeps) {
        if (!visited.has(depId)) {
          visited.add(depId);
          traverse(depId);
          if (!rootSet.has(depId) && !resolved.includes(depId)) {
            resolved.push(depId);
          }
        }
      }
    };

    for (const id of capabilityIds) {
      traverse(id);
    }

    return resolved;
  }

  /**
   * Gather unique required skills across specified capability IDs.
   * 
   * @param {string[]} capabilityIds 
   * @returns {string[]}
   */
  getRequiredSkills(capabilityIds) {
    if (!Array.isArray(capabilityIds)) return [];
    const skills = new Set();
    for (const id of capabilityIds) {
      const cap = this.registry.getCapability(id);
      if (cap && Array.isArray(cap.required_skills)) {
        for (const skill of cap.required_skills) {
          if (skill && typeof skill === 'string') {
            skills.add(skill);
          }
        }
      }
    }
    return Array.from(skills).sort();
  }

  /**
   * Gather unique required tools across specified capability IDs.
   * 
   * @param {string[]} capabilityIds 
   * @returns {string[]}
   */
  getRequiredTools(capabilityIds) {
    if (!Array.isArray(capabilityIds)) return [];
    const tools = new Set();
    for (const id of capabilityIds) {
      const cap = this.registry.getCapability(id);
      if (cap && Array.isArray(cap.required_tools)) {
        for (const tool of cap.required_tools) {
          if (tool && typeof tool === 'string') {
            tools.add(tool);
          }
        }
      }
    }
    return Array.from(tools).sort();
  }

  /**
   * Check availability and collect capabilities that are not currently AVAILABLE.
   */
  _collectUnavailable(capabilityIds, runtimeContext = {}) {
    const unavailable = [];
    for (const id of capabilityIds) {
      const status = this.registry.isAvailable(id, runtimeContext);
      if (status !== AVAILABILITY.AVAILABLE) {
        unavailable.push(id);
      }
    }
    return unavailable;
  }
}

// Export singleton instance + class + constants
const capabilityDiscovery = new CapabilityDiscovery();

module.exports = {
  CapabilityDiscovery,
  capabilityDiscovery,
  MATCH_TYPE
};
