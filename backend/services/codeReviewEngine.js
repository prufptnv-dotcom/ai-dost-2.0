'use strict';

/**
 * AI-Dost Static Code Review & Quality Engine
 * Performs static pattern scanning and Node.js vm.Script syntax validation.
 * 
 * IMPORTANT CONTRACT & VERIFICATION BOUNDARY:
 * - This engine performs STATIC inspection only (syntax parsing, regex heuristics, secret scans).
 * - It does NOT execute code or run integration tests.
 * - Results are explicitly labeled as static-only (never execution-verified).
 * - Does not claim AST parsing or duplication detection where only heuristic checks exist.
 */

const vm = require('node:vm');
const path = require('node:path');

const SEVERITY = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

const STAGES = {
  SPEC_COVERAGE: 'STAGE_1_SPEC_COVERAGE',
  SYNTAX_ANALYSIS: 'STAGE_2_SYNTAX_ANALYSIS',
  FRAMEWORK_CONVENTIONS: 'STAGE_3_FRAMEWORK_CONVENTIONS',
  MANIFEST_CONSISTENCY: 'STAGE_4_MANIFEST_CONSISTENCY',
  RESOURCE_ERROR_HANDLING: 'STAGE_5_RESOURCE_ERROR_HANDLING',
  ALGORITHMIC_PERFORMANCE: 'STAGE_6_ALGORITHMIC_PERFORMANCE',
  SECURITY_AUDIT: 'STAGE_7_SECURITY_AUDIT',
  INCOMPLETE_PLACEHOLDERS: 'STAGE_8_INCOMPLETE_PLACEHOLDERS',
  REPAIR_PLAN_GENERATION: 'STAGE_9_REPAIR_PLAN_GENERATION',
  UI_FUNCTIONAL_INTEGRITY: 'STAGE_10_UI_FUNCTIONAL_INTEGRITY',
  DATA_PERSISTENCE_INTEGRITY: 'STAGE_11_DATA_PERSISTENCE_INTEGRITY'
};

