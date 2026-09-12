'use strict';

const path = require('path');
const fs = require('fs');
const {
  SUPPORTED_CLIENT_STYLES,
  SUPPORTED_SCHEMA_FORMATS,
  SUPPORTED_VALIDATOR_MODES,
  SUPPORTED_LANGUAGES
} = require('./ApiIntegrationPlan');

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:previous|all)\s+instructions/i,
  /system\s+prompt\s*:/i,
  /you\s+are\s+now\s+an?\s+unrestricted/i,
  /bypass\s+all\s+(?:filters|guardrails|safety)/i,
  /drop\s+table\b/i
];

const CLOUD_METADATA_HOSTS = [
  '169.254.169.254',
  'metadata.google.internal',
  '100.100.100.200',
  'metadata.azure.com',
  'instance-data'
];

/**
 * Checks if a target workspace has a dependency installed
 */
function isDependencyInstalled(pkgName, workspacePath) {
  if (!workspacePath) {
    // Check root package.json if workspacePath not given
    workspacePath = path.resolve(__dirname, '../../..');
  }

  const candidatePaths = [
    path.join(workspacePath, 'package.json'),
    path.join(workspacePath, 'frontend', 'package.json'),
    path.join(workspacePath, 'backend', 'package.json')
  ];

  for (const pkgPath of candidatePaths) {
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
        if (deps[pkgName]) return true;
      }
    } catch {
      // Ignore parse error
    }
  }

  return false;
}

class ApiIntegrationValidator {
  /**
   * Validates an ApiIntegrationPlan against strict security and contract policies
   */
  static validatePlan(plan) {
    const errors = [];
    const warnings = [];

    if (!plan) {
      return {
        ok: false,
        errors: [{ code: 'INVALID_PLAN', message: 'Plan cannot be null or undefined' }],
        warnings
      };
    }

    // 1. Client Style validation
    if (!SUPPORTED_CLIENT_STYLES.includes(plan.clientStyle)) {
      errors.push({
        code: 'UNSUPPORTED_CLIENT_STYLE',
        message: `Client style '${plan.clientStyle}' is not supported. Supported: ${SUPPORTED_CLIENT_STYLES.join(', ')}`,
        retryable: false
      });
    }

    // 2. Schema Format validation
    if (!SUPPORTED_SCHEMA_FORMATS.includes(plan.schemaFormat)) {
      errors.push({
        code: 'UNSUPPORTED_SCHEMA_FORMAT',
        message: `Schema format '${plan.schemaFormat}' is not supported. Supported: ${SUPPORTED_SCHEMA_FORMATS.join(', ')}`,
        retryable: false
      });
    }

    // 3. Validator Mode validation
    if (!SUPPORTED_VALIDATOR_MODES.includes(plan.validatorMode)) {
      errors.push({
        code: 'UNSUPPORTED_VALIDATOR_MODE',
        message: `Validator mode '${plan.validatorMode}' is not supported. Supported: ${SUPPORTED_VALIDATOR_MODES.join(', ')}`,
        retryable: false
      });
    }

    // 4. Language validation
    if (!SUPPORTED_LANGUAGES.includes(plan.language)) {
      errors.push({
        code: 'UNSUPPORTED_LANGUAGE',
        message: `Language '${plan.language}' is not supported. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
        retryable: false
      });
    }

    // 5. Dependency check for Axios
    if (plan.clientStyle === 'axios') {
      const hasAxios = isDependencyInstalled('axios', plan.workspacePath);
      if (!hasAxios) {
        errors.push({
          code: 'DEPENDENCY_ERROR',
          message: 'Axios client style requested but "axios" is not installed in the workspace dependencies. Native fetch is available.',
          retryable: false
        });
      }
    }

    // 6. Dependency check for Zod
    if (plan.validatorMode === 'zod') {
      const hasZod = isDependencyInstalled('zod', plan.workspacePath);
      if (!hasZod) {
        errors.push({
          code: 'DEPENDENCY_ERROR',
          message: 'Zod validator mode requested but "zod" is not installed in the workspace dependencies. Runtime JS validators are available.',
          retryable: false
        });
      }
    }

    // 7. Path safety for output directories
    const pathTargets = [
      { name: 'clientOutputDir', val: plan.clientOutputDir },
      { name: 'openapiOutputDir', val: plan.openapiOutputDir }
    ];

    for (const target of pathTargets) {
      if (typeof target.val === 'string') {
        const lower = target.val.toLowerCase();
        if (lower.includes('..') || path.isAbsolute(target.val) || lower.startsWith('/') || lower.startsWith('\\')) {
          errors.push({
            code: 'PATH_TRAVERSAL_DETECTED',
            message: `Output directory '${target.name}' contains path traversal or absolute escape: "${target.val}"`,
            retryable: false
          });
        }
        if (/[;&|<>`$]/.test(target.val)) {
          errors.push({
            code: 'DANGEROUS_PATH_CHARACTERS',
            message: `Output directory '${target.name}' contains dangerous shell metacharacters: "${target.val}"`,
            retryable: false
          });
        }
        if (lower.includes('.env') || lower.includes('id_rsa') || lower.includes('.pem') || lower.includes('etc/passwd')) {
          errors.push({
            code: 'SENSITIVE_TARGET_DIRECTORY',
            message: `Output directory '${target.name}' targets sensitive files: "${target.val}"`,
            retryable: false
          });
        }
      }
    }

