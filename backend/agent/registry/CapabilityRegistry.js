'use strict';

/**
 * AI-Dost 2.0 — Canonical Capability Registry
 * 
 * Machine-readable, declarative, immutable capability registry containing
 * all 83 audited canonical capabilities across 9 operational domains.
 * 
 * Operates strictly offline without database or external network lookups.
 */

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

const STATUS = Object.freeze({
  IMPLEMENTED: 'IMPLEMENTED',
  PARTIAL: 'PARTIAL',
  EXPERIMENTAL: 'EXPERIMENTAL',
  FOUNDATION_ONLY: 'FOUNDATION_ONLY',
  MISSING: 'MISSING'
});

const RISK = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

const APPROVAL = Object.freeze({
  AUTO: 'AUTO',
  CONFIRM: 'CONFIRM',
  EXPLICIT_APPROVAL: 'EXPLICIT_APPROVAL',
  BLOCK: 'BLOCK'
});

const COST = Object.freeze({
  ZERO_API: 'ZERO_API',
  LOW_TOKEN: 'LOW_TOKEN',
  STANDARD: 'STANDARD',
  EXPENSIVE: 'EXPENSIVE'
});

const CATEGORIES = Object.freeze({
  CATEGORY_1: 'CODING_SOFTWARE_ENGINEERING',
  CATEGORY_2: 'UI_UX_VISUAL_DESIGN',
  CATEGORY_3: 'DEVOPS_EXECUTION',
  CATEGORY_4: 'AUTONOMY_AGENTIC_LOGIC',
  CATEGORY_5: 'PERFORMANCE_COST',
  CATEGORY_6: 'SAAS_BUSINESS',
  CATEGORY_7: 'SECURITY_PRIVACY',
  CATEGORY_8: 'DATA_ADVANCED_AI',
  CATEGORY_9: 'UX_TRANSPARENCY'
});

const AVAILABILITY = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  REQUIRES_CONFIGURATION: 'REQUIRES_CONFIGURATION',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED'
});