const PLACEHOLDER_PATTERNS = [
  { pattern: /\/\/\s*TODO\b/i, message: 'Unimplemented TODO comment found in production code.' },
  { pattern: /\/\/\s*FIXME\b/i, message: 'Unresolved FIXME comment found in code.' },
  { pattern: /\/\/\s*(?:implement|add logic|placeholder|write here|stub)\b/i, message: 'Placeholder comment indicates missing implementation logic.' },
  { pattern: /throw\s+new\s+Error\s*\(\s*['"](?:Not implemented|TODO|stub)['"]\s*\)/i, message: 'NotImplementedError placeholder thrown in code.' },
  { pattern: /function\s+[\w$]+\s*\([^)]*\)\s*\{\s*\}/, message: 'Empty function body with no operational logic.' }
];

const SECURITY_PATTERNS = [
  { pattern: /AIza[0-9A-Za-z-_]{35}/, message: 'Hardcoded Google API key pattern detected in source file.' },
  { pattern: /sk-[a-zA-Z0-9]{20,}/, message: 'Hardcoded secret token / OpenAI-style key pattern detected.' },
  { pattern: /ghp_[a-zA-Z0-9]{20,}/, message: 'Hardcoded GitHub Personal Access Token detected.' },
  { pattern: /BEGIN\s+(?:(?:RSA|OPENSSH|DSA|EC)\s+)?PRIVATE\s+KEY/, message: 'Private key data committed in plaintext.' },
  { pattern: /["']?(?:password|secret|jwt_secret|api_key|token)["']?\s*[:=]\s*["'][a-z0-9!@#$%^&*()_+]{8,}["']/i, message: 'Likely hardcoded password or auth secret literal instead of process.env reference.' },
  { pattern: /\beval\s*\(/, message: 'Unsafe eval() usage detected; potential arbitrary code execution vulnerability.' },
  { pattern: /new\s+Function\s*\(/, message: 'Unsafe Function constructor usage detected.' },
  { pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:\s*(?!DOMPurify\.sanitize)/, message: 'Unsanitized dangerouslySetInnerHTML usage creates XSS vulnerability.' },
  { pattern: /SELECT\b[^;\n]*?\bFROM\b[^;\n]*?\bWHERE\b[^;\n]*?=\s*['"]?\s*\+\s*[\w$]+/i, message: 'Potential SQL injection risk: raw string concatenation in SQL statement.' }
];

const RESOURCE_PATTERNS = [
  { pattern: /catch\s*\([^)]*\)\s*\{\s*\}/, message: 'Empty catch block silently swallows exceptions without logging or handling.' },
  { pattern: /setInterval\s*\(/, mustHave: /clearInterval\s*\(/, message: 'setInterval without corresponding clearInterval may cause persistent memory leak.' },
  { pattern: /addEventListener\s*\(/, mustHave: /removeEventListener\s*\(/, scope: 'react', message: 'Window/DOM addEventListener in component should have cleanup in useEffect return.' }
];

/**
 * Reviews a project files dictionary against static quality stages.
 * 
 * @param {Object} files - Map of relative path -> string content
 * @param {Object} spec - AppSpecification or Algorithm Task Contract
 * @param {Object} options - Review settings
 * @returns {Object} Review report explicitly marked as STATIC_REVIEW_ONLY_NOT_EXECUTED
 */
function auditSpecCoverage(spec, entries, findings) {
  if (!spec || !Array.isArray(spec.requirements) || spec.requirements.length === 0) return;
  const combinedContent = entries.map(([, c]) => String(c)).join('\n').toLowerCase();
  for (const req of spec.requirements) {
    const desc = typeof req === 'string' ? req : (req.description || req.title || '');
    const keywords = desc.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    const matches = keywords.filter((kw) => combinedContent.includes(kw));
    if (keywords.length > 0 && matches.length === 0) {
      findings.push({
        ruleId: 'REQ-COVERAGE-DEFICIT',
        stage: STAGES.SPEC_COVERAGE,
        severity: SEVERITY.WARNING,
        filePath: null,
        message: `Requirement "${desc}" may lack implementation based on keyword coverage.`,
        suggestion: 'Ensure the feature is explicitly addressed in one of the source files.'
      });
    }
  }
}

function auditLinePatterns(filePath, lines, findings) {
  for (const p of PLACEHOLDER_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (p.pattern.test(lines[i])) {
        findings.push({
          ruleId: 'CODE-QUALITY-PLACEHOLDER',
          stage: STAGES.INCOMPLETE_PLACEHOLDERS,
          severity: SEVERITY.ERROR,
          filePath,
          line: i + 1,
          message: p.message,
          suggestion: 'Implement complete operational code. Do not output placeholders or TODO markers.'
        });
      }
    }
  }

  for (const sec of SECURITY_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (sec.pattern.test(lines[i])) {
        findings.push({
          ruleId: 'SECURITY-UNSAFE-PATTERN',
          stage: STAGES.SECURITY_AUDIT,
          severity: SEVERITY.ERROR,
          filePath,
          line: i + 1,
          message: sec.message,
          suggestion: 'Use environment variables, parameterized queries, or input sanitization.'
        });
      }
    }
  }
}

function auditResourcePatterns(filePath, content, findings) {
  for (const res of RESOURCE_PATTERNS) {
    if (res.pattern.test(content)) {
      if (res.mustHave && !res.mustHave.test(content)) {
        findings.push({
          ruleId: 'RESOURCE-LEAK-RISK',
          stage: STAGES.RESOURCE_ERROR_HANDLING,
          severity: SEVERITY.WARNING,
          filePath,
          message: res.message,
          suggestion: 'Add symmetric cleanup (e.g. clearInterval or removeEventListener).'
        });
      } else if (!res.mustHave) {
        findings.push({
          ruleId: 'SILENT-ERROR-SWALLOWED',
          stage: STAGES.RESOURCE_ERROR_HANDLING,
          severity: SEVERITY.ERROR,
          filePath,
          message: res.message,
          suggestion: 'Log the error or propagate it; never swallow exceptions silently.'
        });
      }
    }
  }

  if (/\b(?:map|filter|forEach)\(\s*(?:\([^)]*\)|[\w$]+)\s*=>\s*[^;\n]*?\.(?:find|filter|map|includes)\(/.test(content)) {
    findings.push({
      ruleId: 'QUADRATIC-COMPLEXITY-RISK',
      stage: STAGES.ALGORITHMIC_PERFORMANCE,
      severity: SEVERITY.WARNING,
      filePath,
      message: 'Nested collection iteration detected (e.g. array.map with inner array.find/includes). May cause O(N^2) complexity.',
      suggestion: 'Convert the inner collection into a Set or Map for O(1) lookup.'
    });
  }
}

function auditInteractiveControls(filePath, content, lines, findings) {
  if (!/\.[jt]sx?$/i.test(filePath) && !/\.html$/i.test(filePath)) return;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*alert\s*\(/i.test(line)) {
      findings.push({
        ruleId: 'UI-ALERT-PLACEHOLDER',
        stage: STAGES.UI_FUNCTIONAL_INTEGRITY,
        severity: SEVERITY.ERROR,
        filePath,
        line: i + 1,
        message: 'Interactive button uses placeholder alert() instead of functional state or view handler.',
        suggestion: 'Implement functional state mutation or modal trigger instead of alert().'
      });
    }

    if (/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/.test(line)) {
      findings.push({
        ruleId: 'UI-EMPTY-HANDLER',
        stage: STAGES.UI_FUNCTIONAL_INTEGRITY,
        severity: SEVERITY.ERROR,
        filePath,
        line: i + 1,
        message: 'Interactive control has an empty no-op handler.',
        suggestion: 'Provide operational logic to handle user action.'
      });
    }
  }

  const inputRegex = /<input\b([^>]*)>/g;
  let match;
  while ((match = inputRegex.exec(content)) !== null) {
    const attrs = match[1];
    if (/placeholder\s*=\s*['"][^'"]*(?:search|filter)[^'"]*['"]/i.test(attrs)) {
      if (!/value\s*=/i.test(attrs) && !/onChange\s*=/i.test(attrs) && !/ref\s*=/i.test(attrs)) {
        findings.push({
          ruleId: 'UI-UNBOUND-SEARCH-INPUT',
          stage: STAGES.UI_FUNCTIONAL_INTEGRITY,
          severity: SEVERITY.WARNING,
          filePath,
          message: 'Search/filter input rendered without state binding (missing value or onChange handler).',
          suggestion: 'Bind search input to reactive state (value={searchQuery} onChange={...}).'
        });
      }
    }
  }
}

function auditPersistenceHygiene(filePath, content, findings) {
  if (!/\.[jt]sx?$/i.test(filePath)) return;

  const pretendDbPattern = /(?:function|const)\s+(?:saveToDatabase|persistToCloud|syncWithBackend|saveRecord)\b[^{]*\{([^}]*)\}/g;
  let match;
  while ((match = pretendDbPattern.exec(content)) !== null) {
    const body = match[1];
    if (/\b(?:push|unshift)\b/.test(body) && !/(?:localStorage|indexedDB|fetch|axios|db\.|prisma|knex)/i.test(body)) {
      findings.push({
        ruleId: 'DATA-PRETEND-PERSISTENCE',
        stage: STAGES.DATA_PERSISTENCE_INTEGRITY,
        severity: SEVERITY.WARNING,
        filePath,
        message: 'Function implies persistent storage but only mutates an in-memory array without localStorage or network persistence.',
        suggestion: 'Use localStorage or an explicit API endpoint to ensure data survives page reloads.'
      });
    }
  }
}

function auditFilePatterns(filePath, content, lines, findings) {
  auditLinePatterns(filePath, lines, findings);
  auditResourcePatterns(filePath, content, findings);
  auditInteractiveControls(filePath, content, lines, findings);
  auditPersistenceHygiene(filePath, content, findings);
}

function auditSyntax(filePath, content, findings) {
  if (/\.(?:js|mjs|cjs)$/i.test(filePath) && !content.includes('import ') && !content.includes('export ')) {
    try {
      // Static syntax validation only: script is parsed and compiled, never executed or run
      new vm.Script(content, { filename: filePath });
    } catch (syntaxErr) {
      const lineMatch = syntaxErr.stack?.match(/:(\d+)(?::\d+)?/);
      const lineNum = lineMatch ? Number.parseInt(lineMatch[1], 10) : 1;
      findings.push({
        ruleId: 'SYNTAX-PARSER-ERROR',
        stage: STAGES.SYNTAX_ANALYSIS,
        severity: SEVERITY.ERROR,
        filePath,
        line: lineNum,
        message: `JavaScript SyntaxError: ${syntaxErr.message}`,
        suggestion: 'Fix syntax error reported by the JavaScript parser.'
      });
    }
  } else {
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces && Math.abs(openBraces - closeBraces) > 1 && /\.[jt]sx?$/i.test(filePath)) {
      findings.push({
        ruleId: 'SYNTAX-UNBALANCED-BRACES',
        stage: STAGES.SYNTAX_ANALYSIS,
        severity: SEVERITY.ERROR,
        filePath,
        message: `Mismatched curly braces detected in file (${openBraces} opening vs ${closeBraces} closing).`,
        suggestion: 'Verify matching braces around functions and component blocks.'
      });
    }
  }
}

function auditReactConventions(filePath, content, findings) {
  if (!/\.[jt]sx$/i.test(filePath)) return;

  if (/if\s*\([^)]*\)\s*\{[^}]*?\buse(?:State|Effect|Memo|Callback|Ref|Context)\s*\(/.test(content)) {
    findings.push({
      ruleId: 'REACT-CONDITIONAL-HOOK',
      stage: STAGES.FRAMEWORK_CONVENTIONS,
      severity: SEVERITY.ERROR,
      filePath,
      message: 'React hook invoked conditionally inside an if-statement block (violates Rules of Hooks).',
      suggestion: 'Move all React hook invocations to the top level of the component.'
    });
  }

  const stateMatch = /\b(?:const|let)\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState/.exec(content);
  if (stateMatch?.[1]) {
    const stateVar = stateMatch[1];
    if (new RegExp(String.raw`\b${stateVar}\.[\w$]+\s*=\s*`).test(content)) {
      findings.push({
        ruleId: 'REACT-STATE-MUTATION',
        stage: STAGES.FRAMEWORK_CONVENTIONS,
        severity: SEVERITY.ERROR,
        filePath,
        message: `Direct mutation of React state variable '${stateVar}' detected.`,
        suggestion: 'Use functional setter setState(prev => ({ ...prev, key: value })) instead of direct mutation.'
      });
    }
  }
}

function auditPackageManifest(files, entries, findings) {
  const pkgStr = files['package.json'] || files['frontend/package.json'];
  if (!pkgStr) return;
  try {
    const pkg = JSON.parse(pkgStr);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const builtins = new Set(['fs', 'path', 'http', 'https', 'crypto', 'os', 'stream', 'events', 'util', 'url', 'buffer', 'querystring', 'child_process', 'assert', 'vm']);
    for (const [filePath, content] of entries) {
      if (!/\.[jt]sx?$/i.test(filePath)) continue;
      const importPkgs = content.match(/from\s+['"]([^.'"/][^'"]*)['"]/g) || [];
      for (const imp of importPkgs) {
        const rawName = imp.replace(/from\s+['"]/, '').replace(/['"]$/, '');
        const pkgName = rawName.startsWith('@') ? rawName.split('/').slice(0, 2).join('/') : rawName.split('/')[0];
        if (!builtins.has(pkgName) && !allDeps[pkgName] && pkgName !== 'react' && pkgName !== 'react-dom') {
          findings.push({
            ruleId: 'UNDECLARED-DEPENDENCY',
            stage: STAGES.MANIFEST_CONSISTENCY,
            severity: SEVERITY.WARNING,
            filePath,
            message: `Module imports external package '${pkgName}', which is not listed in package.json.`,
            suggestion: `Add "${pkgName}" to dependencies in package.json or use a native alternative.`
          });
        }
      }
    }
  } catch (_err) {
    // Ignore JSON parsing errors in malformed package manifest
  }
}

/**
 * Reviews a project files dictionary against static quality stages.
 * 
 * @param {Object} files - Map of relative path -> string content
 * @param {Object} spec - AppSpecification or Algorithm Task Contract
 * @param {Object} options - Review settings
 * @returns {Object} Review report explicitly marked as STATIC_REVIEW_ONLY_NOT_EXECUTED
 */
function reviewProjectFiles(files = {}, spec = null, options = {}) {
  const findings = [];
  const entries = Object.entries(files || {});

  auditSpecCoverage(spec, entries, findings);

  for (const [filePath, content] of entries) {
    if (typeof content !== 'string') continue;
    const lines = content.split('\n');
    auditFilePatterns(filePath, content, lines, findings);
    auditSyntax(filePath, content, findings);
    auditReactConventions(filePath, content, findings);
  }

  auditPackageManifest(files, entries, findings);

  const errorFindings = findings.filter((f) => f.severity === SEVERITY.ERROR);
  const warningFindings = findings.filter((f) => f.severity === SEVERITY.WARNING);
  const affectedFiles = [...new Set(errorFindings.map((f) => f.filePath).filter(Boolean))];

  const repairPlan = {
    needed: errorFindings.length > 0,
    targetFiles: affectedFiles,
    actionableItems: errorFindings.slice(0, 8).map((f) => ({
      file: f.filePath,
      issue: f.message,
      fix: f.suggestion
    })),
    strategy: affectedFiles.length > 0 ? 'SURGICAL_FILE_REPAIR' : 'NO_REPAIR_NEEDED'
  };

  const score = Math.max(0, 100 - (errorFindings.length * 20) - (warningFindings.length * 5));
  const passed = errorFindings.length === 0;

  return {
    passed,
    status: 'STATIC_REVIEW_ONLY_NOT_EXECUTED',
    verificationScope: 'STATIC_HEURISTICS_AND_PARSER',
    executionVerified: false,
    score,
    totalFiles: entries.length,
    findingsCount: {
      errors: errorFindings.length,
      warnings: warningFindings.length,
      info: findings.filter((f) => f.severity === SEVERITY.INFO).length
    },
    findings,
    repairPlan,
    verificationNote: 'Static pattern and syntax review only. Code has NOT been tested, executed, or verified at runtime.'
  };
}

module.exports = {
  SEVERITY,
  STAGES,
  reviewProjectFiles
};
