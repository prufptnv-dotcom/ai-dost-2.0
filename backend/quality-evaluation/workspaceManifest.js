'use strict';

/**
 * AI-Dost Authoritative Workspace Manifest & Snapshot Service
 * Enforces unified snapshot collection, deterministic hashing, safety limits,
 * staging into isolated runtimes, and post-execution mutation detection.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.html', '.css', '.svg', '.vue', '.svelte',
  '.yaml', '.yml'
]);

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.turbo', '.cache'
]);

const DEFAULT_LIMITS = {
  maxSingleFileBytes: 512 * 1024,      // 512 KB
  maxTotalFiles: 150,                  // 150 files
  maxTotalBytes: 5 * 1024 * 1024       // 5 MB
};

/**
 * Normalizes a relative file path using POSIX forward slashes.
 */
function normalizeRelativePath(relPath) {
  return String(relPath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

/**
 * Computes deterministic SHA-256 hash over a canonical file map.
 */
function computeSnapshotHash(fileMap = {}) {
  if (!fileMap || typeof fileMap !== 'object') return '';
  const sortedKeys = Object.keys(fileMap).sort((a, b) => a.localeCompare(b));
  const hash = crypto.createHash('sha256');
  for (const key of sortedKeys) {
    const content = typeof fileMap[key] === 'string' ? fileMap[key] : '';
    const fileHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    hash.update(`${key}:${fileHash}\n`);
  }
  return hash.digest('hex');
}

/**
 * Recursively scans directory or processes an in-memory file map into an authoritative snapshot.
 * Enforces file size limits and manifest limits. Fails closed if limits are exceeded.
 */
function createWorkspaceSnapshot(source, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options.limits };
  const fileMap = {};
  let totalBytes = 0;
  let fileCount = 0;

  function addFile(normalizedPath, content) {
    if (typeof content !== 'string') {
      content = String(content || '');
    }
    const byteLength = Buffer.byteLength(content, 'utf8');

    if (byteLength > limits.maxSingleFileBytes) {
      throw new Error(
        `MANIFEST_LIMIT_EXCEEDED: File "${normalizedPath}" (${byteLength} bytes) exceeds maximum allowed size of ${limits.maxSingleFileBytes} bytes.`
      );
    }

    fileCount += 1;
    if (fileCount > limits.maxTotalFiles) {
      throw new Error(
        `MANIFEST_LIMIT_EXCEEDED: Workspace exceeds maximum allowed file count of ${limits.maxTotalFiles} files.`
      );
    }

    totalBytes += byteLength;
    if (totalBytes > limits.maxTotalBytes) {
      throw new Error(
        `MANIFEST_LIMIT_EXCEEDED: Workspace total size (${totalBytes} bytes) exceeds maximum allowed limit of ${limits.maxTotalBytes} bytes.`
      );
    }

    fileMap[normalizedPath] = content;
  }

  if (typeof source === 'string') {
    // Directory path
    if (fs.existsSync(source)) {
      function scanDir(currentDir, rootDir) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const ent of entries) {
          if (EXCLUDED_DIRS.has(ent.name)) continue;
          const full = path.join(currentDir, ent.name);
          if (ent.isDirectory()) {
            scanDir(full, rootDir);
          } else if (ent.isFile()) {
            const ext = path.extname(ent.name).toLowerCase();
            if (SUPPORTED_EXTENSIONS.has(ext)) {
              const rel = normalizeRelativePath(path.relative(rootDir, full));
              try {
                const content = fs.readFileSync(full, 'utf8');
                addFile(rel, content);
              } catch (err) {
                throw new Error(`FILE_READ_ERROR: Could not read "${rel}": ${err.message}`);
              }
            }
          }
        }
      }
      scanDir(source, source);
    }
  } else if (source && typeof source === 'object') {
    // In-memory file map
    const sortedPaths = Object.keys(source).sort();
    for (const rawPath of sortedPaths) {
      const rel = normalizeRelativePath(rawPath);
      const ext = path.extname(rel).toLowerCase();
      if (!ext || SUPPORTED_EXTENSIONS.has(ext)) {
        addFile(rel, source[rawPath]);
      }
    }
  }

  const hash = computeSnapshotHash(fileMap);
  return {
    files: fileMap,
    fileCount,
    totalBytes,
    hash
  };
}

/**
 * Stages an exact snapshot into a destination directory.
 */
function stageWorkspaceSnapshot(snapshot, destinationDir) {
  if (!snapshot || !snapshot.files || typeof snapshot.files !== 'object') {
    throw new Error('INVALID_SNAPSHOT: Snapshot object with files map is required.');
  }
  if (!destinationDir || typeof destinationDir !== 'string') {
    throw new Error('INVALID_DESTINATION: Destination directory string is required.');
  }

  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  for (const [relPath, content] of Object.entries(snapshot.files)) {
    const full = path.join(destinationDir, relPath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(full, content, 'utf8');
  }

  return destinationDir;
}

/**
 * Compares an initial snapshot with the current state of a staged workspace.
 * Detects modified, added, deleted, or renamed files.
 */
function verifyWorkspaceImmutability(initialSnapshot, stagedDir) {
  if (!initialSnapshot || !initialSnapshot.hash) {
    throw new Error('INVALID_INITIAL_SNAPSHOT: Initial snapshot with valid hash is required.');
  }

  const postSnapshot = createWorkspaceSnapshot(stagedDir);

  if (postSnapshot.hash !== initialSnapshot.hash) {
    const initialKeys = new Set(Object.keys(initialSnapshot.files));
    const postKeys = new Set(Object.keys(postSnapshot.files));

    const added = [];
    const deleted = [];
    const modified = [];

    for (const key of postKeys) {
      if (!initialKeys.has(key)) {
        added.push(key);
      } else if (initialSnapshot.files[key] !== postSnapshot.files[key]) {
        modified.push(key);
      }
    }

    for (const key of initialKeys) {
      if (!postKeys.has(key)) {
        deleted.push(key);
      }
    }

    const mutations = [];
    if (modified.length > 0) mutations.push(`modified: [${modified.join(', ')}]`);
    if (added.length > 0) mutations.push(`added: [${added.join(', ')}]`);
    if (deleted.length > 0) mutations.push(`deleted: [${deleted.join(', ')}]`);

    throw new Error(
      `ARTIFACT_MUTATION_DETECTED: Staged workspace mutated during execution (${mutations.join('; ')}). Pre-hash: ${initialSnapshot.hash}, Post-hash: ${postSnapshot.hash}`
    );
  }

  return true;
}

module.exports = {
  createWorkspaceSnapshot,
  computeSnapshotHash,
  stageWorkspaceSnapshot,
  verifyWorkspaceImmutability,
  SUPPORTED_EXTENSIONS,
  EXCLUDED_DIRS,
  DEFAULT_LIMITS
};
