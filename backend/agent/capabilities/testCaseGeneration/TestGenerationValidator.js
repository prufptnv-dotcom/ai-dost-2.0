'use strict';

const path = require('node:path');
const PlanModule = require('./TestGenerationPlan');

const SUPPORTED_FRAMEWORKS = PlanModule.SUPPORTED_FRAMEWORKS || ['node:test', 'jest', 'playwright'];
const SUPPORTED_LANGUAGES = PlanModule.SUPPORTED_LANGUAGES || ['javascript', 'typescript'];
const SUPPORTED_TEST_TYPES = PlanModule.SUPPORTED_TEST_TYPES || ['unit', 'integration', 'database', 'security', 'e2e', 'all'];

const ALLOWED_TARGET_EXTENSIONS = Object.freeze([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'
]);

const PROMPT_INJECTION_PATTERNS = Object.freeze([
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /bypass\s+(security|gatekeeper|sandbox)/i,
  /system\s+override/i,
  /grant\s+admin/i,
  /print\s+process\.env/i,
  /<script\b[^>]*>[\s\S]*?<\/script>/i
]);

const FORBIDDEN_SHELL_PATTERNS = Object.freeze([
  /\brm\s+-[rf]{1,2}\b/i,
  /\bformat\s+[c-z]:/i,
  /\bdiskpart\b/i,
  /\bdel\s+\/[fsq]/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\b:\(\)\s*\{/ // fork bomb
]);

class TestGenerationValidator {
  static get SUPPORTED_FRAMEWORKS() {
    return SUPPORTED_FRAMEWORKS;
  }

  static get SUPPORTED_LANGUAGES() {
    return SUPPORTED_LANGUAGES;
  }

  static get SUPPORTED_TEST_TYPES() {
    return SUPPORTED_TEST_TYPES;
  }

  /**
   * Validates framework against repository installed/supported list
   */
  static validateFramework(framework) {
    const raw = String(framework || '').toLowerCase().trim();
    if (SUPPORTED_FRAMEWORKS.includes(raw)) {
      return { valid: true, framework: raw };
    }
    return {
      valid: false,
      error: {
        code: 'UNSUPPORTED_TEST_FRAMEWORK',
        message: `The requested test framework "${framework}" is not supported in this workspace. Supported frameworks: ${SUPPORTED_FRAMEWORKS.join(', ')}`,
        details: { requested: framework, supported: Array.from(SUPPORTED_FRAMEWORKS) },
        retryable: false
      }
    };
  }

  /**
   * Validates target programming language
   */
  static validateLanguage(language) {
    const raw = String(language || '').toLowerCase().trim();
    if (SUPPORTED_LANGUAGES.includes(raw)) {
      return { valid: true, language: raw };
    }
    return {
      valid: false,
      error: {
        code: 'UNSUPPORTED_LANGUAGE',
        message: `Test language "${language}" is not supported. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
        retryable: false
      }
    };
  }

  /**
   * Validates path safety, rejecting path traversal, sensitive files, and shell metacharacters
   */
  static validatePathSafety(filePath, baseDir = null) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, code: 'INVALID_PATH', reason: 'File path must be a non-empty string' };
    }

    // Check shell metacharacters
    if (/[;&|<>`$]/.test(filePath)) {
      return { valid: false, code: 'DANGEROUS_TARGET_PATH', reason: `Dangerous shell characters detected in path "${filePath}"` };
    }

    // Check path traversal
    if (filePath.includes('..') || filePath.includes('\\..') || filePath.includes('/..')) {
      return { valid: false, code: 'PATH_TRAVERSAL_DETECTED', reason: `Path traversal attempt detected in path "${filePath}"` };
    }

    // Check .env target
    const baseName = path.basename(filePath).toLowerCase();
    if (baseName === '.env' || baseName.startsWith('.env.') || baseName.includes('id_rsa') || baseName.includes('.pem')) {
      return { valid: false, code: 'SENSITIVE_FILE_ACCESS', reason: `Access to sensitive environment or credential file "${filePath}" is blocked` };
    }

    // If baseDir provided, ensure resolved path is inside baseDir
    if (baseDir) {
      const resolved = path.resolve(baseDir, filePath);
      const resolvedBase = path.resolve(baseDir);
      if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
        return { valid: false, code: 'PATH_TRAVERSAL_DETECTED', reason: `Path "${filePath}" escapes base directory "${baseDir}"` };
      }
    }

    return { valid: true };
  }

  /**
   * Validates command against forbidden shell patterns
   */
  static validateCommand(command) {
    if (!command || typeof command !== 'string') {
      return { valid: true };
    }
    for (const pattern of FORBIDDEN_SHELL_PATTERNS) {
      if (pattern.test(command)) {
        return {
          valid: false,
          code: 'DANGEROUS_COMMAND',
          reason: `Command blocked by security policy: matches dangerous pattern (${pattern.toString()})`
        };
      }
    }
    return { valid: true };
  }

  /**
   * Inspects source code, comments, or requirements for prompt injection
   */
  static inspectTextSecurity(text) {
    if (!text || typeof text !== 'string') return { safe: true };
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return { safe: false, code: 'PROMPT_INJECTION_DETECTED', reason: `Prompt injection pattern detected: ${pattern.toString()}` };
      }
    }
    return { safe: true };
  }

  /**
   * Main validation method for a TestGenerationPlan
   */
  static validate(plan) {
    const errors = [];
    const warnings = [];

    if (!plan || typeof plan !== 'object') {
      return {
        valid: false,
        errors: [{ code: 'INVALID_PLAN', message: 'Plan must be a valid object' }],
        warnings
      };
    }

    // 1. Prototype pollution guard
    if (Object.prototype.hasOwnProperty.call(plan, '__proto__') || Object.prototype.hasOwnProperty.call(plan, 'constructor')) {
      errors.push({ code: 'PROTOTYPE_POLLUTION', message: 'Prototype pollution payload detected in plan' });
    }

    // 2. Framework validation
    const fwValidation = this.validateFramework(plan.framework);
    if (!fwValidation.valid) {
      errors.push(fwValidation.error);
      return {
        valid: false,
        unsupportedFramework: true,
        error: fwValidation.error,
        errors,
        warnings
      };
    }

    // 3. Language validation
    const langValidation = this.validateLanguage(plan.language);
    if (!langValidation.valid) {
      errors.push(langValidation.error);
    }

    // 4. Test type validation
    if (plan.testType && !SUPPORTED_TEST_TYPES.includes(String(plan.testType).toLowerCase())) {
      errors.push({
        code: 'INVALID_TEST_TYPE',
        message: `Invalid testType "${plan.testType}". Supported test types: ${SUPPORTED_TEST_TYPES.join(', ')}`
      });
    }

    // 5. Target paths validation
    const targetFiles = Array.isArray(plan.targetFiles) ? plan.targetFiles : [];
    for (const file of targetFiles) {
      const pCheck = this.validatePathSafety(file, plan.workspacePath);
      if (!pCheck.valid) {
        errors.push({
          code: pCheck.code || 'INVALID_TARGET_PATH',
          message: `Target file "${file}": ${pCheck.reason}`
        });
      } else {
        const ext = path.extname(file).toLowerCase();
        if (ext && !ALLOWED_TARGET_EXTENSIONS.includes(ext)) {
          errors.push({
            code: 'INVALID_TARGET_EXTENSION',
            message: `Target file "${file}" has unsupported extension "${ext}". Supported: ${ALLOWED_TARGET_EXTENSIONS.join(', ')}`
          });
        }
      }
    }

    // 6. Output directory validation
    if (plan.outputDir) {
      const outCheck = this.validatePathSafety(plan.outputDir, plan.workspacePath);
      if (!outCheck.valid) {
        errors.push({
          code: outCheck.code === 'PATH_TRAVERSAL_DETECTED' ? 'INVALID_OUTPUT_DIR' : (outCheck.code || 'INVALID_OUTPUT_DIR'),
          message: `Output directory "${plan.outputDir}": ${outCheck.reason}`
        });
      }
    }

    // 7. Timeout validation
    if (typeof plan.timeoutMs === 'number') {
      if (plan.timeoutMs < 100 || plan.timeoutMs > 60000) {
        errors.push({
          code: 'INVALID_TIMEOUT',
          message: `Invalid timeoutMs (${plan.timeoutMs}). Must be between 100ms and 60000ms`
        });
      }
    }

    // 8. Retries validation
    if (typeof plan.retries === 'number') {
      if (plan.retries < 0 || plan.retries > 5) {
        errors.push({
          code: 'INVALID_RETRIES',
          message: `Invalid retries count (${plan.retries}). Must be between 0 and 5`
        });
      }
    }

    // 9. Command policy check if custom command supplied
    if (plan.customCommand) {
      const cmdCheck = this.validateCommand(plan.customCommand);
      if (!cmdCheck.valid) {
        errors.push({
          code: cmdCheck.code || 'INVALID_COMMAND',
          message: cmdCheck.reason
        });
      }
    }

    // 10. Prompt injection inspection
    const textToCheck = [
      plan.options?.description,
      plan.description,
      plan.prompt,
      plan.userPrompt
    ].filter(Boolean);

    for (const text of textToCheck) {
      const injectionCheck = this.inspectTextSecurity(text);
      if (!injectionCheck.safe) {
        errors.push({
          code: injectionCheck.code || 'PROMPT_INJECTION_DETECTED',
          message: injectionCheck.reason
        });
      }
    }

    // 11. Database target validation: block production DB targets
    if (plan.databaseTarget || plan.connectionUrl) {
      const target = String(plan.databaseTarget || plan.connectionUrl).toLowerCase();
      if (target.includes('prod') || target.includes('production') || target.includes('aws.neon.tech') || target.includes('rds.amazonaws.com')) {
        errors.push({
          code: 'PRODUCTION_DATABASE_BLOCKED',
          message: 'Production database target is blocked for test case generation and execution'
        });
      }
    }

    // 12. Coverage threshold validation
    if (plan.coverageGoal?.threshold !== undefined) {
      const th = plan.coverageGoal.threshold;
      if (typeof th !== 'number' || th < 0 || th > 100) {
        errors.push({
          code: 'INVALID_COVERAGE_THRESHOLD',
          message: `Invalid coverage threshold (${th}). Must be a number between 0 and 100`
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

TestGenerationValidator.TestGenerationValidator = TestGenerationValidator;
module.exports = TestGenerationValidator;
module.exports.TestGenerationValidator = TestGenerationValidator;
