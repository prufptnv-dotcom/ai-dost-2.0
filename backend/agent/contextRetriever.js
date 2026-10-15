const fs = require('fs');
const path = require('path');

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'please', 'fix', 'make', 'create', 'update', 'change', 
  'add', 'remove', 'implement', 'build', 'issue', 'bug', 'problem', 'file', 
  'code', 'function', 'component', 'for', 'of', 'in', 'and', 'or', 'to', 'is', 'it'
]);

class ContextRetriever {
  constructor({ codebaseIndexer, legacySearch }) {
    this.indexer = codebaseIndexer;
    this.legacySearch = legacySearch;
    this.cache = new Map();
    this.MAX_CACHE_ENTRIES = 100;
  }

  isSecretOrIgnored(filename) {
    const lower = filename.toLowerCase();
    if (lower === '.env' || lower.startsWith('.env.')) return true;
    if (lower.endsWith('.pem') || lower.endsWith('.key') || lower.endsWith('.pfx') || lower.endsWith('.p12')) return true;
    if (lower === 'id_rsa' || lower === 'id_ed25519') return true;
    return false;
  }

  isPathSafe(workspacePath, relativePath) {
    const ws = path.resolve(workspacePath);
    const target = path.resolve(ws, relativePath);
    
    // Secret blocking
    const blockedSecrets = ['.env', '.pem', '.key', 'id_rsa', 'secrets.json', 'credentials'];
    const basename = path.basename(target).toLowerCase();
    if (blockedSecrets.some(sec => basename.includes(sec))) return false;
    
    return target === ws || target.startsWith(ws + path.sep);
  }

  tokenize(text) {
    if (!text) return [];
    
    // Replace non-alphanumeric with space
    let normalized = String(text).replace(/[^a-zA-Z0-9]/g, ' ');
    
    // Split camelCase
    normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    const tokens = normalized.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    
    // Filter stop words
    return [...new Set(tokens.filter(t => !STOP_WORDS.has(t)))];
  }