    // 8. Path safety for routeFiles
    if (Array.isArray(plan.routeFiles)) {
      for (const file of plan.routeFiles) {
        const lower = String(file).toLowerCase();
        if (lower.includes('..') && !lower.includes('node_modules')) {
          errors.push({
            code: 'PATH_TRAVERSAL_IN_ROUTE_FILE',
            message: `Route file contains path traversal: "${file}"`,
            retryable: false
          });
        }
        if (lower.includes('.env') || lower.includes('id_rsa') || lower.includes('.pem')) {
          errors.push({
            code: 'SENSITIVE_FILE_ACCESS',
            message: `Route file targets sensitive credential file: "${file}"`,
            retryable: false
          });
        }
      }
    }

    // 9. SSRF & URL safety for baseUrl
    if (typeof plan.baseUrl === 'string' && plan.baseUrl.trim().length > 0) {
      const urlStr = plan.baseUrl.trim();
      const lower = urlStr.toLowerCase();

      // Check unsafe protocols
      if (lower.startsWith('file:') || lower.startsWith('data:') || lower.startsWith('javascript:') || lower.startsWith('ftp:')) {
        errors.push({
          code: 'UNSAFE_URL_PROTOCOL',
          message: `Base URL uses an unsafe protocol: "${urlStr}". Only http:, https: or relative paths are permitted.`,
          retryable: false
        });
      }

      // Check credential-bearing URLs
      if (lower.includes('@') && (lower.startsWith('http://') || lower.startsWith('https://'))) {
        errors.push({
          code: 'CREDENTIAL_BEARING_URL',
          message: 'Base URL contains embedded userinfo/credentials. Authentication must use runtime tokens.',
          retryable: false
        });
      }

      // Check cloud metadata endpoints
      for (const metaHost of CLOUD_METADATA_HOSTS) {
        if (lower.includes(metaHost)) {
          errors.push({
            code: 'SSRF_METADATA_HOST_BLOCKED',
            message: `Base URL targets cloud metadata endpoint: "${urlStr}"`,
            retryable: false
          });
          break;
        }
      }

      // Check hardcoded production URLs
      if (/\b(?:api\.)?(?:prod|production)\.[a-z0-9.-]+\.[a-z]{2,}\b/i.test(urlStr)) {
        errors.push({
          code: 'HARDCODED_PRODUCTION_URL',
          message: `Base URL appears to point to a production endpoint: "${urlStr}". Use parameterized runtime environment variables.`,
          retryable: false
        });
      }
    }

    // 10. Prompt injection scan in project description or headers
    const textToCheck = [
      plan.projectId,
      JSON.stringify(plan.defaultHeaders || {})
    ].join(' ');

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(textToCheck)) {
        errors.push({
          code: 'PROMPT_INJECTION_DETECTED',
          message: 'Prompt injection pattern detected in API integration configuration',
          retryable: false
        });
        break;
      }
    }

    // 11. Timeout and retry bounds
    if (plan.timeoutMs < 100 || plan.timeoutMs > 60000) {
      errors.push({
        code: 'TIMEOUT_OUT_OF_BOUNDS',
        message: `timeoutMs must be between 100ms and 60000ms. Received: ${plan.timeoutMs}`,
        retryable: false
      });
    }

    if (plan.maxRetries < 0 || plan.maxRetries > 5) {
      errors.push({
        code: 'MAX_RETRIES_OUT_OF_BOUNDS',
        message: `maxRetries must be between 0 and 5. Received: ${plan.maxRetries}`,
        retryable: false
      });
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = {
  ApiIntegrationValidator,
  PROMPT_INJECTION_PATTERNS,
  CLOUD_METADATA_HOSTS,
  isDependencyInstalled
};
