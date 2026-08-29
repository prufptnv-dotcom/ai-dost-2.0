/**
 * AI-Dost Codebase Intelligence & Repository Indexer
 * 
 * Provides deterministic codebase indexing, symbol extraction, import resolution,
 * dependency graph analysis, and incremental scanning.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Supported File Extensions & Language Map ────────────────────────────────
const EXTENSION_LANGUAGE_MAP = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
  '.go': 'go',
  '.rs': 'rust',
  '.json': 'json',
  '.css': 'css',
  '.scss': 'css',
  '.html': 'html',
  '.htm': 'html',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml'
};

// ── Blacklisted Directories & Files (Security & Performance) ────────────────
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.vite',
  'venv',
  '.venv',
  '__pycache__',
  'target',
  '.turbo',
  '.output'
]);

const IGNORED_SECRET_PATTERNS = [
  /^\.env(\..+)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /^id_rsa$/i,
  /^id_ed25519$/i,
  /^id_ecdsa$/i,
  /^id_dsa$/i
];

class CodebaseIndexer {
  constructor(options = {}) {
    this.maxFileSizeBytes = options.maxFileSizeBytes || (1024 * 1024); // 1 MB default
    // In-memory workspace index storage: workspacePath -> { files: Map<relativePath, FileMetadata>, stats: {} }
    this.workspaceIndices = new Map();
  }

  // ── Path Sanitization & Traversal Guard ───────────────────────────────────
  sanitizeWorkspacePath(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      throw new Error('Workspace path must be a non-empty string.');
    }
    return path.resolve(workspacePath);
  }

  isPathSafe(workspacePath, targetPath) {
    const resolvedWorkspace = path.resolve(workspacePath);
    const resolvedTarget = path.resolve(resolvedWorkspace, targetPath);
    const rel = path.relative(resolvedWorkspace, resolvedTarget);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  }

  isSecretOrIgnoredFile(filename) {
    const base = path.basename(filename);
    return IGNORED_SECRET_PATTERNS.some(pat => pat.test(base));
  }

  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_LANGUAGE_MAP[ext] || 'plaintext';
  }

  calculateHash(bufferOrString) {
    return crypto.createHash('sha256').update(bufferOrString).digest('hex');
  }

  // ── Language-Specific Symbol & Import Extractors ───────────────────────────

  extractJavaScriptSymbolsAndImports(content) {
    const imports = [];
    const exports = [];
    const symbols = [];
    const lines = content.split('\n');

    // 1. ES6 Imports: import { X, Y } from './foo'; import Default from 'pkg';
    const esImportRegex = /import\s+(?:([\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let m;
    while ((m = esImportRegex.exec(content)) !== null) {
      imports.push({
        source: m[2],
        symbols: (m[1] || '').trim(),
        resolvedPath: null,
        type: 'import'
      });
    }

    // 2. CommonJS require: const X = require('./foo');
    const cjsRequireRegex = /(?:const|let|var)\s+([\w\s{},]+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((m = cjsRequireRegex.exec(content)) !== null) {
      imports.push({
        source: m[2],
        symbols: m[1].trim(),
        resolvedPath: null,
        type: 'require'
      });
    }

    // 3. Line-by-line Symbol & Function/Class extraction
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Functions: function foo(...) or async function foo(...)
      const fnMatch = line.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/);
      if (fnMatch) {
        const isExported = /export\b/.test(line);
        symbols.push({
          name: fnMatch[1],
          type: 'function',
          startLine: lineNum,
          endLine: lineNum,
          exported: isExported
        });
        if (isExported && !exports.includes(fnMatch[1])) exports.push(fnMatch[1]);
      }

      // Classes: class Bar ...
      const classMatch = line.match(/(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        const isExported = /export\b/.test(line);
        symbols.push({
          name: classMatch[1],
          type: 'class',
          startLine: lineNum,
          endLine: lineNum,
          exported: isExported
        });
        if (isExported && !exports.includes(classMatch[1])) exports.push(classMatch[1]);
      }

      // Arrow functions / constants: const MyComp = () => ... or const doWork = function()
      const constMatch = line.match(/(?:export\s+)?const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)?\s*=>/);
      if (constMatch) {
        const isExported = /export\b/.test(line);
        symbols.push({
          name: constMatch[1],
          type: 'function',
          startLine: lineNum,
          endLine: lineNum,
          exported: isExported
        });
        if (isExported && !exports.includes(constMatch[1])) exports.push(constMatch[1]);
      }

      // TS Interfaces / Types / Enums
      const typeMatch = line.match(/(?:export\s+)?(?:interface|type|enum)\s+([a-zA-Z0-9_$]+)/);
      if (typeMatch) {
        const isExported = /export\b/.test(line);
        const typeKind = line.includes('interface') ? 'interface' : (line.includes('enum') ? 'enum' : 'type');
        symbols.push({
          name: typeMatch[1],
          type: typeKind,
          startLine: lineNum,
          endLine: lineNum,
          exported: isExported
        });
        if (isExported && !exports.includes(typeMatch[1])) exports.push(typeMatch[1]);
      }

      // Named exports: export { a, b }
      const namedExp = line.match(/export\s*\{\s*([^}]+)\s*\}/);
      if (namedExp) {
        namedExp[1].split(',').forEach(s => {
          const clean = s.trim().split(/\s+as\s+/)[0].trim();
          if (clean && !exports.includes(clean)) exports.push(clean);
        });
      }

      // Default export: export default Identifier
      const defExp = line.match(/export\s+default\s+([a-zA-Z0-9_$]+);?/);
      if (defExp && defExp[1] !== 'function' && defExp[1] !== 'class') {
        if (!exports.includes(defExp[1])) exports.push(defExp[1]);
        if (!exports.includes('default')) exports.push('default');
      }
    }

    return { imports, exports, symbols };
  }

  extractPythonSymbolsAndImports(content) {
    const imports = [];
    const exports = [];
    const symbols = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Imports: import foo or from foo import bar
      const impMatch1 = line.match(/^import\s+([a-zA-Z0-9_.,\s]+)/);
      if (impMatch1) {
        impMatch1[1].split(',').forEach(pkg => {
          const clean = pkg.trim().split(/\s+as\s+/)[0].trim();
          if (clean) {
            imports.push({ source: clean, symbols: clean, resolvedPath: null, type: 'import' });
          }
        });
      }

      const impMatch2 = line.match(/^from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_.,\s*]+)/);
      if (impMatch2) {
        imports.push({
          source: impMatch2[1].trim(),
          symbols: impMatch2[2].trim(),
          resolvedPath: null,
          type: 'import_from'
        });
      }

      // Functions: def my_func(...)
      const fnMatch = line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (fnMatch) {
        symbols.push({
          name: fnMatch[1],
          type: 'function',
          startLine: lineNum,
          endLine: lineNum,
          exported: !fnMatch[1].startsWith('_')
        });
        if (!fnMatch[1].startsWith('_')) exports.push(fnMatch[1]);
      }

      // Classes: class MyClass(...)
      const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          startLine: lineNum,
          endLine: lineNum,
          exported: !classMatch[1].startsWith('_')
        });
        if (!classMatch[1].startsWith('_')) exports.push(classMatch[1]);
      }
    }

    return { imports, exports, symbols };
  }

  extractGenericSymbolsAndImports(content, language) {
    const imports = [];
    const exports = [];
    const symbols = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      if (language === 'go') {
        const fn = line.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/);
        if (fn) {
          const isExp = /^[A-Z]/.test(fn[1]);
          symbols.push({ name: fn[1], type: 'function', startLine: lineNum, endLine: lineNum, exported: isExp });
          if (isExp) exports.push(fn[1]);
        }
        const typ = line.match(/^type\s+([a-zA-Z0-9_]+)\s+(?:struct|interface)/);
        if (typ) {
          const isExp = /^[A-Z]/.test(typ[1]);
          symbols.push({ name: typ[1], type: 'type', startLine: lineNum, endLine: lineNum, exported: isExp });
          if (isExp) exports.push(typ[1]);
        }
      } else if (language === 'rust') {
        const fn = line.match(/(?:pub\s+)?fn\s+([a-zA-Z0-9_]+)/);
        if (fn) {
          const isExp = line.includes('pub fn');
          symbols.push({ name: fn[1], type: 'function', startLine: lineNum, endLine: lineNum, exported: isExp });
          if (isExp) exports.push(fn[1]);
        }
        const st = line.match(/(?:pub\s+)?(?:struct|enum|trait)\s+([a-zA-Z0-9_]+)/);
        if (st) {
          const isExp = line.startsWith('pub');
          symbols.push({ name: st[1], type: 'type', startLine: lineNum, endLine: lineNum, exported: isExp });
          if (isExp) exports.push(st[1]);
        }
      } else if (language === 'java') {
        const cls = line.match(/(?:public|protected|private)?\s*(?:static\s+)?(?:class|interface|enum)\s+([a-zA-Z0-9_]+)/);
        if (cls) {
          const isExp = line.includes('public');
          symbols.push({ name: cls[1], type: 'class', startLine: lineNum, endLine: lineNum, exported: isExp });
          if (isExp) exports.push(cls[1]);
        }
      }
    }

    return { imports, exports, symbols };
  }

  // ── Import Path Resolution ────────────────────────────────────────────────
  resolveImport(importSource, currentFileRelative, allRelativePaths) {
    if (!importSource || typeof importSource !== 'string') return null;

    // Local relative imports (./foo, ../foo)
    if (importSource.startsWith('.')) {
      const currentDir = path.dirname(currentFileRelative);
      const rawTarget = path.posix.normalize(path.posix.join(currentDir === '.' ? '' : currentDir, importSource));
      
      const candidates = [
        rawTarget,
        `${rawTarget}.js`,
        `${rawTarget}.jsx`,
        `${rawTarget}.ts`,
        `${rawTarget}.tsx`,
        `${rawTarget}.py`,
        `${rawTarget}/index.js`,
        `${rawTarget}/index.jsx`,
        `${rawTarget}/index.ts`,
        `${rawTarget}/index.tsx`,
        `${rawTarget}/__init__.py`
      ];

      const match = allRelativePaths.find(p => candidates.includes(p.replace(/\\/g, '/')));
      return match || null;
    }

    return null; // External package
  }

  // ── Workspace Scanner & Incremental Indexer ───────────────────────────────
  async indexWorkspace(workspacePath, options = {}) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Workspace directory does not exist: ${targetDir}`);
    }

    const existingIndex = this.workspaceIndices.get(targetDir) || { files: new Map() };
    const oldFilesMap = existingIndex.files;
    const newFilesMap = new Map();

    const progress = {
      scanned: 0,
      indexed: 0,
      skipped: 0,
      changed: 0,
      deleted: 0
    };

    // 1. Recursive file discovery
    const diskFiles = [];
    const scanDir = (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.relative(targetDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name)) {
            scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          if (!this.isSecretOrIgnoredFile(entry.name)) {
            diskFiles.push({ fullPath, relPath });
          }
        }
      }
    };

    scanDir(targetDir);
    progress.scanned = diskFiles.length;

    const allRelativePaths = diskFiles.map(d => d.relPath);

    // 2. Parse / Incremental Hash Check
    for (const { fullPath, relPath } of diskFiles) {
      try {
        const stats = fs.statSync(fullPath);
        if (stats.size > this.maxFileSizeBytes) {
          progress.skipped++;
          continue;
        }

        const rawContent = fs.readFileSync(fullPath, 'utf-8');
        const hash = this.calculateHash(rawContent);
        const existingMeta = oldFilesMap.get(relPath);

        // Incremental check: if hash matches, reuse parsed AST symbols
        if (existingMeta && existingMeta.hash === hash) {
          newFilesMap.set(relPath, existingMeta);
          progress.indexed++;
          continue;
        }

        const language = this.detectLanguage(relPath);
        let extracted = { imports: [], exports: [], symbols: [] };

        if (['javascript', 'typescript'].includes(language)) {
          extracted = this.extractJavaScriptSymbolsAndImports(rawContent);
        } else if (language === 'python') {
          extracted = this.extractPythonSymbolsAndImports(rawContent);
        } else {
          extracted = this.extractGenericSymbolsAndImports(rawContent, language);
        }

        const fileMeta = {
          path: relPath,
          language,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          hash,
          lineCount: rawContent.split('\n').length,
          imports: extracted.imports,
          exports: extracted.exports,
          symbols: extracted.symbols
        };

        newFilesMap.set(relPath, fileMeta);
        progress.indexed++;
        progress.changed++;
      } catch (err) {
        progress.skipped++;
      }
    }

    // 3. Resolve import paths across all indexed files
    for (const [_, fileMeta] of newFilesMap.entries()) {
      for (const imp of fileMeta.imports) {
        imp.resolvedPath = this.resolveImport(imp.source, fileMeta.path, allRelativePaths);
      }
    }

    // 4. Calculate deleted files
    for (const oldPath of oldFilesMap.keys()) {
      if (!newFilesMap.has(oldPath)) {
        progress.deleted++;
      }
    }

    // 5. Store index
    const indexData = {
      workspacePath: targetDir,
      files: newFilesMap,
      lastIndexedAt: new Date().toISOString(),
      stats: progress
    };

    this.workspaceIndices.set(targetDir, indexData);
    return progress;
  }

  // ── Query APIs ────────────────────────────────────────────────────────────

  getIndex(workspacePath) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    const idx = this.workspaceIndices.get(targetDir);
    if (!idx) return null;

    const filesObj = {};
    for (const [relPath, meta] of idx.files.entries()) {
      filesObj[relPath] = meta;
    }

    return {
      workspacePath: idx.workspacePath,
      lastIndexedAt: idx.lastIndexedAt,
      filesCount: idx.files.size,
      files: filesObj,
      stats: idx.stats
    };
  }

  clearIndex(workspacePath) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    return this.workspaceIndices.delete(targetDir);
  }

  getFileMetadata(workspacePath, relativePath) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    if (!this.isPathSafe(targetDir, relativePath)) {
      throw new Error('Path traversal attempt blocked.');
    }
    const idx = this.workspaceIndices.get(targetDir);
    if (!idx) return null;
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return idx.files.get(cleanRel) || null;
  }

  searchFiles(workspacePath, query) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    const idx = this.workspaceIndices.get(targetDir);
    if (!idx || !query) return [];

    const q = String(query).toLowerCase().trim();
    const matches = [];

    for (const [relPath, meta] of idx.files.entries()) {
      let matchScore = 0;
      const pathLower = relPath.toLowerCase();

      if (pathLower === q) matchScore += 100;
      else if (pathLower.includes(q)) matchScore += 50;

      const symbolMatch = meta.symbols.some(s => s.name.toLowerCase().includes(q));
      if (symbolMatch) matchScore += 30;

      const importMatch = meta.imports.some(imp => imp.source.toLowerCase().includes(q) || (imp.symbols && imp.symbols.toLowerCase().includes(q)));
      if (importMatch) matchScore += 20;

      if (matchScore > 0) {
        matches.push({
          path: relPath,
          language: meta.language,
          score: matchScore,
          symbols: meta.symbols.map(s => s.name),
          imports: meta.imports.map(i => i.source)
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  findSymbol(workspacePath, symbolName) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    const idx = this.workspaceIndices.get(targetDir);
    if (!idx || !symbolName) return [];

    const targetName = String(symbolName).trim().toLowerCase();
    const results = [];

    for (const [relPath, meta] of idx.files.entries()) {
      for (const sym of meta.symbols) {
        if (sym.name.toLowerCase() === targetName) {
          results.push({
            file: relPath,
            symbol: sym
          });
        }
      }
    }

    return results;
  }

  findReferences(workspacePath, symbolName) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    const idx = this.workspaceIndices.get(targetDir);
    if (!idx || !symbolName) return [];

    const targetName = String(symbolName).trim();
    const targetLower = targetName.toLowerCase();
    const references = [];

    for (const [relPath, meta] of idx.files.entries()) {
      const defs = meta.symbols.filter(s => s.name.toLowerCase() === targetLower);
      const imps = meta.imports.filter(i => (i.symbols && i.symbols.toLowerCase().includes(targetLower)) || i.source.toLowerCase().includes(targetLower));

      if (defs.length > 0 || imps.length > 0) {
        references.push({
          file: relPath,
          definitions: defs,
          imports: imps
        });
      }
    }

    return references;
  }

  getDependencies(workspacePath, filePath) {
    const meta = this.getFileMetadata(workspacePath, filePath);
    if (!meta) return [];
    return meta.imports.map(imp => ({
      source: imp.source,
      resolvedPath: imp.resolvedPath,
      type: imp.type
    }));
  }

  getDependents(workspacePath, filePath) {
    const targetDir = this.sanitizeWorkspacePath(workspacePath);
    const idx = this.workspaceIndices.get(targetDir);
    if (!idx) return [];

    const cleanTarget = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const dependents = [];

    for (const [relPath, meta] of idx.files.entries()) {
      if (relPath === cleanTarget) continue;
      const isDep = meta.imports.some(imp => imp.resolvedPath === cleanTarget);
      if (isDep) {
        dependents.push(relPath);
      }
    }

    return dependents;
  }
}

module.exports = CodebaseIndexer;
module.exports.CodebaseIndexer = CodebaseIndexer;