  async retrieve(workspacePath, task, options = {}) {
    if (!this.indexer) {
      throw new Error('Valid codebaseIndexer required');
    }

    const topK = Math.min(options.topK || 12, 50);
    const maxPreviewLength = options.maxPreviewLength || 12288;
    const totalBudget = options.totalBudget || 81920;
    const rangeWindow = options.rangeWindow || 20;

    let progress;
    if (typeof this.indexer.indexWorkspace === 'function') {
       try {
          progress = await this.indexer.indexWorkspace(workspacePath);
       } catch (_) {}
    }
    
    if (!this.workspaceVersions) this.workspaceVersions = new Map();
    let wsVersion = this.workspaceVersions.get(workspacePath) || 0;
    if (progress && (progress.changed > 0 || progress.deleted > 0)) {
       wsVersion++;
       this.workspaceVersions.set(workspacePath, wsVersion);
    }

    const idx = this.indexer.getIndex(workspacePath);
    const indexHash = wsVersion + (idx ? '_' + idx.filesCount : '');
    
    const normalizedTask = this.tokenize(task).join('_');
    const cacheKey = `${workspacePath}:${indexHash}:${normalizedTask}:${topK}:${totalBudget}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const candidatesMap = new Map();
    const addScore = (filePath, score, reason, symbol = null) => {
      const p = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
      if (this.isSecretOrIgnored(path.basename(p))) return;
      if (!candidatesMap.has(p)) {
        candidatesMap.set(p, { path: p, score: 0, reasons: new Set(), matchedSymbols: [] });
      }
      const c = candidatesMap.get(p);
      c.score += score;
      c.reasons.add(reason);
      if (symbol) c.matchedSymbols.push(symbol);
    };

    const tokens = this.tokenize(task);
    const taskLower = String(task).toLowerCase();

    if (idx) {
      for (const [relPath, meta] of Object.entries(idx.files)) {
        const basename = relPath.split('/').pop().toLowerCase();
        const noExt = basename.split('.')[0];

        // 1. Exact path match
        if (taskLower.includes(relPath.toLowerCase())) {
          addScore(relPath, 100, 'exact_path_match');
        } 
        // 2. Exact filename match
        else if (taskLower.includes(basename)) {
          addScore(relPath, 60, 'exact_filename_match');
        } 
        else if (taskLower.includes(noExt) && noExt.length > 2) {
           addScore(relPath, 50, 'exact_basename_match');
        }

        // Token match for filename
        const pathTokens = this.tokenize(basename);
        for (const pt of pathTokens) {
          if (tokens.includes(pt)) {
            addScore(relPath, 30, 'filename_token_match');
          }
        }

        // 3. Symbol matches
        for (const sym of meta.symbols) {
          const symLower = sym.name.toLowerCase();
          if (taskLower.includes(symLower) && symLower.length > 2) {
            addScore(relPath, 80, 'symbol_exact_match', sym);
          } else {
            const symTokens = this.tokenize(sym.name);
            for (const st of symTokens) {
              if (tokens.includes(st)) {
                addScore(relPath, 40, 'symbol_token_match', sym);
              }
            }
          }
        }
      }
    }

    // 6. Legacy Search (search_codebase)
    if (this.legacySearch && typeof this.legacySearch === 'function') {
      try {
        const legacyResults = await this.legacySearch(task);
        if (legacyResults && Array.isArray(legacyResults.results)) {
          for (const res of legacyResults.results) {
            if (res.file) {
              addScore(res.file, 15, 'legacy_search_match');
            }
          }
        }
      } catch (err) {}
    }

    let candidates = Array.from(candidatesMap.values()).map(c => ({
      path: c.path,
      score: c.score,
      reasons: Array.from(c.reasons),
      matchedSymbols: c.matchedSymbols
    }));

    candidates = this.rankCandidates(candidates, task);

    // Dependency Expansion (depth = 1)
    if (candidates.length > 0) {
      const topCandidates = candidates.slice(0, 3);
      for (const tc of topCandidates) {
        const deps = this.indexer.getDependencies(workspacePath, tc.path);
        for (const dep of deps) {
          if (dep.resolvedPath) {
            addScore(dep.resolvedPath, 20, 'import_dependency');
          }
        }
        const dependents = this.indexer.getDependents(workspacePath, tc.path);
        for (const dep of dependents) {
          addScore(dep, 20, 'dependent_relationship');
        }
      }
    }

    // Final rerank
    candidates = Array.from(candidatesMap.values()).map(c => ({
      path: c.path,
      score: c.score,
      reasons: Array.from(c.reasons),
      matchedSymbols: c.matchedSymbols
    }));
    
    candidates = this.rankCandidates(candidates, task).slice(0, topK);

    // Build Context
    const context = this.buildContext(workspacePath, candidates, { maxPreviewLength, totalBudget, rangeWindow });

    const strategiesUsed = new Set();
    candidates.forEach(c => c.reasons.forEach(r => strategiesUsed.add(r)));

    const result = {
      task,
      candidates: candidates.map(c => ({ path: c.path, score: c.score, reasons: c.reasons })),
      context,
      stats: {
        candidatesFound: candidatesMap.size,
        selected: candidates.length,
        strategiesUsed: Array.from(strategiesUsed)
      }
    };

    if (this.cache.size >= this.MAX_CACHE_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);

    return result;
  }

  rankCandidates(candidates, task) {
    return candidates.sort((a, b) => b.score - a.score);
  }

  buildContext(workspacePath, candidates, options = {}) {
    const maxPreviewLength = options.maxPreviewLength || 12288;
    const totalBudget = options.totalBudget || 81920;
    const rangeWindow = options.rangeWindow || 20;

    let currentBudget = 0;
    const contextList = [];

    for (const c of candidates) {
      if (currentBudget >= totalBudget) break;
      
      if (!this.isPathSafe(workspacePath, c.path) || this.isSecretOrIgnored(path.basename(c.path))) {
         continue;
      }

      const meta = this.indexer.getFileMetadata(workspacePath, c.path);
      if (!meta) continue;

      let fileContent = '';
      try {
        fileContent = fs.readFileSync(path.join(workspacePath, c.path), 'utf-8');
      } catch (err) {
        continue;
      }

      const lines = fileContent.split('\n');
      
      let relevantRanges = [];
      let previewText = '';

      if (c.matchedSymbols && c.matchedSymbols.length > 0) {
        const ranges = [];
        for (const sym of c.matchedSymbols) {
          const symLine = sym.startLine !== undefined ? sym.startLine : sym.line;
          if (symLine !== undefined) {
            const start = Math.max(0, symLine - rangeWindow - 1);
            const end = Math.min(lines.length, symLine + rangeWindow);
            ranges.push({ start, end });
          }
        }
        
        ranges.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const r of ranges) {
          if (merged.length === 0) merged.push(r);
          else {
            const last = merged[merged.length - 1];
            if (r.start <= last.end + 5) {
              last.end = Math.max(last.end, r.end);
            } else {
              merged.push(r);
            }
          }
        }
        
        relevantRanges = merged;
        const snippets = merged.map(r => lines.slice(r.start, r.end).join('\n'));
        previewText = snippets.join('\n...\n');
      }

      if (!previewText || previewText.trim() === '') {
        previewText = fileContent.substring(0, maxPreviewLength);
        if (fileContent.length > maxPreviewLength) {
           previewText += '\n... (truncated)';
        }
      } else if (previewText.length > maxPreviewLength) {
        previewText = previewText.substring(0, maxPreviewLength) + '\n... (truncated)';
      }

      const entryLength = previewText.length;
      if (currentBudget + entryLength > totalBudget && contextList.length > 0) {
        break; 
      }

      contextList.push({
        path: c.path,
        language: meta.language,
        symbols: meta.symbols.map(s => s.name),
        imports: meta.imports.map(i => i.source),
        exports: meta.exports,
        relevantRanges,
        preview: previewText
      });

      currentBudget += entryLength;
    }

    return contextList;
  }
}

module.exports = ContextRetriever;
module.exports.ContextRetriever = ContextRetriever;
