/**
 * AI-Dost Deep AST & Codebase Dependency Graph Engine
 * Maps import/export graphs and component hierarchies across React, Vue, Next.js, and Node.js
 */

const fs = require('fs');
const path = require('path');

class AstService {
  /**
   * Parse imports and exports from file content using regex and lightweight tokenizer
   */
  parseFileDependencies(filePath, content) {
    const dependencies = {
      path: filePath,
      imports: [],
      exports: [],
      components: []
    };

    if (!content || typeof content !== 'string') return dependencies;

    // 1. Extract ES6 imports: import X from './path'; import { Y } from '../path';
    const importRegex = /import\s+(?:([\w*\s{},]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.imports.push({
        symbols: (match[1] || '').trim(),
        source: match[2]
      });
    }

    // 2. Extract CommonJS require: const X = require('./path');
    const requireRegex = /(?:const|let|var)\s+([\w\s{},]+)\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.imports.push({
        symbols: match[1].trim(),
        source: match[2]
      });
    }

    // 3. Extract Component definitions: function App() | const Button = () =>
    const compRegex = /(?:export\s+default\s+function|export\s+function|function|const)\s+([A-Z]\w+)/g;
    while ((match = compRegex.exec(content)) !== null) {
      if (!dependencies.components.includes(match[1])) {
        dependencies.components.push(match[1]);
      }
    }

    // 4. Extract Exports
    const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class)?\s*(\w+)?/g;
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1] && !dependencies.exports.includes(match[1])) {
        dependencies.exports.push(match[1]);
      }
    }

    return dependencies;
  }

  /**
   * Build complete project dependency graph from files array
   */
  buildProjectGraph(files = []) {
    const graph = {
      nodes: {},
      dependentsOf: {}, // file -> files that import it
      componentMap: {}  // ComponentName -> file
    };

    for (const f of files) {
      const parsed = this.parseFileDependencies(f.path, f.content);
      graph.nodes[f.path] = parsed;

      parsed.components.forEach(comp => {
        graph.componentMap[comp] = f.path;
      });
    }

    // Build dependents lookup
    for (const [sourcePath, node] of Object.entries(graph.nodes)) {
      for (const imp of node.imports) {
        // Resolve relative import to normalized path
        const resolved = this.resolveImportPath(sourcePath, imp.source, Object.keys(graph.nodes));
        if (resolved) {
          if (!graph.dependentsOf[resolved]) graph.dependentsOf[resolved] = [];
          if (!graph.dependentsOf[resolved].includes(sourcePath)) {
            graph.dependentsOf[resolved].push(sourcePath);
          }
        }
      }
    }

    return graph;
  }

  /**
   * Resolve relative import path to known project file path
   */
  resolveImportPath(fromPath, importSource, allPaths) {
    if (importSource.startsWith('.')) {
      const dir = path.dirname(fromPath);
      const target = path.posix.normalize(path.posix.join(dir === '.' ? '' : dir, importSource));
      // Try exact match or with extensions
      const candidates = [target, `${target}.js`, `${target}.jsx`, `${target}.ts`, `${target}.tsx`, `${target}/index.js`, `${target}/index.jsx`];
      return allPaths.find(p => candidates.includes(p.replace(/\\/g, '/'))) || null;
    }
    return null;
  }

  /**
   * Get impact analysis: If a file changes, what files must be verified?
   */
  getImpactedFiles(filePath, graph) {
    const impacted = new Set([filePath]);
    const queue = [filePath];

    while (queue.length > 0) {
      const curr = queue.shift();
      const dependents = graph.dependentsOf[curr] || [];
      for (const dep of dependents) {
        if (!impacted.has(dep)) {
          impacted.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(impacted);
  }
}

module.exports = new AstService();
