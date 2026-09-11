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
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  if (normalizedTarget.includes('../') || normalizedTarget.includes('..\\')) return null;

  const ws = path.resolve(workspacePath);
  let target;

  if (path.isAbsolute(targetPath)) {
    const absResolved = path.resolve(targetPath);
    if (absResolved === ws || absResolved.startsWith(ws + path.sep)) {
      target = absResolved;
    } else {
      return null;
    }
  } else {
    const cleaned = targetPath.replace(/^[\\\/]+/, '');
    target = path.resolve(ws, cleaned);
  }

  if (target !== ws && !target.startsWith(ws + path.sep)) return null;
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
