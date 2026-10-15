'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: CI/CD Validator
 * 
 * Enforces strict security, command allowlists, permission boundaries,
 * dependency boundaries (Playwright, lockfiles), and action supply-chain safety.
 */

const path = require('path');
const fs = require('fs');
const {
  SUPPORTED_CI_PLATFORMS,
  SUPPORTED_RUNTIMES,
  ACTIVE_NODE_LTS_VERSIONS,
  SUPPORTED_TEST_FRAMEWORKS,
  SUPPORTED_DATABASE_ENGINES,
  SUPPORTED_INSTALL_POLICIES,
  OFFICIAL_ACTION_SHAS
} = require('./CiCdPlan');

const PROHIBITED_COMMAND_PATTERNS = [
  /curl\s+.*\|\s*(?:bash|sh)/i,
  /wget\s+.*\|\s*(?:bash|sh)/i,
  /bash\s+-c\b/i,
  /sh\s+-c\b/i,
  /node\s+-e\b/i,
  /python[23]?\s+-c\b/i,
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /;\s*(?:rm|drop|curl|wget|bash|sh)\b/i,
  /&&\s*(?:rm|curl|wget|bash|sh)\s/i,
  /`[^`]+`/,
  /\$\([^)]+\)/
];

const ALLOWED_PERMISSIONS = new Set([
  'actions',
  'checks',
  'contents',
  'deployments',
  'discussions',
  'id-token',
  'issues',
  'packages',
  'pages',
  'pull-requests',
  'repository-projects',
  'security-events',
  'statuses'
]);

const ALLOWED_PERMISSION_VALUES = new Set(['read', 'none']); // Default strictly read/none, write blocked unless explicit audit

const OFFICIAL_ACTIONS = new Set(Object.keys(OFFICIAL_ACTION_SHAS));

class CiCdValidator {
  /**
   * Validates a CiCdPlan against strict security, platform, and boundary rules
   */
  static validatePlan(plan, projectMetadata = null) {
    const errors = [];
    const warnings = [];

    if (!plan) {
      return {
        ok: false,
        errors: [{ code: 'INVALID_PLAN', message: 'Plan cannot be null or undefined' }],
        warnings
      };
    }

    // 1. Platform support
    if (!SUPPORTED_CI_PLATFORMS.includes(plan.platform)) {
      errors.push({
        code: 'UNSUPPORTED_CI_PLATFORM',
        message: `CI platform '${plan.platform}' is unsupported in Phase 4E. GitHub Actions is the sole supported platform.`,
        retryable: false
      });
    }

    // 2. Runtime support
    if (!SUPPORTED_RUNTIMES.includes(plan.runtime)) {
      errors.push({
        code: 'UNSUPPORTED_RUNTIME',
        message: `Runtime '${plan.runtime}' is unsupported. Only Node.js is supported in this phase.`,
        retryable: false
      });
    }

    // 3. Permissions Validation (Structured least-privilege only)
    if (!plan.permissions || typeof plan.permissions !== 'object' || Array.isArray(plan.permissions)) {
      errors.push({
        code: 'INVALID_PIPELINE_PERMISSIONS',
        message: 'Permissions must be a structured object (e.g. { contents: "read" }). Arrays, strings, or broad permissions are rejected.',
        retryable: false
      });
    } else {
      for (const [scope, level] of Object.entries(plan.permissions)) {
        if (!ALLOWED_PERMISSIONS.has(scope)) {
          errors.push({
            code: 'INVALID_PIPELINE_PERMISSIONS',
            message: `Unrecognized permission scope: "${scope}".`,
            retryable: false
          });
        }
        if (!ALLOWED_PERMISSION_VALUES.has(level)) {
          errors.push({
            code: 'INVALID_PIPELINE_PERMISSIONS',
            message: `Overly permissive permission value "${level}" for scope "${scope}". Only "read" or "none" permitted in default CI.`,
            retryable: false
          });
        }
      }
    }

    // 4. Output directory path safety
    if (typeof plan.workflowOutputDir === 'string') {
      const lower = plan.workflowOutputDir.toLowerCase();
      if (lower.includes('..') || path.isAbsolute(plan.workflowOutputDir) || lower.startsWith('/') || lower.startsWith('\\')) {
        errors.push({
          code: 'PATH_TRAVERSAL_DETECTED',
          message: `Workflow output directory contains path traversal or absolute escape: "${plan.workflowOutputDir}"`,
          retryable: false
        });
      }
      if (/[;&|<>`$]/.test(plan.workflowOutputDir)) {
        errors.push({
          code: 'DANGEROUS_PATH_CHARACTERS',
          message: `Workflow output directory contains dangerous shell characters: "${plan.workflowOutputDir}"`,
          retryable: false
        });
      }
    }

    // 5. Action Pinning Mode
    if (plan.actionPinningMode === 'major_tag') {
      warnings.push({
        code: 'MUTABLE_ACTION_TAG',
        message: 'Workflow uses mutable major tags (@v4) instead of verified immutable 40-character commit SHAs.'
      });
    }

    // 6. npm install script policy
    if (plan.installScriptPolicy === 'standard') {
      warnings.push({
        code: 'UNSAFE_INSTALL_SCRIPTS',
        message: 'Workflow configured to run dependency install scripts (npm ci without --ignore-scripts). Verify dependency supply chain.'
      });
    }

    // 7. Test framework validation
    if (plan.testFramework && !SUPPORTED_TEST_FRAMEWORKS.includes(plan.testFramework)) {
      errors.push({
        code: 'UNSUPPORTED_TEST_FRAMEWORK',
        message: `Test framework '${plan.testFramework}' is unsupported. Supported: ${SUPPORTED_TEST_FRAMEWORKS.join(', ')}`,
        retryable: false
      });
    }

    // 8. Database engine validation
    if (plan.databaseConfig) {
      const engine = plan.databaseConfig.engine?.toLowerCase();
      if (!engine || !SUPPORTED_DATABASE_ENGINES.includes(engine)) {
        errors.push({
          code: 'UNSUPPORTED_DATABASE_ENGINE',
          message: `Database engine '${engine || 'unknown'}' is unsupported for ephemeral CI services. Supported: ${SUPPORTED_DATABASE_ENGINES.join(', ')}`,
          retryable: false
        });
      }
    }

    // 9. Node version matrix bounds
    if (Array.isArray(plan.nodeVersions)) {
      for (const v of plan.nodeVersions) {
        const cleanV = String(v).replace(/^v/, '');
        const major = parseInt(cleanV, 10);
        if (isNaN(major) || major < 18) {
          errors.push({
            code: 'UNRESOLVED_RUNTIME_MATRIX',
            message: `Unsupported or obsolete Node version "${v}". Node LTS versions 18.x or higher required.`,
            retryable: false
          });
        }
      }
    }

    // 10. Workspace-level dependency inspections (if workspacePath provided)
    if (plan.workspacePath && fs.existsSync(plan.workspacePath)) {
      const pkgPath = path.join(plan.workspacePath, 'package.json');
      const lockPath = path.join(plan.workspacePath, 'package-lock.json');
      const shrinkwrapPath = path.join(plan.workspacePath, 'npm-shrinkwrap.json');

      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const scripts = pkg.scripts || {};
          const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);

          // Lockfile check
          if (!fs.existsSync(lockPath) && !fs.existsSync(shrinkwrapPath)) {
            errors.push({
              code: 'MISSING_LOCKFILE',
              message: 'package-lock.json is missing in workspace. npm ci requires a lockfile to ensure reproducible builds.',
              retryable: false
            });
          }

          // Script verification
          if (plan.stages.lint && !scripts.lint) {
            errors.push({
              code: 'MISSING_REQUIRED_SCRIPT',
              message: 'Lint stage is enabled but no "lint" script is defined in package.json.scripts.',
              retryable: false
            });
          }
          if (plan.stages.test && !scripts.test) {
            errors.push({
              code: 'MISSING_REQUIRED_SCRIPT',
              message: 'Test stage is enabled but no "test" script is defined in package.json.scripts.',
              retryable: false
            });
          }
          if (plan.stages.build && !scripts.build) {
            errors.push({
              code: 'MISSING_REQUIRED_SCRIPT',
              message: 'Build stage is enabled but no "build" script is defined in package.json.scripts.',
              retryable: false
            });
          }

          // Playwright dependency boundary
          if (plan.testFramework === 'playwright' || (scripts.test && scripts.test.includes('playwright'))) {
            if (!allDeps['@playwright/test'] && !allDeps['playwright']) {
              errors.push({
                code: 'PLAYWRIGHT_DEPENDENCY_MISSING',
                message: 'Playwright testing configured but @playwright/test is not installed in package.json dependencies.',
                retryable: false
              });
            }
          }

          // Database driver verification (if DB stage requested)
          if (plan.stages.databaseMigration) {
            if (!scripts['db:migrate'] && !scripts['migrate']) {
              errors.push({
                code: 'AMBIGUOUS_MIGRATION_COMMAND',
                message: 'Database migration stage enabled but no "db:migrate" or "migrate" script exists in package.json.',
                retryable: false
              });
            }
          }

          // Verify package scripts do not contain dangerous injection patterns
          for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
            if (typeof scriptCmd === 'string') {
              for (const pattern of PROHIBITED_COMMAND_PATTERNS) {
                if (pattern.test(scriptCmd)) {
                  errors.push({
                    code: 'DANGEROUS_COMMAND_PATTERN',
                    message: `Package script "${scriptName}" contains dangerous command injection pattern: ${scriptCmd}`,
                    retryable: false
                  });
                  break;
                }
              }
            }
          }
        } catch {
          // Ignore package.json read failure
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates command strings against injection and allowlist policies
   */
  static validateCommand(commandStr) {
    if (!commandStr || typeof commandStr !== 'string') return false;

    // Check prohibited injection patterns
    for (const pattern of PROHIBITED_COMMAND_PATTERNS) {
      if (pattern.test(commandStr)) return false;
    }

    // Check allowlisted prefixes
    const clean = commandStr.trim();
    if (clean.startsWith('npm ') ||
        clean.startsWith('npx playwright ') ||
        clean.startsWith('./node_modules/.bin/') ||
        clean.startsWith('node ')) {
      return true;
    }

    return false;
  }

  /**
   * Scans a workflow YAML text content for secret leakage
   */
  static scanForSecrets(yamlContent) {
    if (!yamlContent || typeof yamlContent !== 'string') return [];
    const leaks = [];

    const secretPatterns = [
      { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
      { name: 'Private Key Header', regex: /-----BEGIN\s+(?:RSA|OPENSSH|EC|DSA)?\s*PRIVATE KEY-----/ },
      { name: 'Hardcoded Password in env', regex: /(?:POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD|PASSWORD):\s*(?!testpassword\b)['"]?[a-zA-Z0-9!@#$%^&*]{8,}['"]?/i },
      { name: 'Credential Bearing URL', regex: /[a-zA-Z0-9+.-]+:\/\/(?!(?:testuser:testpassword|root:testpassword|postgres:testpassword)@(?:localhost|127\.0\.0\.1)\b)[a-zA-Z0-9._%+-]+:[^@\s]+@/i },
      { name: 'GitHub Token Hardcoded', regex: /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/ }
    ];

    for (const pattern of secretPatterns) {
      if (pattern.regex.test(yamlContent)) {
        leaks.push(`Detected potential secret: ${pattern.name}`);
      }
    }

    return leaks;
  }
}

module.exports = {
  CiCdValidator,
  PROHIBITED_COMMAND_PATTERNS,
  OFFICIAL_ACTIONS
};
