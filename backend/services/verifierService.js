const vm = require('vm');
const fs = require('fs');
const path = require('path');

class VerifierService {
  /**
   * Scans text content for leaked API keys, credentials, and secrets.
   */
  scanSecrets(content) {
    if (!content || typeof content !== 'string') return [];
    const findings = [];
    const lines = content.split('\n');

    const rules = [
      { name: 'Google API Key', regex: /\bAIza[0-9A-Za-z-_]{30,40}\b/ },
      { name: 'OpenAI Secret Key', regex: /\bsk-(?:proj-|live-)?[a-zA-Z0-9_-]{20,}\b/ },
      { name: 'GitHub Personal Token', regex: /\bgh[pousr]_[0-9a-zA-Z]{36}\b/ },
      { name: 'Slack Bot Token', regex: /\bxoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}\b/ },
      { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
      { name: 'Generic Hardcoded Secret Assignment', regex: /(?:apiKey|api_key|secret|password|authToken)\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{16,}["']/i }
    ];

    lines.forEach((line, idx) => {
      for (const rule of rules) {
        const match = line.match(rule.regex);
        if (match) {
          findings.push({
            rule: rule.name,
            type: rule.name,
            line: idx + 1,
            snippet: match[0].substring(0, 6) + '...' + match[0].slice(-4),
            message: `Hardcoded credential detected (${rule.name}) at line ${idx + 1}`
          });
        }
      }
    });

    return findings;
  }

  /**
   * Checks bracket balance and unclosed string literals for generic languages.
   */
  checkStructuralBalance(content) {
    const stack = [];
    const pairs = { '(': ')', '{': '}', '[': ']' };
    const openers = new Set(['(', '{', '[']);
    const closers = new Set([')', '}', ']']);
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1] || '';

      // Comments
      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if (!inLineComment && !inBlockComment && char === '/' && nextChar === '/') {
          inLineComment = true;
          i++;
          continue;
        }
        if (!inLineComment && !inBlockComment && char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
        if (inLineComment && char === '\n') {
          inLineComment = false;
          continue;
        }
        if (inBlockComment && char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++;
          continue;
        }
      }

      if (inLineComment || inBlockComment) continue;

      // Strings
      if (char === "'" && !inDoubleQuote && !inBacktick && content[i - 1] !== '\\') {
        inSingleQuote = !inSingleQuote;
        continue;
      }
      if (char === '"' && !inSingleQuote && !inBacktick && content[i - 1] !== '\\') {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }
      if (char === '`' && !inSingleQuote && !inDoubleQuote && content[i - 1] !== '\\') {
        inBacktick = !inBacktick;
        continue;
      }

      if (inSingleQuote || inDoubleQuote || inBacktick) continue;

      // Brackets
      if (openers.has(char)) {
        stack.push({ char, index: i });
      } else if (closers.has(char)) {
        if (stack.length === 0) {
          return { valid: false, message: `Unexpected closing bracket '${char}' at character ${i}` };
        }
        const last = stack.pop();
        if (pairs[last.char] !== char) {
          return { valid: false, message: `Mismatched bracket: expected '${pairs[last.char]}' but found '${char}' at character ${i}` };
        }
      }
    }

    if (inSingleQuote || inDoubleQuote || inBacktick) {
      return { valid: false, message: 'Unclosed string or template literal detected' };
    }

    if (stack.length > 0) {
      const unclosed = stack.pop();
      return { valid: false, message: `Unclosed bracket '${unclosed.char}' at character ${unclosed.index}` };
    }

    return { valid: true };
  }

