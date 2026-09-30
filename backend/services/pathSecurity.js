const path = require('path');

/**
 * AI-Dost 2.0 Unified Workspace Path Security Policy
 *
 * Canonical security boundary for file access, diffing, and creation.
 * Guarantees 100% parity across AgentOrchestrator and Routes/Agent.
 */
const BLOCKED_SECRET_PATTERNS = [
  /^\.env(?:\..+)?$/i,         // .env, .env.local, .env.production, etc.
  /\.pem$/i,                   // certificates / keys
  /\.key$/i,                   // private keys
  /^id_rsa(?:\..+)?$/i,        // ssh private keys
  /^id_ed25519(?:\..+)?$/i,    // ssh private keys
  /secrets?\.json$/i,          // secret configuration dumps
  /credentials(?:\.json)?$/i,  // cloud credentials
];

function isProtectedSecretFile(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') return true;
  const basename = path.basename(targetPath).toLowerCase();
  return BLOCKED_SECRET_PATTERNS.some(regex => regex.test(basename));
}

function resolveSafePath(workspacePath, targetPath) {
  if (!workspacePath || !targetPath || typeof targetPath !== 'string') return null;
  if (targetPath.includes('\0')) return null; // null-byte truncation bypass
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  if (normalizedTarget.includes('../') || normalizedTarget.includes('..\\')) return null;
  // Also catch bare '..' segments
  if (normalizedTarget.split('/').some(seg => seg === '..')) return null;

  const ws = path.resolve(workspacePath);
  let target;

  // Case-insensitive containment on Windows (paths are case-insensitive there)
  const isWin = process.platform === 'win32';
  const norm = (p) => (isWin ? p.toLowerCase() : p);

  if (path.isAbsolute(targetPath)) {
    const absResolved = path.resolve(targetPath);
    if (norm(absResolved) === norm(ws) || norm(absResolved).startsWith(norm(ws) + path.sep)) {
      target = absResolved;
    } else {
      return null;
    }
  } else {
    const cleaned = targetPath.replace(/^[\\\/]+/, '');
    target = path.resolve(ws, cleaned);
  }

  if (norm(target) !== norm(ws) && !norm(target).startsWith(norm(ws) + path.sep)) return null;
  if (isProtectedSecretFile(target)) return null;

  return target;
}

function safeJoin(base, rel) {
  if (!base) throw new Error('Invalid base workspace path');
  if (!rel || typeof rel !== 'string') throw new Error('Invalid path parameter');
  
  const resolved = resolveSafePath(base, rel);
  if (!resolved) {
    if (isProtectedSecretFile(rel)) {
      throw new Error(`Access denied: Protected security file "${path.basename(rel)}" cannot be accessed or modified.`);
    }
    throw new Error(`Path traversal blocked: "${rel}" is outside workspace.`);
  }
  return resolved;
}

module.exports = {
  BLOCKED_SECRET_PATTERNS,
  isProtectedSecretFile,
  resolveSafePath,
  safeJoin
};
