const DependencyAnalyzer = require('./DependencyAnalyzer');
const fs = require('fs');
const path = require('path');

class DependencyGraph {
    constructor() {
        // Map of absoluteFilePath -> { dependencies: Set<String>, dependents: Set<String> }
        this.nodes = new Map();
    }

    updateFile(filePath, content) {
        filePath = filePath.replace(/\\/g, '/');
        if (!content) return;
        
        let deps;
        try {
            deps = DependencyAnalyzer.analyze(filePath, content);
        } catch (e) {
            return; // ignore parse errors safely
        }

        if (!this.nodes.has(filePath)) {
            this.nodes.set(filePath, { dependencies: new Set(), dependents: new Set() });
        }
        const node = this.nodes.get(filePath);
        
        // Remove old dependencies reverse links
        for (const oldDep of node.dependencies) {
            if (this.nodes.has(oldDep)) {
                this.nodes.get(oldDep).dependents.delete(filePath);
            }
        }
        node.dependencies.clear();

        // Add new dependencies
        for (const rawDep of deps) {
            const depPath = this._resolveExtension(rawDep);
            if (!depPath) continue;
            
            node.dependencies.add(depPath);
            if (!this.nodes.has(depPath)) {
                this.nodes.set(depPath, { dependencies: new Set(), dependents: new Set() });
            }
            this.nodes.get(depPath).dependents.add(filePath);
        }
    }

    _resolveExtension(basePath) {
        // normalize paths to forward slashes for cross-platform consistency
        const normalize = (p) => p.replace(/\\/g, '/');
        const exts = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts'];
        for (const ext of exts) {
            const p = basePath + ext;
            if (fs.existsSync(p)) return normalize(p);
        }
        // If file doesn't exist on disk yet (newly created imports), fallback to .js
        return normalize(basePath + (path.extname(basePath) ? '' : '.js'));
    }

    getAffectedFiles(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        const affected = new Set();
        const queue = [normalized];
        
        while (queue.length > 0) {
            const current = queue.shift();
            if (this.nodes.has(current)) {
                for (const dependent of this.nodes.get(current).dependents) {
                    if (!affected.has(dependent)) {
                        affected.add(dependent);
                        queue.push(dependent);
                    }
                }
            }
        }
        return Array.from(affected);
    }

    addOrUpdate(filePath, content) {
        this.updateFile(filePath, content);
        return this.getAffectedFiles(filePath);
    }

    detectCycle() {
        const visited = new Set();
        const stack = new Set();

        const dfs = (nodeId) => {
            if (stack.has(nodeId)) return true; // Cycle detected
            if (visited.has(nodeId)) return false; // Already checked

            visited.add(nodeId);
            stack.add(nodeId);

            const node = this.nodes.get(nodeId);
            if (node) {
                for (const dep of node.dependencies) {
                    if (dfs(dep)) return true;
                }
            }

            stack.delete(nodeId);
            return false;
        };

        for (const nodeId of this.nodes.keys()) {
            if (dfs(nodeId)) return true;
        }

        return false;
    }
}
module.exports = DependencyGraph;