  /**
   * Verifies source code syntax and checks for security/secret exposures.
   */
  verifyCode(filePath, content, options = {}) {
    const ext = path.extname(filePath || '').toLowerCase();
    const checks = [];
    const diagnostics = [];
    let syntaxValid = true;
    let syntaxError = null;

    // 1. Syntax Check
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      try {
        new vm.Script(content, { filename: filePath || 'script.js' });
        checks.push({ name: 'Syntax Parser (V8 VM)', passed: true });
      } catch (err) {
        syntaxValid = false;
        syntaxError = err.message;
        checks.push({ name: 'Syntax Parser (V8 VM)', passed: false, error: err.message });
        diagnostics.push({
          type: 'syntax',
          severity: 'error',
          message: err.message,
          line: err.stack?.match(/:(\d+):/)?.[1] ? parseInt(err.stack.match(/:(\d+):/)[1], 10) : 1
        });
      }
    } else if (ext === '.json') {
      try {
        JSON.parse(content);
        checks.push({ name: 'JSON Parser', passed: true });
      } catch (err) {
        syntaxValid = false;
        syntaxError = err.message;
        checks.push({ name: 'JSON Parser', passed: false, error: err.message });
        diagnostics.push({
          type: 'syntax',
          severity: 'error',
          message: err.message,
          line: 1
        });
      }
    } else if (['.jsx', '.ts', '.tsx', '.py', '.html', '.css'].includes(ext)) {
      // Balanced bracket & unclosed quote parser
      const balance = this.checkStructuralBalance(content);
      if (!balance.valid) {
        syntaxValid = false;
        syntaxError = balance.message;
        checks.push({ name: 'Structural Syntax Balance', passed: false, error: balance.message });
        diagnostics.push({
          type: 'syntax',
          severity: 'error',
          message: balance.message,
          line: 1
        });
      } else {
        checks.push({ name: 'Structural Syntax Balance', passed: true });
      }
    } else {
      checks.push({ name: 'Text Format Verification', passed: true });
    }

    // 2. Secret / Credentials Scanner
    const secrets = this.scanSecrets(content);
    if (secrets.length === 0) {
      checks.push({ name: 'Secret Shield', passed: true });
    } else {
      checks.push({ name: 'Secret Shield', passed: false, count: secrets.length });
      secrets.forEach(s => {
        diagnostics.push({
          type: 'security',
          severity: 'warning',
          message: s.message,
          line: s.line,
          snippet: s.snippet
        });
      });
    }

    // 3. Dependency Check (if package.json provided)
    if (options.packageJson) {
      try {
        const pkg = typeof options.packageJson === 'string' ? JSON.parse(options.packageJson) : options.packageJson;
        const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        const importRegex = /(?:import\s+.*?\s+from\s+['"]|require\(['"])([@a-zA-Z0-9_\-\.\/]+)['"]/g;
        let match;
        const missingDeps = new Set();
        while ((match = importRegex.exec(content)) !== null) {
          const modName = match[1];
          // Ignore relative imports and node core modules
          if (!modName.startsWith('.') && !modName.startsWith('/') && !['fs', 'path', 'http', 'https', 'crypto', 'os', 'util', 'events', 'stream', 'child_process', 'url'].includes(modName)) {
            const rootPkg = modName.startsWith('@') ? modName.split('/').slice(0, 2).join('/') : modName.split('/')[0];
            if (!allDeps[rootPkg]) {
              missingDeps.add(rootPkg);
            }
          }
        }
        if (missingDeps.size === 0) {
          checks.push({ name: 'Dependency Consistency', passed: true });
        } else {
          checks.push({ name: 'Dependency Consistency', passed: false, missing: Array.from(missingDeps) });
          missingDeps.forEach(dep => {
            diagnostics.push({
              type: 'dependency',
              severity: 'warning',
              message: `Package "${dep}" is imported but not listed in dependencies`,
              line: 1
            });
          });
        }
      } catch (_) {
        // Ignore package.json parsing error
      }
    } else {
      checks.push({ name: 'Dependency Consistency', passed: true, note: 'Stand-alone mode' });
    }

    // 4. Compute Health Score
    let score = 100;
    if (!syntaxValid) score -= 50;
    if (secrets.length > 0) score -= Math.min(30, secrets.length * 15);
    const depFailures = checks.find(c => c.name === 'Dependency Consistency' && !c.passed);
    if (depFailures) score -= 20;
    score = Math.max(0, score);

    let repairSuggestion = null;
    if (!syntaxValid) {
      repairSuggestion = `Fix syntax issue: ${syntaxError}`;
    } else if (secrets.length > 0) {
      repairSuggestion = `Move hardcoded credentials to environment variables or .env file.`;
    }

    const verified = syntaxValid && secrets.length === 0;
    return {
      verified,
      valid: verified,
      score,
      filePath: filePath || 'untitled',
      checks,
      diagnostics,
      secretLeaks: secrets,
      repairSuggestion
    };
  }

