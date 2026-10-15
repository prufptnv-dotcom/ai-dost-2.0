const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function cloneVector(vector = {}) {
  return Object.fromEntries(Object.entries(vector).map(([agentId, revision]) => [agentId, Number(revision) || 0]));
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
}

function freezeSnapshot(snapshot) {
  snapshot.files.forEach((file) => Object.freeze(file));
  Object.freeze(snapshot.files);
  return Object.freeze(snapshot);
}

/**
 * Local conflict judge for concurrent agent writes.
 * It uses causal version vectors and immutable filesystem snapshots only;
 * it never calls a model to resolve a collision.
 */
class ArbitratorAgent {
  constructor(options = {}) {
    this.maxOperations = options.maxOperations || 500;
    this.workspaces = new Map();
  }

  _workspace(workspacePath) {
    const key = path.resolve(workspacePath);
    if (!this.workspaces.has(key)) {
      this.workspaces.set(key, {
        vector: {},
        bestFiles: new Map(),
        snapshots: new Map(),
        opLog: [],
      });
    }
    return this.workspaces.get(key);
  }

  getVersionVector(workspacePath) {
    return cloneVector(this._workspace(workspacePath).vector);
  }

  _readFile(filePath) {
    if (!fs.existsSync(filePath)) return { exists: false, content: '' };
    return { exists: true, content: fs.readFileSync(filePath, 'utf8') };
  }

  _captureSnapshot(workspacePath, files, label) {
    const normalizedFiles = [...new Set(files.map((file) => path.resolve(workspacePath, file)))];
    const snapshot = {
      id: `snapshot_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      workspacePath: path.resolve(workspacePath),
      label,
      versionVector: this.getVersionVector(workspacePath),
      files: normalizedFiles.map((filePath) => {
        const file = this._readFile(filePath);
        return {
          path: filePath,
          exists: file.exists,
          content: file.content,
          hash: hashContent(file.content),
        };
      }),
      createdAt: Date.now(),
    };
    return freezeSnapshot(snapshot);
  }

  _isCausallyBefore(left, right) {
    const agents = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    let strictlyBehind = false;
    for (const agentId of agents) {
      const leftRevision = Number(left?.[agentId]) || 0;
      const rightRevision = Number(right?.[agentId]) || 0;
      if (leftRevision > rightRevision) return false;
      if (leftRevision < rightRevision) strictlyBehind = true;
    }
    return strictlyBehind;
  }

  compareVectors(left = {}, right = {}) {
    if (JSON.stringify(cloneVector(left)) === JSON.stringify(cloneVector(right))) return 'equal';
    if (this._isCausallyBefore(left, right)) return 'before';
    if (this._isCausallyBefore(right, left)) return 'after';
    return 'concurrent';
  }

  _restoreSnapshot(snapshot) {
    for (const file of snapshot.files) {
      if (!file.exists) {
        if (fs.existsSync(file.path)) fs.rmSync(file.path, { force: true });
        continue;
      }
      fs.mkdirSync(path.dirname(file.path), { recursive: true });
      fs.writeFileSync(file.path, file.content, 'utf8');
    }
  }

  beginOperation({ workspacePath, agentId = 'agent', files = [], versionVector }) {
    const state = this._workspace(workspacePath);
    const baseVector = cloneVector(versionVector || state.vector);
    const currentVector = cloneVector(state.vector);
    const relation = this.compareVectors(baseVector, currentVector);
    const snapshot = this._captureSnapshot(workspacePath, files, `before:${agentId}`);
    const operation = {
      id: `op_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      workspacePath: path.resolve(workspacePath),
      agentId,
      files: [...files],
      baseVector,
      snapshot,
      startedAt: Date.now(),
    };

    if (versionVector && (relation === 'before' || relation === 'concurrent')) {
      const bestSnapshot = this._bestSnapshot(workspacePath, files);
      this._restoreSnapshot(bestSnapshot);
      operation.conflict = {
        reason: relation === 'concurrent' ? 'Concurrent agent write detected' : 'Stale agent version detected',
        currentVector,
        requestedVector: baseVector,
        rollbackSnapshotId: bestSnapshot.id,
      };
      this._record(state, operation, 'rollback');
      return operation;
    }

    return operation;
  }

  _bestSnapshot(workspacePath, files) {
    const state = this._workspace(workspacePath);
    const normalized = [...new Set(files.map((file) => path.resolve(workspacePath, file)))];
    const snapshot = {
      id: `best_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      workspacePath: path.resolve(workspacePath),
      label: 'last-known-good',
      versionVector: cloneVector(state.vector),
      files: normalized.map((filePath) => state.bestFiles.get(filePath) || {
        path: filePath,
        ...this._readFile(filePath),
        hash: hashContent(this._readFile(filePath).content),
      }),
      createdAt: Date.now(),
    };
    return freezeSnapshot(snapshot);
  }

  commitOperation(operation, result = {}) {
    const state = this._workspace(operation.workspacePath);
    if (operation.conflict) return { success: false, ...operation.conflict };

    const relation = this.compareVectors(operation.baseVector, state.vector);
    if (relation !== 'equal') {
      const bestSnapshot = this._bestSnapshot(operation.workspacePath, operation.files);
      this._restoreSnapshot(bestSnapshot);
      const conflict = {
        success: false,
        reason: 'Workspace changed while agent operation was running',
        currentVector: cloneVector(state.vector),
        requestedVector: operation.baseVector,
        rollbackSnapshotId: bestSnapshot.id,
      };
      this._record(state, { ...operation, conflict }, 'rollback');
      return conflict;
    }

    const nextVector = cloneVector(state.vector);
    nextVector[operation.agentId] = (nextVector[operation.agentId] || 0) + 1;
    state.vector = nextVector;
    for (const file of operation.files) {
      const filePath = path.resolve(operation.workspacePath, file);
      const current = this._readFile(filePath);
      state.bestFiles.set(filePath, Object.freeze({
        path: filePath,
        exists: current.exists,
        content: current.content,
        hash: hashContent(current.content),
      }));
    }
    this._record(state, { ...operation, result, committedVector: nextVector }, 'commit');
    return { success: true, versionVector: cloneVector(nextVector), snapshotId: operation.snapshot.id };
  }

  _record(state, operation, type) {
    state.opLog.push(Object.freeze({
      id: operation.id,
      type,
      agentId: operation.agentId,
      files: [...operation.files],
      baseVector: cloneVector(operation.baseVector),
      committedVector: operation.committedVector ? cloneVector(operation.committedVector) : null,
      conflict: operation.conflict || null,
      snapshotId: operation.snapshot?.id || operation.conflict?.rollbackSnapshotId,
      timestamp: Date.now(),
    }));
    if (state.opLog.length > this.maxOperations) state.opLog.splice(0, state.opLog.length - this.maxOperations);
  }

  getOpLog(workspacePath) {
    return [...this._workspace(workspacePath).opLog];
  }
}

module.exports = ArbitratorAgent;
module.exports.shared = new ArbitratorAgent();