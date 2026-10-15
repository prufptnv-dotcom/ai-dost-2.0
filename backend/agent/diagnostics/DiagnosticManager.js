const JSTsAdapter = require('./adapters/JSTsAdapter');

class DiagnosticManager {
  constructor(sandboxMgr) {
    this.sandboxMgr = sandboxMgr;
    this.adapters = [new JSTsAdapter(sandboxMgr)];
    this.cache = new Map();
  }

  async runDiagnostics(sandboxId, workspacePath, filePath, fileHash) {
    const cacheKey = `${sandboxId || 'host'}:${filePath}:${fileHash || ''}`;
    if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
    }

    const applicableAdapters = this.adapters.filter(a => a.canHandle(filePath));
    let allDiagnostics = [];

    for (const adapter of applicableAdapters) {
       try {
           const diags = await adapter.run(sandboxId, workspacePath, filePath);
           if (diags && diags.length > 0) {
               allDiagnostics.push(...diags);
           }
       } catch (err) {
           console.error(`[Diagnostics] Adapter error for ${filePath}: ${err.message}`);
       }
    }

    const result = {
        hasErrors: allDiagnostics.some(d => d.severity === 'error' || d.severity === 'fatal'),
        diagnostics: allDiagnostics,
        formattedErrors: this.formatDiagnostics(allDiagnostics)
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  formatDiagnostics(diags) {
    if (!diags || diags.length === 0) return '';
    return diags.map(d => {
       const lineCol = d.line ? `:${d.line}${d.column ? `:${d.column}` : ''}` : '';
       return `[${(d.severity || 'error').toUpperCase()}] ${d.source || 'unknown'} at ${d.file}${lineCol}\nError: ${d.message}`;
    }).join('\n\n');
  }
}

module.exports = DiagnosticManager;
