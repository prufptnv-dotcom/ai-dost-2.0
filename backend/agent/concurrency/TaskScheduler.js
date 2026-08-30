const path = require('path');
const lockManager = require('./LockManager');

class TaskScheduler {
    constructor() {
        this.metrics = { sequentialTime: 0, parallelTime: 0, toolCalls: 0 };
    }

    async schedule(tasks, executorFn) {
        if (!tasks || tasks.length === 0) return [];
        this.metrics.toolCalls += tasks.length;
        const start = Date.now();
        const results = new Array(tasks.length).fill(null);
        let planAborted = false;

        // 1. Build DAG Metadata
        const nodes = tasks.map((task, index) => {
            const produces = ['write_file', 'apply_diff'].includes(task.action) ? [task.parameters?.path] : [];
            const consumes = ['read_file', 'apply_diff'].includes(task.action) ? [task.parameters?.path] : [];
            if (task.action === 'list_directory') consumes.push(task.parameters?.dir_path);
            
            // filter out undefined paths
            const pF = produces.filter(Boolean).map(p => path.normalize(p));
            const cF = consumes.filter(Boolean).map(p => path.normalize(p));
            const isGlobal = pF.length === 0 && cF.length === 0;

            return { index, task, produces: pF, consumes: cF, isGlobal, dependsOn: new Set(), affectedFiles: [] };
        });

        // 2. Compute dependencies (Execution Order DAG)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = 0; j < i; j++) {
                if (nodes[i].isGlobal || nodes[j].isGlobal) {
                    nodes[i].dependsOn.add(j);
                    continue;
                }
                const overlap = (arr1, arr2) => arr1.some(x => arr2.includes(x));
                if (overlap(nodes[i].consumes, nodes[j].produces) ||
                    overlap(nodes[i].produces, nodes[j].produces) ||
                    overlap(nodes[i].produces, nodes[j].consumes)) {
                    nodes[i].dependsOn.add(j);
                }
            }
        }

        // 3. Detect Cycles (DFS)
        const hasCycle = this._detectCycle(nodes);
        if (hasCycle) {
            // Abort the entire plan
            return results.map(() => ({ success: false, error: 'Plan aborted due to cyclic dependencies in tasks' }));
        }

        // 4. Execute parallel DAG
        const promises = new Map();
        const executeNode = async (node) => {
            if (planAborted) {
                results[node.index] = { success: false, error: 'Plan aborted' };
                return;
            }

            // wait for all dependencies to finish
            for (const depIndex of node.dependsOn) {
                try {
                    await promises.get(depIndex);
                } catch (e) {
                    planAborted = true;
                    results[node.index] = { success: false, error: 'Dependency failed' };
                    return;
                }
            }
            
            if (planAborted) {
                results[node.index] = { success: false, error: 'Plan aborted' };
                return;
            }

            const acquiredLocks = [];
            const defaultTimeout = parseInt(process.env.LOCK_TIMEOUT_MS, 10) || 30000;
            
            try {
                // Acquire locks for produced files
                for (const file of node.produces) {
                    const token = await lockManager.acquire(file, defaultTimeout);
                    acquiredLocks.push({ file, token });
                }

                const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('Task timeout')), defaultTimeout));
                const execPromise = executorFn(node.task.action, node.task.parameters);
                
                results[node.index] = await Promise.race([execPromise, timeoutPromise]);
                
                // If the task failed (returned success: false), abort plan (if specified)
                if (results[node.index]?.success === false) {
                    planAborted = true;
                }
            } catch (err) {
                planAborted = true;
                results[node.index] = { success: false, error: err.message };
            } finally {
                for (const { file, token } of acquiredLocks) {
                    lockManager.release(file, token);
                }
            }
        };

        for (const node of nodes) {
            promises.set(node.index, executeNode(node));
        }

        await Promise.all(Array.from(promises.values()));
        this.metrics.parallelTime += (Date.now() - start);
        return results;
    }

    _detectCycle(nodes) {
        const visited = new Set();
        const stack = new Set();
        const visit = (idx) => {
            if (stack.has(idx)) return true;
            if (visited.has(idx)) return false;
            visited.add(idx);
            stack.add(idx);
            for (const dep of nodes[idx].dependsOn) {
                if (visit(dep)) return true;
            }
            stack.delete(idx);
            return false;
        };
        for (let i = 0; i < nodes.length; i++) {
            if (visit(i)) return true;
        }
        return false;
    }
}
module.exports = TaskScheduler;