const RAW_CAPABILITIES = [
  // ==========================================
  // CATEGORY 1 — CODING & SOFTWARE ENGINEERING (12)
  // [1: PARTIAL, 2: IMPL, 3: PARTIAL, 4: IMPL, 5: PARTIAL, 6: IMPL, 
  //  7: IMPL, 8: FOUNDATION_ONLY, 9: PARTIAL, 10: IMPL, 11: IMPL, 12: PARTIAL]
  // ==========================================
  {
    capability_id: 'coding.full_stack_delivery',
    category: CATEGORIES.CATEGORY_1,
    name: '1-Click Full-Stack Delivery',
    description: 'Autonomous generation and scaffold of end-to-end frontend and backend projects from single prompt',
    status: STATUS.PARTIAL,
    required_skills: ['fullstack-scaffold', 'project-generator'],
    required_tools: ['CodeTool', 'WriteTool', 'TerminalTool'],
    required_permissions: ['workspace:write', 'terminal:execute'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 4096, require_compression: true },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'template_fallback',
    dependencies: ['coding.production_code', 'devops.terminal'],
    supported_inputs: ['text/prompt', 'application/json'],
    supported_outputs: ['filesystem/directory', 'application/zip'],
    implementation: {
      service: 'routes/agent.js (generate_project_from_prompt)',
      module: 'backend/services/plannerService.js',
      entrypoint: 'plannerService.specToPlan'
    },
    requires_code_diff_gate: true,
    gap_notes: 'React+Vite and Express template scaffolding operational; dynamic Next.js App Router/Astro selection requires multi-framework wiring.'
  },
  {
    capability_id: 'coding.production_code',
    category: CATEGORIES.CATEGORY_1,
    name: 'Production-Ready Code Synthesis',
    description: 'Deterministic code synthesis adhering to clean syntax, security guards, and error handling',
    status: STATUS.IMPLEMENTED,
    required_skills: ['clean-code', 'error-handling'],
    required_tools: ['CodeTool', 'DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 3000, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'exact_replace -> fuzz_replace',
    dependencies: ['security.sql_injection', 'security.xss'],
    supported_inputs: ['text/plain', 'text/javascript', 'text/typescript'],
    supported_outputs: ['text/javascript', 'text/typescript', 'text/html'],
    implementation: {
      service: 'backend/services/DeterministicCodeGuard.js',
      module: 'backend/services/verifierService.js',
      entrypoint: 'verifierService.verifyCode'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'coding.legacy_refactoring',
    category: CATEGORIES.CATEGORY_1,
    name: 'Legacy Code Refactoring',
    description: 'Safe modernization, clean-up, and structural refactoring of legacy codebases using AST analysis',
    status: STATUS.PARTIAL,
    required_skills: ['ast-refactor', 'code-modernization'],
    required_tools: ['DiffEngineTool', 'ReadTool'],
    required_permissions: ['workspace:read', 'workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 7000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'unified_diff_rollback',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/plain', 'text/javascript'],
    supported_outputs: ['text/javascript', 'application/json'],
    implementation: {
      service: 'backend/services/astService.js',
      module: 'backend/agent/diffEngine.js',
      entrypoint: 'diffEngine.applyPatch'
    },
    requires_code_diff_gate: true,
    gap_notes: 'AST parsing heuristics in astService and surgical DiffEngine search/replace exist; automated multi-file dependency graph transformation rules need expansion.'
  },
  {
    capability_id: 'coding.automated_bug_resolution',
    category: CATEGORIES.CATEGORY_1,
    name: 'Automated Bug Resolution',
    description: 'Terminal error log analysis with 3-tier self-healing iterative code repair',
    status: STATUS.IMPLEMENTED,
    required_skills: ['error-debugging', 'stacktrace-repair'],
    required_tools: ['DiffEngineTool', 'TerminalTool', 'ReadTool'],
    required_permissions: ['workspace:write', 'terminal:execute'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 2048, require_compression: true },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'retry_tier_escalation',
    dependencies: ['coding.production_code', 'devops.terminal'],
    supported_inputs: ['text/log', 'application/json'],
    supported_outputs: ['text/patch', 'text/plain'],
    implementation: {
      service: 'backend/routes/agent.js',
      module: 'backend/agent/visualRepair.js',
      entrypoint: 'agent.terminalHealLoop'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'coding.zero_knowledge_architecture',
    category: CATEGORIES.CATEGORY_1,
    name: 'Zero-Knowledge Architecture',
    description: '100% local, offline code synthesis and storage without cloud leakage or external data transmission',
    status: STATUS.PARTIAL,
    required_skills: ['local-ai-operations'],
    required_tools: ['ReadTool', 'WriteTool'],
    required_permissions: ['workspace:read', 'workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4096, max_output_tokens: 2048, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'local_ollama_only',
    dependencies: ['performance.offline_ai'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/services/ollamaService.js',
      module: 'backend/agent/tools/CodeTool.js',
      entrypoint: 'ollamaService.call'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Ollama local models and local SQLite DAOs operational; hard architectural toggle preventing cloud cascade fallback needs explicit enforcement.'
  },
  {
    capability_id: 'coding.git_operations',
    category: CATEGORIES.CATEGORY_1,
    name: 'Git Operations Integration',
    description: '100% offline local Git version control, branch management, commit generation, and rollback',
    status: STATUS.IMPLEMENTED,
    required_skills: ['git-management'],
    required_tools: ['GitTool'],
    required_permissions: ['git:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'git_checkout_head',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/routes/git.js',
      module: 'backend/agent/tools/GitTool.js',
      entrypoint: 'GitTool.execute'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'coding.multi_file_context',
    category: CATEGORIES.CATEGORY_1,
    name: 'Multi-File Context Awareness',
    description: 'Codebase indexing, semantic symbol search, and budget-aware multi-file context trimming',
    status: STATUS.IMPLEMENTED,
    required_skills: ['codebase-indexing'],
    required_tools: ['ReadTool'],
    required_permissions: ['workspace:read'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 12000, max_output_tokens: 4096, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'tfidf_fallback',
    dependencies: [],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/services/contextRetriever.js',
      module: 'backend/agent/codebaseIndexer.js',
      entrypoint: 'contextRetriever.retrieveContext'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'coding.api_integration',
    category: CATEGORIES.CATEGORY_1,
    name: 'API Integration Automation',
    description: 'Automated synthesis of typed REST/GraphQL API integration clients from OpenAPI specs',
    status: STATUS.FOUNDATION_ONLY,
    required_skills: ['api-client-generator'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'mock_api_fallback',
    dependencies: ['coding.production_code'],
    supported_inputs: ['application/json', 'text/yaml'],
    supported_outputs: ['text/javascript', 'text/typescript'],
    implementation: {
      service: 'backend/services/specService.js',
      module: 'backend/agent/tools/CodeTool.js',
      entrypoint: 'specService.suggestApiIntegrations'
    },
    requires_code_diff_gate: true,
    gap_notes: 'specService detects API integration patterns; automated Swagger/OpenAPI parsing to typed client generator is missing.'
  },
  {
    capability_id: 'coding.database_schema_generation',
    category: CATEGORIES.CATEGORY_1,
    name: 'Database Schema Generation',
    description: 'Relational database schema modeling, table migration generation, and foreign key relations',
    status: STATUS.PARTIAL,
    required_skills: ['schema-design', 'sql-migrations'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 5000, max_output_tokens: 2048, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'sqlite_ddl_fallback',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['text/x-sql', 'text/javascript'],
    implementation: {
      service: 'backend/routes/database.js',
      module: 'backend/services/specService.js',
      entrypoint: 'database.generateSchema'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Relational SQLite query execution and spec schema design exist; automated multi-database (Postgres/MySQL) migration generator needs scaffolding.'
  },
  {
    capability_id: 'coding.linting_formatting',
    category: CATEGORIES.CATEGORY_1,
    name: 'Linting & Formatting',
    description: 'Programmatic syntax linting, Prettier/ESLint rule enforcement, and AST format guards',
    status: STATUS.IMPLEMENTED,
    required_skills: ['code-linting'],
    required_tools: ['DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'LINT_CHECK',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'raw_code_retain',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/javascript', 'text/typescript'],
    supported_outputs: ['text/javascript', 'text/typescript'],
    implementation: {
      service: 'backend/services/verifierService.js',
      module: 'backend/agent/diffEngine.js',
      entrypoint: 'verifierService.verifyCode'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'coding.code_explanation',
    category: CATEGORIES.CATEGORY_1,
    name: 'Code Explanation',
    description: 'Context-rich, step-by-step structural explanation and algorithmic documentation',
    status: STATUS.IMPLEMENTED,
    required_skills: ['code-explanation'],
    required_tools: ['ReadTool'],
    required_permissions: ['workspace:read'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 2048, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'high_level_summary',
    dependencies: [],
    supported_inputs: ['text/plain', 'text/javascript'],
    supported_outputs: ['text/markdown'],
    implementation: {
      service: 'backend/routes/chat.js',
      module: 'backend/agent/tools/CodeTool.js',
      entrypoint: 'chat.streamResponse'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'coding.test_case_generation',
    category: CATEGORIES.CATEGORY_1,
    name: 'Test Case Generation',
    description: 'Automated synthesis of unit and integration test suites from source code contracts',
    status: STATUS.PARTIAL,
    required_skills: ['test-synthesis', 'jest-runner'],
    required_tools: ['CodeTool', 'WriteTool', 'TerminalTool'],
    required_permissions: ['workspace:write', 'terminal:execute'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 3000, require_compression: true },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'test_skip',
    dependencies: ['coding.production_code', 'devops.terminal'],
    supported_inputs: ['text/javascript', 'text/typescript'],
    supported_outputs: ['text/javascript', 'text/typescript'],
    implementation: {
      service: 'backend/routes/agent.js',
      module: 'backend/services/verifierService.js',
      entrypoint: 'agent.runTests'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Test runner execution (npm test) and Jest parser operational; autonomous synthesis of test cases for arbitrary input code requires template generator.'
  },

  // ==========================================
  // CATEGORY 2 — UI/UX & VISUAL DESIGN (11)
  // [13: IMPL, 14: IMPL, 15: IMPL, 16: IMPL, 17: IMPL, 18: IMPL, 19: IMPL, 20: PARTIAL, 21: IMPL, 22: PARTIAL, 23: IMPL]
  // ==========================================
  {
    capability_id: 'ui.pixel_perfect',
    category: CATEGORIES.CATEGORY_2,
    name: 'Pixel-Perfect UI Generation',
    description: 'Precision component styling with curated color systems, modern glassmorphism, and balanced layouts',
    status: STATUS.IMPLEMENTED,
    required_skills: ['modern-web-styling'],
    required_tools: ['WriteTool', 'DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 5000, max_output_tokens: 3000, require_compression: true },
    verification_policy: 'DOM_HEURISTIC',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'css_variable_reset',
    dependencies: ['ui.component_based_ui'],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['text/css', 'text/javascript'],
    implementation: {
      service: 'frontend/tailwind.config.js',
      module: 'frontend/components/views/CopilotIDE.jsx',
      entrypoint: 'CopilotIDE.render'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.responsive_design',
    category: CATEGORIES.CATEGORY_2,
    name: 'Responsive Design Engine',
    description: 'Adaptive multi-viewport layouts ensuring seamless mobile, tablet, and desktop fidelity',
    status: STATUS.IMPLEMENTED,
    required_skills: ['responsive-layout'],
    required_tools: ['DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'DOM_HEURISTIC',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'flex_wrap_fallback',
    dependencies: ['ui.pixel_perfect'],
    supported_inputs: ['text/css', 'text/javascript'],
    supported_outputs: ['text/css', 'text/javascript'],
    implementation: {
      service: 'frontend/components',
      module: 'frontend/utils/visualHealer.js',
      entrypoint: 'visualHealer.checkOverflow'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.tailwind_css_optimization',
    category: CATEGORIES.CATEGORY_2,
    name: 'Tailwind/CSS Optimization',
    description: 'PostCSS pipeline tree-shaking, minimal bundle footprints, and utility optimization',
    status: STATUS.IMPLEMENTED,
    required_skills: ['tailwind-optimization'],
    required_tools: ['DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'purge_css_default',
    dependencies: [],
    supported_inputs: ['text/css'],
    supported_outputs: ['text/css'],
    implementation: {
      service: 'frontend/postcss.config.mjs',
      module: 'frontend/tailwind.config.js',
      entrypoint: 'tailwind.compile'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.theme_switching',
    category: CATEGORIES.CATEGORY_2,
    name: 'Theme Switching Architecture',
    description: 'System-wide Dark/Light/Cyberpunk theme persistence with CSS token switching',
    status: STATUS.IMPLEMENTED,
    required_skills: ['theme-provider'],
    required_tools: ['WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'dark_theme_default',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'frontend/components/ThemeToggle.jsx',
      module: 'frontend/contexts/SocketContext.jsx',
      entrypoint: 'ThemeToggle.render'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ui.visual_bug_detection',
    category: CATEGORIES.CATEGORY_2,
    name: 'Visual Bug Detection & Auto-Healing',
    description: 'Zero-token client-side DOM inspection for layout clipping, z-index collisions, and Playwright vision escalation',
    status: STATUS.IMPLEMENTED,
    required_skills: ['visual-healer-rules'],
    required_tools: ['VisualVerifyTool', 'DiffEngineTool'],
    required_permissions: ['workspace:read', 'workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'DOM_HEURISTIC',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'client_dom_patch',
    dependencies: [],
    supported_inputs: ['text/html', 'image/png'],
    supported_outputs: ['application/json', 'text/patch'],
    implementation: {
      service: 'frontend/utils/visualHealer.js',
      module: 'backend/agent/tools/VisualVerifyTool.js',
      entrypoint: 'visualHealer.scanAndHeal'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.component_based_ui',
    category: CATEGORIES.CATEGORY_2,
    name: 'Component-Based UI Architecture',
    description: 'Decoupled, reusable React component architecture following design token standards',
    status: STATUS.IMPLEMENTED,
    required_skills: ['react-components'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 5000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'component_stub',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'frontend/components',
      module: 'frontend/app',
      entrypoint: 'React.Component'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.micro_animations',
    category: CATEGORIES.CATEGORY_2,
    name: 'Micro-Animations & Motion Design',
    description: 'Subtle interactive spring physics, pulse indicators, and layout transitions via Framer Motion',
    status: STATUS.IMPLEMENTED,
    required_skills: ['framer-motion-styling'],
    required_tools: ['DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'css_transition_fallback',
    dependencies: ['ui.component_based_ui'],
    supported_inputs: ['text/css', 'text/javascript'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'frontend/components/AICompanion.jsx',
      module: 'frontend/app/globals.css',
      entrypoint: 'framer-motion.motion'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.dynamic_chart_generation',
    category: CATEGORIES.CATEGORY_2,
    name: 'Dynamic Chart & Graph Generation',
    description: 'Autonomous data visualization rendering bar, line, and radar plots from datasets',
    status: STATUS.PARTIAL,
    required_skills: ['data-visualization'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'ascii_table_fallback',
    dependencies: ['ui.component_based_ui'],
    supported_inputs: ['application/json', 'text/csv'],
    supported_outputs: ['text/javascript', 'image/svg+xml'],
    implementation: {
      service: 'ai-engine/main.py',
      module: 'backend/agent/tools/McpTool.js',
      entrypoint: 'visualization.render_chart'
    },
    requires_code_diff_gate: true,
    gap_notes: 'MCP chart render tools and Python analytics exist; native in-chat Recharts/Chart.js synthesizer component needs frontend integration.'
  },
  {
    capability_id: 'ui.seo_friendly_layout',
    category: CATEGORIES.CATEGORY_2,
    name: 'SEO-Friendly Layout Engine',
    description: 'Static site generation, dynamic OpenGraph metadata, structured JSON-LD schema, and semantic tags',
    status: STATUS.IMPLEMENTED,
    required_skills: ['seo-metadata'],
    required_tools: ['WriteTool', 'DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'static_meta_fallback',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/html', 'text/javascript'],
    implementation: {
      service: 'frontend/app/layout.jsx',
      module: 'frontend/next.config.mjs',
      entrypoint: 'Next.Metadata'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'ui.asset_auto_loading',
    category: CATEGORIES.CATEGORY_2,
    name: 'Asset Auto-Loading & Media Delivery',
    description: 'Dynamic asset fetching, CDN optimization, and on-the-fly generative image placeholders',
    status: STATUS.PARTIAL,
    required_skills: ['asset-pipeline'],
    required_tools: ['ReadTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'svg_placeholder',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['image/png', 'image/webp'],
    implementation: {
      service: 'backend/routes/chat.js ([GENERATE_IMAGE])',
      module: 'frontend/public',
      entrypoint: 'pollinations.generate'
    },
    requires_code_diff_gate: false,
    gap_notes: 'Pollinations AI image generation hook works in chat; local image bundle optimizer pipeline is missing.'
  },
  {
    capability_id: 'ui.typography_hierarchy',
    category: CATEGORIES.CATEGORY_2,
    name: 'Typography Hierarchy Design',
    description: 'Self-hosted Google font variable integration ensuring readability, contrast, and scaling',
    status: STATUS.IMPLEMENTED,
    required_skills: ['typography-design'],
    required_tools: ['DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'system_fonts_fallback',
    dependencies: [],
    supported_inputs: ['text/css'],
    supported_outputs: ['text/css'],
    implementation: {
      service: 'frontend/app/layout.jsx',
      module: 'frontend/app/globals.css',
      entrypoint: 'next/font/google'
    },
    requires_code_diff_gate: true
  },

  // ==========================================
  // CATEGORY 3 — DEVOPS & EXECUTION (10)
  // [24: PARTIAL, 25: IMPL, 26: IMPL, 27: FOUNDATION_ONLY, 28: IMPL, 29: IMPL, 30: PARTIAL, 31: IMPL, 32: FOUNDATION_ONLY, 33: IMPL]
  // ==========================================
  {
    capability_id: 'devops.cloud_deployment',
    category: CATEGORIES.CATEGORY_3,
    name: '1-Click Cloud Deployment',
    description: 'Autonomous deployment of web apps to Vercel, Netlify, and Cloudflare Pages platforms',
    status: STATUS.PARTIAL,
    required_skills: ['cloud-deployment'],
    required_tools: ['TerminalTool'],
    required_permissions: ['network:external', 'terminal:execute'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 1500, require_compression: true },
    verification_policy: 'DEPLOYMENT_HEALTH_CHECK',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'static_export_fallback',
    dependencies: ['devops.terminal'],
    supported_inputs: ['application/json', 'text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/services/deployService.js',
      module: 'backend/routes/deploy.js',
      entrypoint: 'deployService.deploy'
    },
    requires_code_diff_gate: false,
    gap_notes: 'Adapter configs for Vercel, Netlify, and Cloudflare exist; interactive OAuth token authorization and custom domain binding need automation.'
  },
  {
    capability_id: 'devops.docker',
    category: CATEGORIES.CATEGORY_3,
    name: 'Docker Containerization Engine',
    description: 'Sandboxed Dockerode container lifecycle, volume isolation, and isolated dev execution',
    status: STATUS.IMPLEMENTED,
    required_skills: ['docker-management'],
    required_tools: ['TerminalTool'],
    required_permissions: ['docker:manage', 'terminal:execute'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'DOCKER_RESTORE',
    fallback_strategy: 'local_process_fallback',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/sandbox/SandboxManager.js',
      module: 'backend/sandbox/routes.js',
      entrypoint: 'SandboxManager.createSandbox'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'devops.terminal',
    category: CATEGORIES.CATEGORY_3,
    name: 'Local Terminal Control',
    description: 'Sanitized interactive PTY execution, ANSI terminal streaming, and background task management',
    status: STATUS.IMPLEMENTED,
    required_skills: ['terminal-operations'],
    required_tools: ['TerminalTool'],
    required_permissions: ['terminal:execute'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'process_kill',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain', 'text/log'],
    implementation: {
      service: 'backend/sockets/terminal.js',
      module: 'backend/agent/tools/TerminalTool.js',
      entrypoint: 'TerminalTool.execute'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'devops.ci_cd_pipeline',
    category: CATEGORIES.CATEGORY_3,
    name: 'CI/CD Pipeline Setup',
    description: 'Generation of automated GitHub Actions and GitLab CI multi-stage test and deploy pipelines',
    status: STATUS.FOUNDATION_ONLY,
    required_skills: ['ci-cd-authoring'],
    required_tools: ['WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'LINT_CHECK',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'minimal_ci_workflow',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/yaml'],
    implementation: {
      service: '.github/workflows/ci.yml',
      module: 'backend/agent/tools/WriteTool.js',
      entrypoint: 'WriteTool.execute'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Repository contains internal CI/CD config; automated generator for user project CI workflows is missing.'
  },
  {
    capability_id: 'devops.env_management',
    category: CATEGORIES.CATEGORY_3,
    name: 'Environment Variable Management',
    description: 'Deterministic .env schema validation, secret masking, and protected file traversal defense',
    status: STATUS.IMPLEMENTED,
    required_skills: ['env-security'],
    required_tools: ['ReadTool', 'WriteTool'],
    required_permissions: ['workspace:read', 'workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'dotenv_example_retain',
    dependencies: ['security.api_key_protection'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/services/pathSecurity.js',
      module: 'backend/routes/agent.js',
      entrypoint: 'pathSecurity.validateSafePath'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'devops.port_conflict_resolution',
    category: CATEGORIES.CATEGORY_3,
    name: 'Port Conflict Resolution',
    description: 'Dynamic TCP port probing and automated incremental port reassignment for dev servers',
    status: STATUS.IMPLEMENTED,
    required_skills: ['network-port-probing'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'random_ephemeral_port',
    dependencies: [],
    supported_inputs: ['number'],
    supported_outputs: ['number'],
    implementation: {
      service: 'backend/sandbox/devServerManager.js',
      module: 'backend/sandbox/SandboxManager.js',
      entrypoint: 'devServerManager.detectAvailablePort'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'devops.serverless_function_setup',
    category: CATEGORIES.CATEGORY_3,
    name: 'Serverless Function Setup',
    description: 'Scaffolding edge and serverless functions for AWS Lambda, Vercel Functions, and Cloudflare Workers',
    status: STATUS.PARTIAL,
    required_skills: ['serverless-architecture'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'express_route_fallback',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'backend/services/deployService.js',
      module: 'backend/agent/tools/CodeTool.js',
      entrypoint: 'deployService.configureServerless'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Vercel serverless routing config exists; standalone AWS Lambda / Cloudflare Workers export adapter is incomplete.'
  },
  {
    capability_id: 'devops.log_analysis',
    category: CATEGORIES.CATEGORY_3,
    name: 'Log Analysis & Diagnostic Interceptor',
    description: 'Real-time terminal log parsing, stacktrace deobfuscation, and automated error categorization',
    status: STATUS.IMPLEMENTED,
    required_skills: ['log-diagnostics'],
    required_tools: ['ReadTool'],
    required_permissions: ['workspace:read'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'raw_log_dump',
    dependencies: [],
    supported_inputs: ['text/log', 'text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/diagnostics/DiagnosticManager.js',
      module: 'backend/routes/agent.js',
      entrypoint: 'DiagnosticManager.analyzeLogs'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'devops.ssl_automation',
    category: CATEGORIES.CATEGORY_3,
    name: 'SSL Certificate Automation',
    description: 'Let’s Encrypt automated certificate provisioning, renewal, and HTTPS enforcement',
    status: STATUS.FOUNDATION_ONLY,
    required_skills: ['ssl-provisioning'],
    required_tools: ['TerminalTool'],
    required_permissions: ['network:external', 'terminal:execute'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'DEPLOYMENT_HEALTH_CHECK',
    rollback_policy: 'NONE',
    fallback_strategy: 'self_signed_cert',
    dependencies: ['devops.terminal'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/server.js',
      module: 'backend/services/pathSecurity.js',
      entrypoint: 'pathSecurity.blockCertLeak'
    },
    requires_code_diff_gate: false,
    gap_notes: 'Server hooks for HTTPS exist in server.js; automated ACME/Certbot provisioning client is missing.'
  },
  {
    capability_id: 'devops.cron_job_setup',
    category: CATEGORIES.CATEGORY_3,
    name: 'Cron Job Setup & Scheduling',
    description: 'Autonomous background job scheduling, recurring cron triggers, and file system watchers',
    status: STATUS.IMPLEMENTED,
    required_skills: ['cron-scheduling'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'interval_fallback',
    dependencies: [],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/services/workflowEngine.js',
      module: 'backend/services/workflowEngine.js',
      entrypoint: 'workflowEngine.start'
    },
    requires_code_diff_gate: false
  },

  // ==========================================
  // CATEGORY 4 — AUTONOMY & AGENTIC LOGIC (9)
  // [34 to 42: ALL 9 IMPLEMENTED]
  // ==========================================
  {
    capability_id: 'autonomy.self_correction',
    category: CATEGORIES.CATEGORY_4,
    name: 'Autonomous Self-Correction Loops',
    description: 'Closed-loop failure analysis with iterative code regeneration, diff repair, and verification feedback',
    status: STATUS.IMPLEMENTED,
    required_skills: ['self-correction-loop'],
    required_tools: ['DiffEngineTool', 'TerminalTool'],
    required_permissions: ['workspace:write', 'terminal:execute'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 3000, require_compression: true },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'abort_and_revert',
    dependencies: ['coding.production_code', 'devops.terminal'],
    supported_inputs: ['text/log', 'application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/routes/agent.js',
      module: 'backend/agent/diffEngine.js',
      entrypoint: 'agent.runAutonomousLoop'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'autonomy.multi_agent',
    category: CATEGORIES.CATEGORY_4,
    name: 'Multi-Agent Collaboration Architecture',
    description: 'Hierarchical multi-agent delegation across Planner, Coder, Verifier, and Supervisor roles',
    status: STATUS.IMPLEMENTED,
    required_skills: ['agent-coordination'],
    required_tools: ['CodeTool', 'ReadTool'],
    required_permissions: ['orchestration:manage'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 4000, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'single_agent_fallback',
    dependencies: ['autonomy.task_prioritization'],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/runtime/AgentCoordinator.js',
      module: 'backend/agent/runtime/Supervisor.js',
      entrypoint: 'AgentCoordinator.dispatchTask'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.memory',
    category: CATEGORIES.CATEGORY_4,
    name: 'Long-Term Memory & User Learning',
    description: 'Cross-session memory persistence in SQLite, semantic correction learning (/correct), and recall',
    status: STATUS.IMPLEMENTED,
    required_skills: ['memory-management'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'ephemeral_context_only',
    dependencies: [],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/services/memoryService.js',
      module: 'backend/services/telegramBot.js',
      entrypoint: 'memoryService.retrieveMemory'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.conflict_resolution',
    category: CATEGORIES.CATEGORY_4,
    name: 'Causal Conflict Resolution & Arbitration',
    description: 'Causal version vector conflict detection, immutable snapshot arbitration, and deterministic 3-way merge',
    status: STATUS.IMPLEMENTED,
    required_skills: ['arbitration-protocol'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'manual_conflict_prompt',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/arbitration/ArbitratorAgent.js',
      module: 'backend/agent/arbitration/ArbitratorAgent.js',
      entrypoint: 'ArbitratorAgent.judge'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.task_prioritization',
    category: CATEGORIES.CATEGORY_4,
    name: 'DAG Task Prioritization & Scheduling',
    description: 'Topological Directed Acyclic Graph (DAG) task scheduling, dependency resolution, and cycle detection',
    status: STATUS.IMPLEMENTED,
    required_skills: ['dag-scheduling'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'linear_queue_fallback',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/concurrency/TaskScheduler.js',
      module: 'backend/agent/concurrency/TaskScheduler.js',
      entrypoint: 'TaskScheduler.scheduleDAG'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.web_acquisition',
    category: CATEGORIES.CATEGORY_4,
    name: 'Autonomous Web & Data Acquisition',
    description: 'Multi-source Tavily web search, content scraping, fact synthesis, and citation generation',
    status: STATUS.IMPLEMENTED,
    required_skills: ['web-research'],
    required_tools: ['ReadTool'],
    required_permissions: ['network:external'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 3000, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'offline_knowledge_fallback',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['application/json', 'text/markdown'],
    implementation: {
      service: 'backend/services/researchService.js',
      module: 'ai-engine/main.py',
      entrypoint: 'researchService.deepResearch'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.user_in_the_loop',
    category: CATEGORIES.CATEGORY_4,
    name: 'User-in-the-Loop Interruption Engine',
    description: 'SSE stream cancellation, interactive pause/resume triggers, and human confirmation checkpoints',
    status: STATUS.IMPLEMENTED,
    required_skills: ['interactive-control'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'immediate_halt',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/routes/agent.js',
      module: 'frontend/components/KanbanBoard.jsx',
      entrypoint: 'agent.handleAbort'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.predictive_diagnostics',
    category: CATEGORIES.CATEGORY_4,
    name: 'Predictive System Diagnostics',
    description: 'Proactive CPU, memory, socket handle leak detection, and provider quota exhaustion monitoring',
    status: STATUS.IMPLEMENTED,
    required_skills: ['system-diagnostics'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'status_ok_default',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/diagnostics/DiagnosticManager.js',
      module: 'backend/agent/diagnostics/DiagnosticManager.js',
      entrypoint: 'DiagnosticManager.runDiagnostics'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'autonomy.dynamic_policy_adaptation',
    category: CATEGORIES.CATEGORY_4,
    name: 'Dynamic Policy Adaptation & Guard',
    description: 'Adaptive role capability enforcement and deterministic AST forbidden pattern interception',
    status: STATUS.IMPLEMENTED,
    required_skills: ['policy-enforcement'],
    required_tools: [],
    required_permissions: ['orchestration:manage'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'NONE',
    fallback_strategy: 'deny_by_default',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/policy/CapabilityPolicy.js',
      module: 'backend/services/DeterministicCodeGuard.js',
      entrypoint: 'CapabilityPolicy.isAllowed'
    },
    requires_code_diff_gate: false
  },

  // ==========================================
  // CATEGORY 5 — PERFORMANCE & COST (8)
  // [43 to 50: ALL 8 IMPLEMENTED]
  // ==========================================
  {
    capability_id: 'performance.zero_cost_strategy',
    category: CATEGORIES.CATEGORY_5,
    name: 'Zero/Low API Cost Strategy',
    description: 'Prioritized model racing across generous free tiers (Groq, Gemini Flash, Cerebras) and local Ollama',
    status: STATUS.IMPLEMENTED,
    required_skills: ['cost-optimization'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 4096, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'cascade_to_next_free_provider',
    dependencies: ['performance.model_routing'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/routes/chat.js',
      module: 'backend/services/groqService.js',
      entrypoint: 'chat.raceProviders'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'performance.token_compression',
    category: CATEGORIES.CATEGORY_5,
    name: 'Token Saving & Context Compression',
    description: 'Gzip compressed SQLite conversation store, budget clipping, and surgical unified diffs',
    status: STATUS.IMPLEMENTED,
    required_skills: ['context-compression'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 16000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'raw_string_store',
    dependencies: [],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['application/octet-stream', 'text/plain'],
    implementation: {
      service: 'backend/services/ContextCompressionStore.js',
      module: 'backend/services/contextRetriever.js',
      entrypoint: 'ContextCompressionStore.storeCompressed'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'performance.low_latency',
    category: CATEGORIES.CATEGORY_5,
    name: 'Low-Latency Execution Engine',
    description: 'Parallel model racing and edge streaming achieving sub-400ms time-to-first-token',
    status: STATUS.IMPLEMENTED,
    required_skills: ['streaming-response'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'standard_sync_stream',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/event-stream'],
    implementation: {
      service: 'backend/routes/chat.js',
      module: 'backend/services/groqService.js',
      entrypoint: 'chat.streamFast'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'performance.offline_ai',
    category: CATEGORIES.CATEGORY_5,
    name: 'Offline / Local AI Engine',
    description: 'Complete offline model inference using Ollama qwen2.5-coder with zero cloud egress',
    status: STATUS.IMPLEMENTED,
    required_skills: ['ollama-operations'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4096, max_output_tokens: 2048, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'mock_ai_response',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/services/ollamaService.js',
      module: 'backend/services/ollamaService.js',
      entrypoint: 'ollamaService.chat'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'performance.resource_optimization',
    category: CATEGORIES.CATEGORY_5,
    name: 'Resource Optimization & Auto-Cleanup',
    description: 'Automatic 30-minute idle container termination, unreferenced timers, and memory leak reclamation',
    status: STATUS.IMPLEMENTED,
    required_skills: ['resource-cleanup'],
    required_tools: [],
    required_permissions: ['docker:manage'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'gc_manual',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/sandbox/SandboxManager.js',
      module: 'backend/sandbox/wsServer.js',
      entrypoint: 'SandboxManager.cleanupIdleContainers'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'performance.caching',
    category: CATEGORIES.CATEGORY_5,
    name: 'Semantic Response Caching',
    description: 'SHA256 prompt hashing and circuit-breaker state caching preventing redundant API consumption',
    status: STATUS.IMPLEMENTED,
    required_skills: ['caching-strategies'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'cache_bypass',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/utils/apiClient.js',
      module: 'backend/routes/chat.js',
      entrypoint: 'apiClient.getCached'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'performance.incremental_updates',
    category: CATEGORIES.CATEGORY_5,
    name: 'Incremental Source Updates',
    description: 'Grade A Search/Replace block patching modifying only changed lines without regenerating whole files',
    status: STATUS.IMPLEMENTED,
    required_skills: ['diff-patching'],
    required_tools: ['DiffEngineTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 5000, max_output_tokens: 1500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'fuzz_patch_fallback',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/patch', 'text/plain'],
    supported_outputs: ['text/javascript', 'text/plain'],
    implementation: {
      service: 'backend/agent/diffEngine.js',
      module: 'backend/services/transactionManager.js',
      entrypoint: 'diffEngine.applyPatch'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'performance.model_routing',
    category: CATEGORIES.CATEGORY_5,
    name: 'Model Routing & Circuit Breaker Failover',
    description: 'Intelligent multi-model cascade with automated fallback across 10 distinct providers on 429/500 errors',
    status: STATUS.IMPLEMENTED,
    required_skills: ['provider-routing'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 4096, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'circuit_breaker_trip',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/services/geminiService.js',
      module: 'backend/utils/apiClient.js',
      entrypoint: 'geminiService.cascadeChat'
    },
    requires_code_diff_gate: false
  },

  // ==========================================
  // CATEGORY 6 — SAAS & BUSINESS (9)
  // [51: PARTIAL, 52: FOUNDATION_ONLY, 53: IMPL, 54: IMPL, 55: IMPL, 56: FOUNDATION_ONLY, 57: FOUNDATION_ONLY, 58: IMPL, 59: IMPL]
  // ==========================================
  {
    capability_id: 'saas.authentication',
    category: CATEGORIES.CATEGORY_6,
    name: 'Authentication Integration',
    description: 'User authentication scaffolding supporting JWT sessions, bcrypt password hashing, and cookie guards',
    status: STATUS.PARTIAL,
    required_skills: ['auth-scaffold'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 5000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'mock_session_fallback',
    dependencies: ['security.password_hashing', 'security.session_jwt'],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'backend/models/UserDAO.js',
      module: 'backend/routes/database.js',
      entrypoint: 'UserDAO.authenticate'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Backend UserDAO, bcrypt, and JWT middleware implemented; automated 1-click NextAuth/OAuth scaffolding for user projects is missing.'
  },
  {
    capability_id: 'saas.payments',
    category: CATEGORIES.CATEGORY_6,
    name: 'Payment Gateway Setup',
    description: 'Stripe / Razorpay payment gateway, checkout session creation, and secure webhook handler synthesis',
    status: STATUS.FOUNDATION_ONLY,
    required_skills: ['payment-integration'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.CRITICAL,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'stripe_mock_mode',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'backend/services/specService.js',
      module: 'backend/services/specService.js',
      entrypoint: 'specService.SPEC_STEPS (Stripe/Payment integration)'
    },
    requires_code_diff_gate: true,
    gap_notes: 'specService recognizes Stripe/Razorpay patterns; automated webhook and checkout session code generator is missing.'
  },
  {
    capability_id: 'saas.database_relations',
    category: CATEGORIES.CATEGORY_6,
    name: 'Database Relations & Foreign Keys',
    description: 'Normalized relational database schema mapping, foreign key enforcement, and parameterized joins',
    status: STATUS.IMPLEMENTED,
    required_skills: ['database-modeling'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'sqlite_single_table',
    dependencies: ['coding.database_schema_generation'],
    supported_inputs: ['text/x-sql', 'application/json'],
    supported_outputs: ['text/x-sql'],
    implementation: {
      service: 'backend/routes/database.js',
      module: 'backend/models/ProjectDAO.js',
      entrypoint: 'database.executeSchema'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'saas.admin_dashboard',
    category: CATEGORIES.CATEGORY_6,
    name: 'Admin Dashboard Generation',
    description: 'Pre-built administrative dashboards for user management, system metrics, and analytics visualization',
    status: STATUS.IMPLEMENTED,
    required_skills: ['admin-dashboard-components'],
    required_tools: ['WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2500, require_compression: true },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'standard_table_view',
    dependencies: ['ui.component_based_ui'],
    supported_inputs: ['application/json'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'frontend/app/dashboard/page.jsx',
      module: 'frontend/components/KanbanBoard.jsx',
      entrypoint: 'DashboardPage.render'
    },
    requires_code_diff_gate: true
  },
  {
    capability_id: 'saas.analytics',
    category: CATEGORIES.CATEGORY_6,
    name: 'Application Telemetry & Analytics',
    description: 'Request logging, execution latency monitoring, model quota consumption tracking, and audit metrics',
    status: STATUS.IMPLEMENTED,
    required_skills: ['telemetry-tracking'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'silent_telemetry_drop',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/agent/diagnostics/DiagnosticManager.js',
      module: 'backend/routes/analytics.js',
      entrypoint: 'DiagnosticManager.recordMetric'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'saas.subscription_tiers',
    category: CATEGORIES.CATEGORY_6,
    name: 'Subscription Tiers & Feature Gating',
    description: 'Role and quota-based feature gating enforcing usage limits across free, pro, and enterprise tiers',
    status: STATUS.FOUNDATION_ONLY,
    required_skills: ['subscription-logic'],
    required_tools: ['CodeTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'free_tier_grant',
    dependencies: ['saas.rbac'],
    supported_inputs: ['application/json'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'backend/services/specService.js',
      module: 'backend/services/specService.js',
      entrypoint: 'specService.SPEC_STEPS (budget/tier fields)'
    },
    requires_code_diff_gate: true,
    gap_notes: 'Tier definitions and quota caps modeled in spec; client/server middleware gating code generator is missing.'
  },
  {
    capability_id: 'saas.email_automation',
    category: CATEGORIES.CATEGORY_6,
    name: 'Email Automation & Transporters',
    description: 'Transactional email transporter scaffolding supporting Resend, SendGrid, and Nodemailer with HTML templates',
    status: STATUS.FOUNDATION_ONLY,
    required_skills: ['email-transporter'],
    required_tools: ['CodeTool', 'WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'console_log_email',
    dependencies: ['coding.production_code'],
    supported_inputs: ['text/plain', 'text/html'],
    supported_outputs: ['text/javascript'],
    implementation: {
      service: 'backend/services/specService.js',
      module: 'backend/services/specService.js',
      entrypoint: 'specService.SPEC_STEPS (SendGrid/Email integration)'
    },
    requires_code_diff_gate: true,
    gap_notes: 'specService defines email delivery architectural patterns; automated Nodemailer/Resend route generator is missing.'
  },
  {
    capability_id: 'saas.data_import_export',
    category: CATEGORIES.CATEGORY_6,
    name: 'Data Import / Export Pipeline',
    description: 'Multi-format export and import of application datasets across CSV, XLSX, JSON, and ZIP packages',
    status: STATUS.IMPLEMENTED,
    required_skills: ['document-import-export'],
    required_tools: ['ReadTool', 'WriteTool'],
    required_permissions: ['workspace:read', 'workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'FILE_INTEGRITY',
    rollback_policy: 'NONE',
    fallback_strategy: 'csv_raw_download',
    dependencies: [],
    supported_inputs: ['application/json', 'text/csv'],
    supported_outputs: ['application/zip', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    implementation: {
      service: 'backend/routes/documents.js',
      module: 'frontend/public/downloads',
      entrypoint: 'documents.generate'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'saas.rbac',
    category: CATEGORIES.CATEGORY_6,
    name: 'Role-Based Access Control (RBAC)',
    description: 'Role permission policies governing actions across Admin, Developer, and Viewer roles',
    status: STATUS.IMPLEMENTED,
    required_skills: ['rbac-policy'],
    required_tools: [],
    required_permissions: ['orchestration:manage'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'deny_all_fallback',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['boolean'],
    implementation: {
      service: 'backend/agent/policy/CapabilityPolicy.js',
      module: 'backend/agent/policy/CapabilityPolicy.js',
      entrypoint: 'CapabilityPolicy.assertAllowed'
    },
    requires_code_diff_gate: false
  },

  // ==========================================
  // CATEGORY 7 — SECURITY & PRIVACY (8)
  // [60 to 67: ALL 8 IMPLEMENTED]
  // ==========================================
  {
    capability_id: 'security.sql_injection',
    category: CATEGORIES.CATEGORY_7,
    name: 'SQL Injection Prevention',
    description: 'Enforced SQLite parameterized queries and prepared statements preventing query tampering',
    status: STATUS.IMPLEMENTED,
    required_skills: ['sql-security'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'NONE',
    fallback_strategy: 'query_reject',
    dependencies: [],
    supported_inputs: ['text/x-sql'],
    supported_outputs: ['text/x-sql'],
    implementation: {
      service: 'backend/models/ProjectDAO.js',
      module: 'backend/routes/database.js',
      entrypoint: 'db.prepare'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.xss',
    category: CATEGORIES.CATEGORY_7,
    name: 'XSS Protection & DOM Sanitization',
    description: 'DOMPurify sanitization of rendered markdown, HTML previews, and untrusted client inputs',
    status: STATUS.IMPLEMENTED,
    required_skills: ['dom-sanitization'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'plain_text_escape',
    dependencies: [],
    supported_inputs: ['text/html'],
    supported_outputs: ['text/html'],
    implementation: {
      service: 'frontend/components/CodeEditor.jsx',
      module: 'frontend/components/AICompanion.jsx',
      entrypoint: 'DOMPurify.sanitize'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.cors',
    category: CATEGORIES.CATEGORY_7,
    name: 'CORS Security Policy',
    description: 'Strict HTTP CORS origin whitelisting restricting cross-origin requests to configured frontend host',
    status: STATUS.IMPLEMENTED,
    required_skills: ['cors-configuration'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'cors_deny_all',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/server.js',
      module: 'backend/server.js',
      entrypoint: 'cors(corsOptions)'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.password_hashing',
    category: CATEGORIES.CATEGORY_7,
    name: 'Cryptographic Password Hashing',
    description: 'Bcrypt cryptographic password hashing with 12 salt rounds ensuring zero plain-text credential storage',
    status: STATUS.IMPLEMENTED,
    required_skills: ['password-security'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'auth_reject',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/models/UserDAO.js',
      module: 'backend/models/UserDAO.js',
      entrypoint: 'bcrypt.hash'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.session_jwt',
    category: CATEGORIES.CATEGORY_7,
    name: 'Session & JWT Security',
    description: 'HMAC-signed JWT tokens, httpOnly cookie transport, and timing-safe signature comparison',
    status: STATUS.IMPLEMENTED,
    required_skills: ['jwt-security'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'session_invalidation',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'backend/models/UserDAO.js',
      module: 'backend/routes/database.js',
      entrypoint: 'jwt.sign'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.api_key_protection',
    category: CATEGORIES.CATEGORY_7,
    name: 'API Key & Secret Leak Protection',
    description: 'Regex pattern scanning blocking accidental leakage of private keys, .env tokens, and cloud secrets',
    status: STATUS.IMPLEMENTED,
    required_skills: ['secret-scanning'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'NONE',
    fallback_strategy: 'block_and_sanitize',
    dependencies: [],
    supported_inputs: ['text/plain', 'text/javascript'],
    supported_outputs: ['boolean'],
    implementation: {
      service: 'backend/services/pathSecurity.js',
      module: 'backend/services/verifierService.js',
      entrypoint: 'verifierService.verifyCode'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.privacy_compliance',
    category: CATEGORIES.CATEGORY_7,
    name: 'Local Privacy & Compliance',
    description: 'Zero external telemetry transmission, strict local filesystem storage, and compliance controls',
    status: STATUS.IMPLEMENTED,
    required_skills: ['privacy-compliance'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'strict_local_mode',
    dependencies: ['performance.offline_ai'],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/services/ollamaService.js',
      module: 'backend/services/pathSecurity.js',
      entrypoint: 'ollamaService.isConfigured'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'security.rate_limiting',
    category: CATEGORIES.CATEGORY_7,
    name: 'Rate Limiting & Circuit Breakers',
    description: 'Sliding window request throttling, IP concurrency limits, and provider circuit breaker trips',
    status: STATUS.IMPLEMENTED,
    required_skills: ['rate-limiter-ops'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 1000, max_output_tokens: 500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'http_429_reject',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/utils/apiClient.js',
      module: 'backend/server.js',
      entrypoint: 'apiClient.RateLimiter'
    },
    requires_code_diff_gate: false
  },

  // ==========================================
  // CATEGORY 8 — DATA & ADVANCED AI (7)
  // [68: IMPL, 69: IMPL, 70: PARTIAL, 71: PARTIAL, 72: IMPL, 73: IMPL, 74: IMPL]
  // ==========================================
  {
    capability_id: 'data.csv_analysis',
    category: CATEGORIES.CATEGORY_8,
    name: 'Autonomous CSV Parsing & Data Pipeline',
    description: 'Autonomous CSV decoding with UTF-8 BOM sanitization, type inference, and tabular extraction',
    status: STATUS.IMPLEMENTED,
    required_skills: ['csv-parsing'],
    required_tools: ['ReadTool'],
    required_permissions: ['workspace:read'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'FILE_INTEGRITY',
    rollback_policy: 'NONE',
    fallback_strategy: 'raw_text_stream',
    dependencies: [],
    supported_inputs: ['text/csv', 'text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/routes/documents.js',
      module: 'ai-engine/main.py',
      entrypoint: 'documents.parseCsv'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'data.embedded_chatbot',
    category: CATEGORIES.CATEGORY_8,
    name: 'Embedded AI Companion & Chatbot',
    description: 'Real-time conversational assistant with streaming markdown, speech recognition, and Indian TTS voices',
    status: STATUS.IMPLEMENTED,
    required_skills: ['conversational-ai'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 4096, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'offline_chat_response',
    dependencies: ['performance.model_routing'],
    supported_inputs: ['text/plain', 'audio/wav'],
    supported_outputs: ['text/event-stream', 'audio/mpeg'],
    implementation: {
      service: 'frontend/components/AICompanion.jsx',
      module: 'backend/routes/chat.js',
      entrypoint: 'chat.streamResponse'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'data.ml_pipelines',
    category: CATEGORIES.CATEGORY_8,
    name: 'Machine Learning Training & Inference Pipelines',
    description: 'Automated ML model training, evaluation metrics generation, and inference pipeline deployment',
    status: STATUS.PARTIAL,
    required_skills: ['machine-learning'],
    required_tools: ['CodeTool', 'TerminalTool'],
    required_permissions: ['workspace:write', 'terminal:execute'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.EXPENSIVE,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 4000, require_compression: true },
    verification_policy: 'BUILD_TEST',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'simple_regression_fallback',
    dependencies: ['coding.production_code', 'devops.terminal'],
    supported_inputs: ['application/json', 'text/csv'],
    supported_outputs: ['application/json', 'model/weights'],
    implementation: {
      service: 'ai-engine/main.py',
      module: 'ai-engine/requirements.txt',
      entrypoint: 'main.py'
    },
    requires_code_diff_gate: true,
    gap_notes: 'FastAPI Python engine runs embeddings and inference; automated training loops for scikit-learn/PyTorch require pipeline scripts.'
  },
  {
    capability_id: 'data.nl_to_sql',
    category: CATEGORIES.CATEGORY_8,
    name: 'Natural Language to SQL Conversion',
    description: 'Schema-bound conversion of natural language questions to sanitized, parameterized SQL queries',
    status: STATUS.PARTIAL,
    required_skills: ['text-to-sql'],
    required_tools: [],
    required_permissions: ['workspace:read'],
    risk_level: RISK.MEDIUM,
    approval_policy: APPROVAL.CONFIRM,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 1500, require_compression: true },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'NONE',
    fallback_strategy: 'schema_explanation',
    dependencies: ['security.sql_injection'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/x-sql'],
    implementation: {
      service: 'backend/routes/chat.js',
      module: 'backend/routes/database.js',
      entrypoint: 'database.queryNL'
    },
    requires_code_diff_gate: false,
    gap_notes: 'Chat intent classifier recognizes SQL queries; strict database schema reflection to SQL compiler requires tool binding.'
  },
  {
    capability_id: 'data.vector_db',
    category: CATEGORIES.CATEGORY_8,
    name: 'Vector Database Initialization',
    description: 'In-memory and disk-backed vector store initialization, index indexing, and vector similarity search',
    status: STATUS.IMPLEMENTED,
    required_skills: ['vector-database'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 8000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'tfidf_vector_fallback',
    dependencies: [],
    supported_inputs: ['application/json', 'text/plain'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'ai-engine/main.py',
      module: 'backend/agent/codebaseIndexer.js',
      entrypoint: 'main.rag_index'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'data.rag',
    category: CATEGORIES.CATEGORY_8,
    name: 'Retrieval-Augmented Generation (RAG)',
    description: 'Multi-document chunking, semantic similarity retrieval via LlamaIndex, and grounded answer synthesis',
    status: STATUS.IMPLEMENTED,
    required_skills: ['rag-retrieval'],
    required_tools: ['ReadTool'],
    required_permissions: ['workspace:read'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.LOW_TOKEN,
    token_policy: { max_input_tokens: 12000, max_output_tokens: 3000, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'bm25_text_search',
    dependencies: ['data.vector_db'],
    supported_inputs: ['text/plain', 'application/json'],
    supported_outputs: ['application/json', 'text/markdown'],
    implementation: {
      service: 'ai-engine/main.py',
      module: 'backend/services/contextRetriever.js',
      entrypoint: 'main.rag_query'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'data.pdf_report_generation',
    category: CATEGORIES.CATEGORY_8,
    name: 'Automated PDF Report Generation',
    description: 'Autonomous generation of styled PDF documents using Python ReportLab with full Noto Hindi font support',
    status: STATUS.IMPLEMENTED,
    required_skills: ['pdf-generation'],
    required_tools: ['WriteTool'],
    required_permissions: ['workspace:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'FILE_INTEGRITY',
    rollback_policy: 'ACID_TRANSACTION',
    fallback_strategy: 'markdown_to_pdf_fallback',
    dependencies: [],
    supported_inputs: ['application/json', 'text/plain'],
    supported_outputs: ['application/pdf'],
    implementation: {
      service: 'backend/routes/pdf.js',
      module: 'ai-engine/pdfGenerator.py',
      entrypoint: 'pdfGenerator.generate_pdf'
    },
    requires_code_diff_gate: false
  },

  // ==========================================
  // CATEGORY 9 — UX & TRANSPARENCY (9)
  // [75 to 83: ALL 9 IMPLEMENTED]
  // ==========================================
  {
    capability_id: 'ux.live_preview',
    category: CATEGORIES.CATEGORY_9,
    name: 'Live Artifacts & Preview Viewer',
    description: 'Real-time dev server iframe rendering, hot-reloading preview, and WebContainer support',
    status: STATUS.IMPLEMENTED,
    required_skills: ['live-preview'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'static_code_viewer',
    dependencies: [],
    supported_inputs: ['text/html'],
    supported_outputs: ['text/html'],
    implementation: {
      service: 'frontend/components/views/CopilotIDE.jsx',
      module: 'backend/sandbox/routes.js',
      entrypoint: 'CopilotIDE.renderPreview'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.interactive_terminal',
    category: CATEGORIES.CATEGORY_9,
    name: 'Interactive Terminal View',
    description: 'Embedded xterm.js PTY console supporting bidirectional typing, color formatting, and resize events',
    status: STATUS.IMPLEMENTED,
    required_skills: ['xterm-operations'],
    required_tools: ['TerminalTool'],
    required_permissions: ['terminal:execute'],
    risk_level: RISK.HIGH,
    approval_policy: APPROVAL.EXPLICIT_APPROVAL,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'static_log_box',
    dependencies: ['devops.terminal'],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain'],
    implementation: {
      service: 'frontend/components/Terminal.jsx',
      module: 'backend/sockets/terminal.js',
      entrypoint: 'Terminal.render'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.architecture_decision_explanation',
    category: CATEGORIES.CATEGORY_9,
    name: 'Architecture Decision Explanation',
    description: 'Transparent reasoning logs, architectural trade-off justification, and FINAL_ANSWER structuring',
    status: STATUS.IMPLEMENTED,
    required_skills: ['architectural-explanation'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.STANDARD,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: true },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'concise_answer',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/markdown'],
    implementation: {
      service: 'backend/routes/agent.js',
      module: 'backend/services/specService.js',
      entrypoint: 'agent.formatFinalAnswer'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.omnichannel_input',
    category: CATEGORIES.CATEGORY_9,
    name: 'Omnichannel Input Integration',
    description: 'Multimodal input aggregation supporting Web chat, Web Speech voice recognition, and Telegram bot commands',
    status: STATUS.IMPLEMENTED,
    required_skills: ['omnichannel-routing'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 4000, max_output_tokens: 2000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'web_chat_only',
    dependencies: [],
    supported_inputs: ['text/plain', 'audio/wav'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'frontend/components/views/VoiceView.jsx',
      module: 'backend/services/telegramBot.js',
      entrypoint: 'VoiceView.startListening'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.seamless_rollback',
    category: CATEGORIES.CATEGORY_9,
    name: 'Seamless Multi-Tier Rollback',
    description: 'Single-click and autonomous recovery from failed runs via ACID snapshots and Git commit rollbacks',
    status: STATUS.IMPLEMENTED,
    required_skills: ['rollback-operations'],
    required_tools: ['GitTool'],
    required_permissions: ['workspace:write', 'git:write'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'GIT_ROLLBACK',
    fallback_strategy: 'manual_git_revert',
    dependencies: ['coding.git_operations'],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'backend/services/transactionManager.js',
      module: 'backend/routes/git.js',
      entrypoint: 'transactionManager.rollback'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.step_by_step_approval',
    category: CATEGORIES.CATEGORY_9,
    name: 'Step-by-Step Approval & Kanban Review',
    description: 'Human-in-the-loop task breakdown, Kanban board drag-drop control, and stage execution checkpoints',
    status: STATUS.IMPLEMENTED,
    required_skills: ['kanban-task-management'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1500, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'auto_advance',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['application/json'],
    implementation: {
      service: 'frontend/components/KanbanBoard.jsx',
      module: 'backend/services/plannerService.js',
      entrypoint: 'KanbanBoard.handleTaskApproval'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.capability_honesty',
    category: CATEGORIES.CATEGORY_9,
    name: 'No False Claims & Capability Honesty',
    description: 'Strict programmatic pre-execution verification preventing hallucinations of unsupported tools or fake results',
    status: STATUS.IMPLEMENTED,
    required_skills: ['truthfulness-guard'],
    required_tools: [],
    required_permissions: ['orchestration:manage'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 3000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'AST_VALIDATION',
    rollback_policy: 'NONE',
    fallback_strategy: 'truthful_unsupported_error',
    dependencies: [],
    supported_inputs: ['application/json'],
    supported_outputs: ['boolean'],
    implementation: {
      service: 'backend/agent/runtime/Supervisor.js',
      module: 'backend/services/verifierService.js',
      entrypoint: 'Supervisor.validateAction'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.multilingual',
    category: CATEGORIES.CATEGORY_9,
    name: 'Hinglish & Local Language Support',
    description: 'Native Hinglish conversational reasoning, Hindi text rendering, and Edge TTS voice synthesis',
    status: STATUS.IMPLEMENTED,
    required_skills: ['multilingual-reasoning'],
    required_tools: [],
    required_permissions: [],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 6000, max_output_tokens: 3000, require_compression: false },
    verification_policy: 'NONE',
    rollback_policy: 'NONE',
    fallback_strategy: 'english_fallback',
    dependencies: [],
    supported_inputs: ['text/plain'],
    supported_outputs: ['text/plain', 'audio/mpeg'],
    implementation: {
      service: 'backend/routes/chat.js',
      module: 'ai-engine/main.py',
      entrypoint: 'chat.handleMultilingual'
    },
    requires_code_diff_gate: false
  },
  {
    capability_id: 'ux.exportable_workspace',
    category: CATEGORIES.CATEGORY_9,
    name: 'Exportable Workspace & Project Bundler',
    description: '1-click compilation of complete project directory into downloadable standalone ZIP archive',
    status: STATUS.IMPLEMENTED,
    required_skills: ['workspace-export'],
    required_tools: ['ReadTool'],
    required_permissions: ['workspace:read'],
    risk_level: RISK.LOW,
    approval_policy: APPROVAL.AUTO,
    cost_policy: COST.ZERO_API,
    token_policy: { max_input_tokens: 2000, max_output_tokens: 1000, require_compression: false },
    verification_policy: 'FILE_INTEGRITY',
    rollback_policy: 'NONE',
    fallback_strategy: 'raw_file_copy',
    dependencies: [],
    supported_inputs: ['filesystem/directory'],
    supported_outputs: ['application/zip'],
    implementation: {
      service: 'backend/routes/documents.js',
      module: 'frontend/public/downloads',
      entrypoint: 'documents.exportZip'
    },
    requires_code_diff_gate: false
  }
];

// Deterministic intent / keyword aliases for findByIntent
const INTENT_ALIASES = Object.freeze({
  'scaffold': 'coding.full_stack_delivery',
  'full stack': 'coding.full_stack_delivery',
  'generate project': 'coding.full_stack_delivery',
  'refactor': 'coding.legacy_refactoring',
  'fix bug': 'coding.automated_bug_resolution',
  'git': 'coding.git_operations',
  'commit': 'coding.git_operations',
  'lint': 'coding.linting_formatting',
  'explain': 'coding.code_explanation',
  'test': 'coding.test_case_generation',
  'theme': 'ui.theme_switching',
  'dark mode': 'ui.theme_switching',
  'visual heal': 'ui.visual_bug_detection',
  'chart': 'ui.dynamic_chart_generation',
  'deploy': 'devops.cloud_deployment',
  'docker': 'devops.docker',
  'terminal': 'devops.terminal',
  'cron': 'devops.cron_job_setup',
  'memory': 'autonomy.memory',
  'research': 'autonomy.web_acquisition',
  'search web': 'autonomy.web_acquisition',
  'offline': 'performance.offline_ai',
  'ollama': 'performance.offline_ai',
  'auth': 'saas.authentication',
  'login': 'saas.authentication',
  'payment': 'saas.payments',
  'stripe': 'saas.payments',
  'dashboard': 'saas.admin_dashboard',
  'csv': 'data.csv_analysis',
  'sql': 'data.nl_to_sql',
  'rag': 'data.rag',
  'pdf': 'data.pdf_report_generation',
  'rollback': 'ux.seamless_rollback',
  'hinglish': 'ux.multilingual',
  'voice': 'ux.omnichannel_input',
  'export': 'ux.exportable_workspace'
});

class CapabilityRegistry {
  constructor(rawCapabilities = RAW_CAPABILITIES) {
    this._capabilities = new Map();
    this._initialized = false;
    this._initialize(rawCapabilities);
  }

  _validateDefinition(def) {
    if (!def.capability_id || typeof def.capability_id !== 'string') {
      throw new Error(`Capability definition missing valid capability_id`);
    }
    if (!Object.values(CATEGORIES).includes(def.category)) {
      throw new Error(`Capability '${def.capability_id}' has invalid category: '${def.category}'`);
    }
    if (!Object.values(STATUS).includes(def.status)) {
      throw new Error(`Capability '${def.capability_id}' has invalid status: '${def.status}'`);
    }
    if (!Object.values(RISK).includes(def.risk_level)) {
      throw new Error(`Capability '${def.capability_id}' has invalid risk_level: '${def.risk_level}'`);
    }
    if (!Object.values(APPROVAL).includes(def.approval_policy)) {
      throw new Error(`Capability '${def.capability_id}' has invalid approval_policy: '${def.approval_policy}'`);
    }
    if (!Object.values(COST).includes(def.cost_policy)) {
      throw new Error(`Capability '${def.capability_id}' has invalid cost_policy: '${def.cost_policy}'`);
    }
    if (!Array.isArray(def.dependencies)) {
      throw new Error(`Capability '${def.capability_id}' dependencies must be an array`);
    }
    if (def.status === STATUS.IMPLEMENTED && (!def.implementation || !def.implementation.service)) {
      throw new Error(`Capability '${def.capability_id}' marked IMPLEMENTED but missing real implementation service binding`);
    }
    if (def.status === STATUS.MISSING && def.implementation && (def.implementation.service || def.implementation.module)) {
      throw new Error(`Capability '${def.capability_id}' marked MISSING must not have implementation bindings`);
    }
  }

  _initialize(rawList = RAW_CAPABILITIES) {
    if (this._initialized) return;

    // 1. Validate individual definitions and detect duplicate IDs
    for (const raw of rawList) {
      this._validateDefinition(raw);
      if (this._capabilities.has(raw.capability_id)) {
        throw new Error(`Duplicate capability ID detected: '${raw.capability_id}'`);
      }
      // Deep freeze the capability definition to guarantee runtime immutability
      const frozen = deepFreeze(JSON.parse(JSON.stringify(raw)));
      this._capabilities.set(raw.capability_id, frozen);
    }

    // 2. Validate all dependency references exist
    for (const [id, def] of this._capabilities.entries()) {
      for (const depId of def.dependencies) {
        if (!this._capabilities.has(depId)) {
          throw new Error(`Capability '${id}' references unknown dependency: '${depId}'`);
        }
      }
    }

    // 3. Detect circular dependency chains using DFS
    for (const startId of this._capabilities.keys()) {
      const visited = new Set();
      const stack = new Set();

      const checkCycle = (currentId) => {
        visited.add(currentId);
        stack.add(currentId);

        const currentDef = this._capabilities.get(currentId);
        for (const neighbor of currentDef.dependencies) {
          if (!visited.has(neighbor)) {
            if (checkCycle(neighbor)) return true;
          } else if (stack.has(neighbor)) {
            return true; // Cycle detected
          }
        }

        stack.delete(currentId);
        return false;
      };

      if (checkCycle(startId)) {
        throw new Error(`Circular dependency detected involving capability: '${startId}'`);
      }
    }

    this._initialized = true;
  }

  getCapability(capabilityId) {
    if (!capabilityId || typeof capabilityId !== 'string') return null;
    return this._capabilities.get(capabilityId.trim()) || null;
  }

  getAllCapabilities() {
    return Array.from(this._capabilities.values());
  }

  getByCategory(category) {
    return Array.from(this._capabilities.values()).filter(c => c.category === category);
  }

  getByStatus(status) {
    return Array.from(this._capabilities.values()).filter(c => c.status === status);
  }

  findByIntent(intent) {
    if (!intent || typeof intent !== 'string') return [];
    const normalized = intent.toLowerCase().trim();
    
    // Exact or substring match on intent aliases
    const matchedIds = new Set();
    for (const [keyword, capId] of Object.entries(INTENT_ALIASES)) {
      if (normalized.includes(keyword)) {
        matchedIds.add(capId);
      }
    }

    // Also match capability_id or name substrings
    for (const cap of this._capabilities.values()) {
      if (cap.capability_id.includes(normalized) || cap.name.toLowerCase().includes(normalized)) {
        matchedIds.add(cap.capability_id);
      }
    }

    return Array.from(matchedIds).map(id => this._capabilities.get(id)).filter(Boolean);
  }

  getDependencies(capabilityId) {
    const cap = this.getCapability(capabilityId);
    if (!cap) return [];
    return cap.dependencies.slice();
  }

  validateCapability(capabilityDefinition) {
    try {
      this._validateDefinition(capabilityDefinition);
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  isAvailable(capabilityId, runtimeContext = {}) {
    const cap = this.getCapability(capabilityId);
    if (!cap) return AVAILABILITY.NOT_IMPLEMENTED;
    if (cap.status === STATUS.MISSING) return AVAILABILITY.NOT_IMPLEMENTED;

    // Check specific environment / runtime prerequisites without remote network calls
    if (cap.capability_id === 'devops.docker') {
      if (runtimeContext.dockerAvailable === false) return AVAILABILITY.UNAVAILABLE;
    }
    if (cap.capability_id === 'performance.offline_ai') {
      if (runtimeContext.ollamaAvailable === false) return AVAILABILITY.REQUIRES_CONFIGURATION;
    }
    if (cap.capability_id === 'saas.payments') {
      if (!runtimeContext.stripeKey && !process.env.STRIPE_SECRET_KEY) return AVAILABILITY.REQUIRES_CONFIGURATION;
    }
    if (cap.capability_id === 'devops.cloud_deployment') {
      if (!runtimeContext.deployToken && !process.env.VERCEL_TOKEN && !process.env.NETLIFY_TOKEN) {
        return AVAILABILITY.REQUIRES_CONFIGURATION;
      }
    }

    if (cap.status === STATUS.FOUNDATION_ONLY) return AVAILABILITY.REQUIRES_CONFIGURATION;
    return AVAILABILITY.AVAILABLE;
  }

  getRequiredTools(capabilityId) {
    const cap = this.getCapability(capabilityId);
    return cap ? cap.required_tools.slice() : [];
  }

  getRequiredSkills(capabilityId) {
    const cap = this.getCapability(capabilityId);
    return cap ? cap.required_skills.slice() : [];
  }

  getRiskPolicy(capabilityId) {
    const cap = this.getCapability(capabilityId);
    if (!cap) return null;
    return {
      risk_level: cap.risk_level,
      approval_policy: cap.approval_policy
    };
  }

  getVerificationPolicy(capabilityId) {
    const cap = this.getCapability(capabilityId);
    return cap ? cap.verification_policy : null;
  }

  requiresCodeDiffGate(capabilityId) {
    const cap = this.getCapability(capabilityId);
    return cap ? Boolean(cap.requires_code_diff_gate) : false;
  }
  getIntentAliases() {
    return { ...INTENT_ALIASES };
  }

  getTransitiveDependencies(capabilityId) {
    const cap = this.getCapability(capabilityId);
    if (!cap) return [];

    const result = [];
    const visited = new Set();

    const resolve = (id) => {
      const current = this.getCapability(id);
      if (!current) return;
      for (const depId of current.dependencies) {
        if (!visited.has(depId)) {
          visited.add(depId);
          resolve(depId);
          result.push(depId);
        }
      }
    };

    resolve(capabilityId);
    return result;
  }
}

// Export singleton instance + constants
const capabilityRegistry = new CapabilityRegistry();

module.exports = {
  CapabilityRegistry,
  capabilityRegistry,
  STATUS,
  RISK,
  APPROVAL,
  COST,
  CATEGORIES,
  AVAILABILITY,
  INTENT_ALIASES
};
