/**
 * TestExecutionManager - Sandboxed, isolated test execution coordinator
 *
 * Implements safe, isolated execution with:
 * - Environment sanitization (secret/token stripping)
 * - Subprocess timeout enforcement and graceful termination
 * - Output scrubbing and secret masking
 * - Structured failure categorization (ASSERTION_FAILURE, TIMEOUT, SYNTAX_ERROR, etc.)
 * - Strict buffer caps (64KB max) preventing memory exhaustion
 * - Framework installation / dependency verification
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB cap

class TestExecutionManager {
  constructor(options = {}) {
    this.options = options;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 15000;
  }

  /**
   * Verifies if required framework runner is installed in target workspace
   * @param {string} framework
   * @param {string} cwd
   * @returns {{ installed: boolean, error?: object }}
   */
  checkFrameworkInstalled(framework, cwd = process.cwd()) {
    if (!framework || framework === 'node:test') {
      // Native to Node 22+
      return { installed: true };
    }

    const fw = String(framework).toLowerCase().trim();

    if (fw === 'jest') {
      const hasPkg = fs.existsSync(path.join(cwd, 'package.json'));
      if (hasPkg) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
          const hasJest = (pkg.dependencies && pkg.dependencies.jest) ||
                          (pkg.devDependencies && pkg.devDependencies.jest) ||
                          fs.existsSync(path.join(cwd, 'node_modules', 'jest'));
          if (hasJest) return { installed: true };
        } catch {
          // parse error fallback
        }
      }
      return {
        installed: false,
        error: {
          code: 'DEPENDENCY_ERROR',
          message: 'Jest is not installed in the workspace dependencies'
        }
      };
    }

    if (fw === 'playwright') {
      const hasPkg = fs.existsSync(path.join(cwd, 'package.json'));
      if (hasPkg) {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
          const hasPw = (pkg.dependencies && pkg.dependencies['@playwright/test']) ||
                        (pkg.devDependencies && pkg.devDependencies['@playwright/test']) ||
                        fs.existsSync(path.join(cwd, 'node_modules', '@playwright', 'test'));
          if (hasPw) return { installed: true };
        } catch {
          // parse error fallback
        }
      }
      return {
        installed: false,
        error: {
          code: 'DEPENDENCY_ERROR',
          message: 'Playwright (@playwright/test) is not installed in the workspace dependencies'
        }
      };
    }

    return { installed: true };
  }

  /**
   * Sanitizes environment variables for test subprocess
   * Strips all API keys, database connection strings, auth secrets, and tokens
   * @param {object} [extraEnv={}]
   * @returns {object} Clean environment
   */
  sanitizeEnvironment(extraEnv = {}) {
    const cleanEnv = {};
    const sensitivePatterns = [
      /KEY/i,
      /SECRET/i,
      /TOKEN/i,
      /PASSWORD/i,
      /CREDENTIAL/i,
      /DATABASE_URL/i,
      /CONNECTION_STRING/i,
      /PRIVATE/i,
      /AUTH/i,
      /AWS_/i,
      /GOOGLE_/i,
      /AZURE_/i,
      /VERCEL_/i,
      /NETLIFY_/i,
      /PROXY/i
    ];

    // Copy only safe standard environment variables
    const safeKeys = [
      'PATH',
      'PATHEXT',
      'SYSTEMROOT',
      'TEMP',
      'TMP',
      'HOMEDRIVE',
      'HOMEPATH',
      'USERPROFILE',
      'NODE_ENV',
      'CI'
    ];

    for (const key of safeKeys) {
      if (process.env[key] !== undefined) {
        cleanEnv[key] = process.env[key];
      }
    }

    cleanEnv.NODE_ENV = 'test';
    cleanEnv.CI = 'true';

    // Merge in extraEnv, filtering out anything matching sensitive patterns
    for (const [k, v] of Object.entries(extraEnv)) {
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(k));
      if (!isSensitive) {
        cleanEnv[k] = String(v);
      }
    }

    return cleanEnv;
  }

  /**
   * Scrubs sensitive tokens, private keys, and paths from output strings
   * @param {string} text
   * @returns {string}
   */
  redactOutput(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi, '***REDACTED_PRIVATE_KEY***')
      .replace(/\bAIza[0-9A-Za-z-_]{30,40}\b/g, '***REDACTED_GOOGLE_KEY***')
      .replace(/(?:key|secret|token|password|bearer|auth)[=:\s]+["']?([a-zA-Z0-9_\-\.]{8,})["']?/gi, '$1=***REDACTED***')
      .replace(/(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^\s"']+/gi, '***REDACTED_DATABASE_URL***');
  }

  /**
   * Classifies test output and exit code into a structured category
   * @param {number|null} exitCode
   * @param {string} stdout
   * @param {string} stderr
   * @param {boolean} timedOut
   * @returns {string}
   */
  classifyFailure(exitCode, stdout = '', stderr = '', timedOut = false) {
    if (timedOut) return 'TIMEOUT';
    if (exitCode === 0) return 'EXECUTION_SUCCESS';

    const combined = `${stdout}\n${stderr}`;
    if (/SyntaxError/i.test(combined)) return 'SYNTAX_ERROR';
    if (/MODULE_NOT_FOUND|Cannot find module/i.test(combined)) return 'MODULE_NOT_FOUND';
    if (/AssertionError|assert\.ok|expect\(.+?\)\.|Assertion failed/i.test(combined)) return 'ASSERTION_FAILURE';
    if (/TypeError/i.test(combined)) return 'TYPE_ERROR';
    if (/ReferenceError/i.test(combined)) return 'REFERENCE_ERROR';

    return 'GENERIC_FAILURE';
  }

  /**
   * Executes test command inside isolated sandbox
   * @param {object} params
   * @param {string} params.command Executable (e.g. 'node' or 'npx')
   * @param {string[]} params.args Arguments array
   * @param {string} [params.cwd] Working directory
   * @param {string} [params.framework] 'node:test' | 'jest' | 'playwright'
   * @param {number} [params.timeoutMs]
   * @param {object} [params.env]
   * @param {boolean} [params.dryRun] If true, simulates execution without spawning
   * @returns {Promise<object>}
   */
  async execute(params = {}) {
    const {
      command = 'node',
      args = [],
      cwd = process.cwd(),
      framework = 'node:test',
      timeoutMs = this.defaultTimeoutMs,
      env = {},
      dryRun = false
    } = params;

    const startTime = Date.now();

    // 1. Command allowlist check
    const allowedCommands = ['node', 'npm', 'npx'];
    const baseCommand = path.basename(command).replace(/\.exe$/i, '').replace(/\.cmd$/i, '').toLowerCase();
    if (!allowedCommands.includes(baseCommand)) {
      return {
        ok: false,
        status: 'DISALLOWED_COMMAND',
        exitCode: 1,
        durationMs: 0,
        passed: 0,
        failed: 1,
        total: 1,
        error: {
          code: 'DISALLOWED_COMMAND',
          message: `Command '${command}' is not permitted for test execution. Permitted: ${allowedCommands.join(', ')}`
        },
        stdout: '',
        stderr: `SecurityError: Command '${command}' rejected by TestExecutionManager`
      };
    }

    // 2. Sensitive arguments check (reject .. path traversal, .env, private keys, or command chaining in args)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (typeof arg === 'string') {
        const lower = arg.toLowerCase();
        const isEvalArg = i > 0 && args[i - 1] === '-e';
        if (lower.includes('..') || lower.includes('.env') || lower.includes('id_rsa') || lower.includes('.pem') || (!isEvalArg && /[;&|<>`$]/.test(arg))) {
          return {
            ok: false,
            status: 'SECURITY_VIOLATION',
            exitCode: 1,
            durationMs: 0,
            passed: 0,
            failed: 1,
            total: 1,
            error: {
              code: 'SECURITY_VIOLATION',
              message: `Argument "${arg}" rejected by security policy (path traversal, sensitive file, or shell metacharacter)`
            },
            stdout: '',
            stderr: `SecurityError: Argument "${arg}" rejected`
          };
        }
      }
    }

    // 3. Framework installation check
    if (framework && framework !== 'node:test') {
      const depCheck = this.checkFrameworkInstalled(framework, cwd);
      if (!depCheck.installed) {
        return {
          ok: false,
          status: 'DEPENDENCY_ERROR',
          exitCode: 1,
          durationMs: 0,
          passed: 0,
          failed: 1,
          total: 1,
          error: depCheck.error,
          stdout: '',
          stderr: depCheck.error.message
        };
      }
    }

    // 4. Dry-run simulation
    if (dryRun) {
      return {
        ok: true,
        status: 'EXECUTION_SUCCESS',
        exitCode: 0,
        durationMs: 15,
        passed: 1,
        failed: 0,
        total: 1,
        stdout: 'Tests simulated successfully in dry-run mode.',
        stderr: ''
      };
    }

    const sanitizedEnv = this.sanitizeEnvironment(env);

    return new Promise((resolve) => {
      let stdoutData = '';
      let stderrData = '';
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let isTimedOut = false;
      let settled = false;

      let child;
      try {
        child = spawn(command, args, {
          cwd,
          env: sanitizedEnv,
          shell: false,
          windowsHide: true
        });
      } catch (err) {
        return resolve({
          ok: false,
          status: 'SPAWN_ERROR',
          exitCode: 1,
          durationMs: Date.now() - startTime,
          passed: 0,
          failed: 1,
          total: 1,
          stdout: '',
          stderr: err.message,
          error: {
            code: 'SPAWN_ERROR',
            message: err.message
          }
        });
      }

      const timer = setTimeout(() => {
        isTimedOut = true;
        try {
          child.kill('SIGTERM');
          setTimeout(() => {
            if (!settled) {
              try { child.kill('SIGKILL'); } catch {}
            }
          }, 500);
        } catch {
          // ignore
        }
      }, timeoutMs);

      if (child.stdout) {
        child.stdout.on('data', (chunk) => {
          if (!stdoutTruncated) {
            stdoutData += chunk.toString('utf8');
            if (stdoutData.length >= MAX_OUTPUT_BYTES) {
              stdoutData = stdoutData.slice(0, MAX_OUTPUT_BYTES) + '\n[...OUTPUT TRUNCATED: Exceeded 64KB buffer limit...]';
              stdoutTruncated = true;
            }
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (chunk) => {
          if (!stderrTruncated) {
            stderrData += chunk.toString('utf8');
            if (stderrData.length >= MAX_OUTPUT_BYTES) {
              stderrData = stderrData.slice(0, MAX_OUTPUT_BYTES) + '\n[...OUTPUT TRUNCATED: Exceeded 64KB buffer limit...]';
              stderrTruncated = true;
            }
          }
        });
      }

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          ok: false,
          status: 'SPAWN_ERROR',
          exitCode: 1,
          durationMs: Date.now() - startTime,
          passed: 0,
          failed: 1,
          total: 1,
          stdout: this.redactOutput(stdoutData),
          stderr: this.redactOutput(stderrData + '\n' + err.message),
          error: {
            code: 'SPAWN_ERROR',
            message: err.message
          }
        });
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const durationMs = Date.now() - startTime;
        const redactedStdout = this.redactOutput(stdoutData);
        const redactedStderr = this.redactOutput(stderrData);
        const status = this.classifyFailure(code, redactedStdout, redactedStderr, isTimedOut);
        const ok = code === 0 && !isTimedOut;

        // Parse approximate pass/fail counts if node:test or jest formatted
        let passed = ok ? 1 : 0;
        let failed = ok ? 0 : 1;
        const passMatch = redactedStdout.match(/pass(?:ed)?\s+(\d+)/i);
        const failMatch = redactedStdout.match(/fail(?:ed)?\s+(\d+)/i);
        if (passMatch) passed = parseInt(passMatch[1], 10);
        if (failMatch) failed = parseInt(failMatch[1], 10);

        resolve({
          ok,
          status,
          exitCode: isTimedOut ? 124 : code,
          durationMs,
          passed,
          failed,
          total: passed + failed,
          timedOut: isTimedOut,
          stdout: redactedStdout,
          stderr: redactedStderr
        });
      });
    });
  }
}

TestExecutionManager.TestExecutionManager = TestExecutionManager;
module.exports = TestExecutionManager;
