'use strict';

/**
 * AI-Dost 2.0 — Phase 4F: FactoryValidator
 * 
 * Strict input, workspace boundary, offline boundary, conflict detection,
 * and secret/absolute path leak detection for the Software Factory.
 */

const path = require('path');
const fs = require('fs');

const SUPPORTED_FRAMEWORKS = Object.freeze({
  frontend: ['react-vite'],
  backend: ['express'],
  database: ['sqlite']
});

const DISALLOWED_FRAMEWORK_KEYWORDS = [
  'django',
  'rails',
  'ruby on rails',
  'flask',
  'spring',
  'laravel',
  'asp.net',
  'angular',
  'vue',
  'svelte',
  'nextjs',
  'remix'
];

const UNSAFE_COMMAND_PATTERNS = [
  /[;&|`$]/,              // Shell metacharacters and chaining
  /\b(curl|wget|nc|netcat|bash|sh|powershell|cmd\.exe)\b/i,
  /\b(npm\s+install|npm\s+i|npm\s+update|yarn|pnpm|npx)\b/i
];

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'RSA/EC Private Key', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'GitHub Personal Token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/ },
  { name: 'Slack Token', regex: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Generic High-Entropy Secret', regex: /(?:secret|password|apikey|api_key|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{24,}['"]/i }
];

// Production credential DB URLs (excluding localhost and sqlite)
const PRODUCTION_DB_URL_REGEX = /\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@(?!(?:localhost|127\.0\.0\.1|::1)\b)[^/\s:]+(?::\d+)?\/?\S*\b/i;

// Absolute user home directory pattern (Windows and Unix)
const ABSOLUTE_USER_HOME_PATH_REGEX = /(?:[A-Za-z]:(?:\\|\/|\\\\)Users(?:\\|\/|\\\\)[^"'`\r\n;]+|\/home\/[^"'`\r\n;\s]+|\/Users\/[^"'`\r\n;\s]+)/i;

class FactoryValidator {
  /**
   * Validates high-level project specification and user prompt
   */
  static validateInput(spec) {
    const errors = [];
    const warnings = [];

    if (!spec) {
      return { ok: false, errors: ['Project specification cannot be null or undefined'], warnings };
    }

    const promptText = typeof spec === 'string' ? spec : (spec.prompt || spec.description || spec.name || '');

    if (!promptText || promptText.trim().length === 0) {
      return { ok: false, errors: ['Empty or whitespace-only project prompt is not supported'], warnings };
    }

    const lowerPrompt = promptText.toLowerCase();

    // 1. Check for disallowed/unsupported frameworks
    for (const kw of DISALLOWED_FRAMEWORK_KEYWORDS) {
      if (lowerPrompt.includes(kw)) {
        errors.push(`Unsupported framework requested: '${kw}'. Supported baseline is React/Vite + Express + SQLite.`);
      }
    }

    // 2. Check for shell injection or unsafe command patterns in input prompt
    for (const pattern of UNSAFE_COMMAND_PATTERNS) {
      if (pattern.test(promptText)) {
        errors.push(`Unsafe shell metacharacter or remote package command detected in prompt.`);
        break;
      }
    }

    // 3. Framework options validation if object provided
    if (typeof spec === 'object') {
      if (spec.frontendFramework && !SUPPORTED_FRAMEWORKS.frontend.includes(spec.frontendFramework)) {
        errors.push(`Unsupported frontendFramework '${spec.frontendFramework}'. Supported: ${SUPPORTED_FRAMEWORKS.frontend.join(', ')}`);
      }
      if (spec.backendFramework && !SUPPORTED_FRAMEWORKS.backend.includes(spec.backendFramework)) {
        errors.push(`Unsupported backendFramework '${spec.backendFramework}'. Supported: ${SUPPORTED_FRAMEWORKS.backend.join(', ')}`);
      }
      if (spec.databaseType && !SUPPORTED_FRAMEWORKS.database.includes(spec.databaseType)) {
        errors.push(`Unsupported databaseType '${spec.databaseType}'. Supported: ${SUPPORTED_FRAMEWORKS.database.join(', ')}`);
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates target file path against workspace boundaries (blocks directory traversal)
   */
  static validateWorkspacePath(workspaceRoot, targetRelPath) {
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      return { ok: false, error: 'Invalid workspaceRoot' };
    }
    if (!targetRelPath || typeof targetRelPath !== 'string') {
      return { ok: false, error: 'Invalid targetRelPath' };
    }

    const canonicalRoot = path.resolve(workspaceRoot);
    const resolvedTarget = path.resolve(canonicalRoot, targetRelPath);

    // Normalize forward slashes for cross-platform prefix comparison
    const normRoot = canonicalRoot.replace(/\\/g, '/');
    const normTarget = resolvedTarget.replace(/\\/g, '/');

    if (!normTarget.startsWith(normRoot + '/') && normTarget !== normRoot) {
      return {
        ok: false,
        error: `Workspace traversal blocked: path '${targetRelPath}' escapes root '${workspaceRoot}'`,
        code: 'WORKSPACE_TRAVERSAL_DETECTED'
      };
    }

    return {
      ok: true,
      resolvedPath: resolvedTarget
    };
  }

  /**
   * Scans content buffer or string for secret leaks and absolute machine user paths
   */
  static scanForSecretsAndPaths(content, filename = 'buffer') {
    const text = typeof content === 'string' ? content : content.toString('utf-8');
    const detected = [];

    // 1. High-severity secrets
    for (const { name, regex } of SECRET_PATTERNS) {
      if (regex.test(text)) {
        detected.push({ type: 'SECRET_LEAK', name, file: filename });
      }
    }

    // 2. Production DB URL with cleartext credentials
    if (PRODUCTION_DB_URL_REGEX.test(text)) {
      detected.push({ type: 'PRODUCTION_CREDENTIAL_URL', name: 'Production Database URL', file: filename });
    }

    // 3. Absolute user home directory leak
    if (ABSOLUTE_USER_HOME_PATH_REGEX.test(text)) {
      detected.push({ type: 'MACHINE_PATH_LEAK', name: 'Absolute Machine User Path', file: filename });
    }

    return {
      clean: detected.length === 0,
      detected
    };
  }

  /**
   * Detects pre-existing unmanaged file conflicts in the target workspace
   */
  static detectExistingFileConflicts(workspaceRoot, proposedFiles = new Map()) {
    const conflicts = [];

    for (const [relPath, newContent] of proposedFiles.entries()) {
      const fullPath = path.resolve(workspaceRoot, relPath);
      if (fs.existsSync(fullPath)) {
        const existingContent = fs.readFileSync(fullPath, 'utf-8');
        if (existingContent !== newContent) {
          conflicts.push({
            path: relPath,
            reason: 'File already exists with differing content',
            existingLength: existingContent.length,
            proposedLength: newContent.length
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }
}

module.exports = {
  FactoryValidator,
  SUPPORTED_FRAMEWORKS,
  DISALLOWED_FRAMEWORK_KEYWORDS,
  UNSAFE_COMMAND_PATTERNS,
  SECRET_PATTERNS,
  PRODUCTION_DB_URL_REGEX,
  ABSOLUTE_USER_HOME_PATH_REGEX
};
