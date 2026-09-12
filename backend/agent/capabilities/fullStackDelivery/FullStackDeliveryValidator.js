'use strict';

const SUPPORTED_FRONTEND_FRAMEWORKS = Object.freeze([
  'react-vite',
  'nextjs',
  'astro',
  'sveltekit'
]);

const SUPPORTED_BACKEND_FRAMEWORKS = Object.freeze([
  'express',
  'fastify',
  'nest',
  'node'
]);

const SUPPORTED_DATABASES = Object.freeze([
  'sqlite',
  'postgresql',
  'postgres',
  'mysql',
  'mongodb',
  'none'
]);

const SUPPORTED_LANGUAGES = Object.freeze([
  'javascript',
  'typescript'
]);

const SUPPORTED_PACKAGE_MANAGERS = Object.freeze([
  'npm',
  'yarn',
  'pnpm'
]);

// Prompt injection patterns targeting system prompts, permissions, or security policies
const PROMPT_INJECTION_PATTERNS = Object.freeze([
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /system\s+override/i,
  /override\s*:\s*disable/i,
  /bypass\s+(gatekeeper|security|diffengine|policy)/i,
  /disable\s+(all\s+)?(diffengine|gatekeeper|verification|checks|rollback|security)/i,
  /grant\s+(all\s+)?permissions/i,
  /rm\s+-rf\s+[\/\\]/i,
  /format\s+(?:c:|disk)/i,
  /drop\s+(?:table|database)/i,
  /<script\b[^>]*>[\s\S]*?<\/script>/i
]);

// Valid environment variable identifier pattern (e.g. PORT, DATABASE_URL)
const VALID_ENV_KEY_REGEX = /^[A-Z_][A-Z0-9_]*$/;

class FullStackDeliveryValidator {
  /**
   * Validate a plan contract against supported stacks and security constraints.
   * @param {object} plan
   * @returns {{ valid: boolean, errors: string[], warnings: string[], unsupportedItems: string[] }}
   */
  static validatePlan(plan) {
    const errors = [];
    const warnings = [];
    const unsupportedItems = [];

    if (!plan || typeof plan !== 'object') {
      return { valid: false, errors: ['Plan must be a valid object'], warnings: [], unsupportedItems: [] };
    }

    if (!plan.planId) errors.push('planId is required');
    if (!plan.requestId) errors.push('requestId is required');
    if (!plan.projectName) errors.push('projectName is required');

    // 1. Validate Frontend Framework
    const feFw = plan.framework?.frontend || plan.frontend?.framework;
    if (!feFw) {
      errors.push('Frontend framework is required');
    } else if (!SUPPORTED_FRONTEND_FRAMEWORKS.includes(feFw.toLowerCase())) {
      unsupportedItems.push(`frontend:${feFw}`);
      errors.push(`Unsupported frontend framework '${feFw}'. Supported: [${SUPPORTED_FRONTEND_FRAMEWORKS.join(', ')}]`);
    }

    // 2. Validate Backend Framework
    const beFw = plan.framework?.backend || plan.backend?.framework;
    if (!beFw) {
      errors.push('Backend framework is required');
    } else if (!SUPPORTED_BACKEND_FRAMEWORKS.includes(beFw.toLowerCase())) {
      unsupportedItems.push(`backend:${beFw}`);
      errors.push(`Unsupported backend framework '${beFw}'. Supported: [${SUPPORTED_BACKEND_FRAMEWORKS.join(', ')}]`);
    }

    // 3. Validate Database
    const dbEngine = plan.database?.engine;
    if (dbEngine && !SUPPORTED_DATABASES.includes(dbEngine.toLowerCase())) {
      unsupportedItems.push(`database:${dbEngine}`);
      errors.push(`Unsupported database engine '${dbEngine}'. Supported: [${SUPPORTED_DATABASES.join(', ')}]`);
    }

    // 4. Validate Language
    if (plan.language && !SUPPORTED_LANGUAGES.includes(plan.language.toLowerCase())) {
      unsupportedItems.push(`language:${plan.language}`);
      errors.push(`Unsupported language '${plan.language}'. Supported: [${SUPPORTED_LANGUAGES.join(', ')}]`);
    }

    // 5. Validate Package Manager
    if (plan.packageManager && !SUPPORTED_PACKAGE_MANAGERS.includes(plan.packageManager.toLowerCase())) {
      unsupportedItems.push(`packageManager:${plan.packageManager}`);
      errors.push(`Unsupported package manager '${plan.packageManager}'. Supported: [${SUPPORTED_PACKAGE_MANAGERS.join(', ')}]`);
    }

    // 6. Validate Environment Variables
    if (Array.isArray(plan.environmentVariables)) {
      for (const env of plan.environmentVariables) {
        if (!env.key || !VALID_ENV_KEY_REGEX.test(env.key)) {
          errors.push(`Invalid environment variable key '${env.key}'. Keys must contain only uppercase alphanumeric characters and underscores.`);
        }
      }
    }

    // 7. Security: Project Name Path Traversal
    if (plan.projectName && (plan.projectName.includes('..') || plan.projectName.includes('/') || plan.projectName.includes('\\'))) {
      errors.push(`Project name '${plan.projectName}' contains invalid path traversal characters.`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      unsupportedItems
    };
  }

  /**
   * Validates port configuration
   * @param {number[]} ports
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validatePorts(ports = []) {
    if (!Array.isArray(ports) || ports.length === 0) {
      return { valid: false, errors: ['Ports array cannot be empty'] };
    }
    const errors = [];
    for (const p of ports) {
      const num = Number(p);
      if (!Number.isInteger(num) || num < 1024 || num > 65535) {
        errors.push(`Port ${p} is out of safe non-privileged bounds (1024-65535)`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates safe relative path preventing path traversal
   * @param {string} relPath
   * @returns {{ valid: boolean, reason?: string }}
   */
  static validateSafeRelativePath(relPath) {
    if (!relPath || typeof relPath !== 'string') {
      return { valid: false, reason: 'Path must be a non-empty string' };
    }
    const normalized = relPath.replace(/\\/g, '/');
    if (
      normalized.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalized) ||
      normalized.includes('../') ||
      normalized.includes('..\\') ||
      normalized.endsWith('/..') ||
      normalized === '..'
    ) {
      return { valid: false, reason: 'Path traversal or absolute path detected' };
    }
    return { valid: true };
  }

  /**
   * Scans user prompt or specification for prompt injection attempts.
   * @param {string} text
   * @returns {{ safe: boolean, reason?: string }}
   */
  static inspectPromptSecurity(text) {
    if (!text || typeof text !== 'string') return { safe: true };

    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          safe: false,
          reason: `Security violation: Prompt contains restricted or adversarial pattern: ${pattern.toString()}`
        };
      }
    }

    return { safe: true };
  }
}

module.exports = {
  SUPPORTED_FRONTEND_FRAMEWORKS,
  SUPPORTED_BACKEND_FRAMEWORKS,
  SUPPORTED_DATABASES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_PACKAGE_MANAGERS,
  FullStackDeliveryValidator
};
