'use strict';

const DependencyAnalyzer = require('./DependencyAnalyzer');
const fs = require('fs');
const path = require('path');

class DependencyGraph {
    constructor() {
        // Map of canonical absolute paths -> dependency and reverse-dependency sets.
        this.nodes = new Map();
    }

    normalizePath(filePath) {
        if (typeof filePath !== 'string' || !filePath.trim()) return null;
        return path.resolve(filePath).replace(/\\/g, '/');
    }

    updateFile(filePath, content) {
        const normalizedPath = this.normalizePath(filePath);
        if (!normalizedPath || typeof content !== 'string') return;

        let deps;
        try {
            deps = DependencyAnalyzer.analyze(normalizedPath, content);
        } catch (_) {
            // Keep the last known-good edges when dependency analysis fails.
            return;
        }

        if (!this.nodes.has(normalizedPath)) {
            this.nodes.set(normalizedPath, { dependencies: new Set(), dependents: new Set() });
        }
        const node = this.nodes.get(normalizedPath);

        // Remove reverse links first so edits and emptied files cannot leave stale edges.
        for (const oldDep of node.dependencies) {
            const target = this.nodes.get(oldDep);
            if (target) target.dependents.delete(normalizedPath);
        }
        node.dependencies.clear();

        for (const rawDep of deps) {
            const depPath = this._resolveExtension(rawDep);
            if (!depPath) continue;

            node.dependencies.add(depPath);
            if (!this.nodes.has(depPath)) {
                this.nodes.set(depPath, { dependencies: new Set(), dependents: new Set() });
            }
            this.nodes.get(depPath).dependents.add(normalizedPath);
        }
    }

    _resolveExtension(basePath) {
        const normalizedBase = this.normalizePath(basePath);
        if (!normalizedBase) return null;

        const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.ts'];
        for (const extension of extensions) {
            const candidate = normalizedBase + extension;
            try {
                if (fs.existsSync(candidate)) return this.normalizePath(candidate);
            } catch (_) {
                // A transient filesystem error should not crash graph updates.
            }
        }

        // Generated files may not exist on disk yet; preserve an explicit extension.
        return this.normalizePath(normalizedBase + (path.extname(normalizedBase) ? '' : '.js'));
    }

    getAffectedFiles(filePath) {
        const normalizedPath = this.normalizePath(filePath);
        if (!normalizedPath) return [];

        const affected = new Set();
        // Mark the start node visited up front so a dependency cycle never
        // reports the changed file as its own affected dependent.
        const visited = new Set([normalizedPath]);
        const queue = [normalizedPath];
        // An index avoids Array.shift(), whose repeated reindexing becomes quadratic
        // for large dependency graphs.
        for (let head = 0; head < queue.length; head += 1) {
            const current = queue[head];
            const node = this.nodes.get(current);
            if (!node) continue;

            for (const dependent of node.dependents) {
                if (!visited.has(dependent)) {
                    visited.add(dependent);
                    affected.add(dependent);
                    queue.push(dependent);
                }
            }
        }
        return Array.from(affected).sort();
    }

    addOrUpdate(filePath, content) {
        this.updateFile(filePath, content);
        return this.getAffectedFiles(filePath);
    }

    detectCycle() {
        // Iterative three-color DFS avoids a call-stack overflow on deeply chained
        // projects while retaining O(V + E) traversal complexity.
        const state = new Map(); // absent = unvisited, 1 = active, 2 = complete
        const nodeIds = Array.from(this.nodes.keys()).sort();

        for (const startId of nodeIds) {
            if (state.get(startId) === 2) continue;

            state.set(startId, 1);
            const startNode = this.nodes.get(startId);
            const stack = [{
                id: startId,
                dependencies: Array.from(startNode ? startNode.dependencies : []).sort(),
                index: 0
            }];

            while (stack.length > 0) {
                const frame = stack[stack.length - 1];
                if (frame.index >= frame.dependencies.length) {
                    state.set(frame.id, 2);
                    stack.pop();
                    continue;
                }

                const dependencyId = frame.dependencies[frame.index];
                frame.index += 1;
                const dependencyState = state.get(dependencyId) || 0;
                if (dependencyState === 1) return true;
                if (dependencyState === 2) continue;

                state.set(dependencyId, 1);
                const dependencyNode = this.nodes.get(dependencyId);
                stack.push({
                    id: dependencyId,
                    dependencies: Array.from(dependencyNode ? dependencyNode.dependencies : []).sort(),
                    index: 0
                });
            }
        }
        return false;
    }
}

module.exports = DependencyGraph;