  /**
   * Verifies generated document deliverables (PDF, DOCX, PPTX, XLSX, CSV).
   */
  verifyDocument(filePathOrName, bufferOrPath, type) {
    const checks = [];
    const diagnostics = [];
    let fileBuffer = null;

    if (Buffer.isBuffer(bufferOrPath)) {
      fileBuffer = bufferOrPath;
    } else if (typeof bufferOrPath === 'string' && fs.existsSync(bufferOrPath)) {
      try {
        fileBuffer = fs.readFileSync(bufferOrPath);
      } catch (err) {
        return {
          verified: false,
          valid: false,
          score: 0,
          format: type,
          error: `Could not read document: ${err.message}`,
          checks: [{ name: 'File Read', passed: false, error: err.message }]
        };
      }
    }

    const docType = (type || path.extname(filePathOrName || '').replace('.', '')).toLowerCase();
    const sizeBytes = fileBuffer ? fileBuffer.length : (typeof bufferOrPath === 'string' ? Buffer.byteLength(bufferOrPath) : 0);

    // 1. Non-empty check
    if (sizeBytes < 5) {
      return {
        verified: false,
        valid: false,
        score: 0,
        format: docType,
        sizeBytes,
        checks: [{ name: 'File Content Presence', passed: false, error: 'Document file is empty' }],
        diagnostics: [{ type: 'integrity', severity: 'error', message: 'Document size is zero or trivial' }]
      };
    }
    checks.push({ name: 'File Content Presence', passed: true, sizeBytes });

    // 2. Format-specific magic bytes & structure
    let magicPassed = true;
    let rowCount = 0;
    if (docType === 'pdf') {
      const header = fileBuffer ? fileBuffer.subarray(0, 5).toString('ascii') : (typeof bufferOrPath === 'string' ? bufferOrPath.slice(0, 5) : '');
      if (header.startsWith('%PDF-')) {
        checks.push({ name: 'PDF Header Magic Bytes (%PDF-)', passed: true });
      } else {
        magicPassed = false;
        checks.push({ name: 'PDF Header Magic Bytes (%PDF-)', passed: false });
        diagnostics.push({ type: 'format', severity: 'error', message: 'Missing valid %PDF- header magic bytes' });
      }
    } else if (['docx', 'pptx', 'xlsx'].includes(docType)) {
      // Office Open XML zip container: starts with 'PK\x03\x04'
      const isZip = fileBuffer && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b && fileBuffer[2] === 0x03 && fileBuffer[3] === 0x04;
      if (isZip) {
        checks.push({ name: 'Office XML Zip Container (PK..)', passed: true });
      } else {
        magicPassed = false;
        checks.push({ name: 'Office XML Zip Container (PK..)', passed: false });
        diagnostics.push({ type: 'format', severity: 'error', message: `Invalid Office container for ${docType.toUpperCase()}` });
      }
    } else if (docType === 'csv') {
      const content = fileBuffer ? fileBuffer.toString('utf-8') : (typeof bufferOrPath === 'string' ? bufferOrPath : '');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length >= 1) {
        rowCount = Math.max(0, lines.length - 1);
        checks.push({ name: 'CSV Row Structure', passed: true, rowCount });
      } else {
        magicPassed = false;
        checks.push({ name: 'CSV Row Structure', passed: false, error: 'No data rows found' });
      }
    }

    const verified = magicPassed && sizeBytes >= 5;
    const score = verified ? 100 : 20;

    return {
      verified,
      valid: verified,
      score,
      format: docType,
      sizeBytes,
      checks,
      diagnostics,
      metadata: { rowCount }
    };
  }

  /**
   * Unified dispatcher for any action.
   */
  verifyAction(actionType, payload = {}) {
    const actionName = (typeof actionType === 'object' ? (actionType.action || actionType.actionType) : actionType) || '';
    const p = (typeof actionType === 'object' ? (actionType.parameters || actionType.payload || actionType) : payload) || {};

    let report;
    if (['write_file', 'apply_diff', 'code'].includes(actionName)) {
      report = this.verifyCode(p.path || p.filePath, p.content || '', p.options);
    } else if (['generate_document', 'document', 'pdf', 'docx', 'xlsx', 'pptx', 'csv'].includes(actionName)) {
      report = this.verifyDocument(p.filePath || p.name, p.buffer || p.path || p.content, p.type);
    } else {
      report = {
        verified: true,
        valid: true,
        score: 100,
        actionType: actionName,
        checks: [{ name: 'Default Action Pass-through', passed: true }]
      };
    }

    if (report && report.valid === undefined) {
      report.valid = report.verified !== false;
    }
    return report;
  }
}

module.exports = new VerifierService();

