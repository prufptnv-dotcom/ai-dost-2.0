const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DiffEngine = require('../agent/diffEngine');
const deterministicCodeGuard = require('./DeterministicCodeGuard');
const { resolveSafePath, safeJoin } = require('./pathSecurity');

/**
 * AI-Dost 2.0 Atomic Source Transaction & Rollback Manager
 *
 * Enforces atomic multi-file patching, pre-persistence validation,
 * automatic rollback on failure, and exact hash verification.
 */
class TransactionManager {
  constructor() {
    this.transactions = new Map();
  }

  beginTransaction(transactionId, workspacePath, projectId = 'default') {
    const tx = {
      id: transactionId,
      workspacePath,
      projectId,
      status: 'ACTIVE', // ACTIVE, COMMITTED, ROLLED_BACK, CRITICAL_RESTORE_FAILED
      snapshots: new Map(), // filePath -> { exists, content, hash, diskPath }
      stagedWrites: new Map(), // filePath -> { newContent, strategy, confidence }
      timestamp: Date.now()
    };
    this.transactions.set(transactionId, tx);

    // Keep size bounded
    if (this.transactions.size > 100) {
      const oldestKey = this.transactions.keys().next().value;
      this.transactions.delete(oldestKey);
    }
    return tx;
  }

  getTransaction(transactionId) {
    return this.transactions.get(transactionId);
  }

  hasActiveTransaction(transactionId) {
    const tx = this.transactions.get(transactionId);
    return Boolean(tx && tx.status === 'ACTIVE');
  }

  /**
   * Stages a new file creation into the active transaction.
   */
  stageNewFile(transactionId, { path: relPath, content }) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'ACTIVE') {
      return { success: false, code: 'INVALID_TRANSACTION', error: `Transaction ${transactionId} is not active` };
    }
    if (!relPath || typeof relPath !== 'string') {
      return { success: false, code: 'INVALID_CONTRACT', error: 'Missing or invalid path for stageNewFile' };
    }
    if (typeof content !== 'string') {
      return { success: false, code: 'INVALID_CONTRACT', error: 'Content must be a string for stageNewFile' };
    }

    const resolvedPath = resolveSafePath(tx.workspacePath, relPath);
    if (!resolvedPath) {
      return { success: false, code: 'ACCESS_DENIED', error: `Access denied or path traversal blocked: ${relPath}` };
    }

    // Capture snapshot of original state before any modification
    if (!tx.snapshots.has(relPath)) {
      if (fs.existsSync(resolvedPath)) {
        const origContent = fs.readFileSync(resolvedPath, 'utf-8');
        const origHash = crypto.createHash('sha256').update(origContent).digest('hex');
        tx.snapshots.set(relPath, { exists: true, content: origContent, hash: origHash, diskPath: resolvedPath });
      } else {
        tx.snapshots.set(relPath, { exists: false, content: null, hash: null, diskPath: resolvedPath });
      }
    }

    tx.stagedWrites.set(relPath, {
      newContent: content,
      strategy: 'new_file',
      confidence: 1.0
    });

    return {
      success: true,
      path: relPath,
      strategy: 'new_file'
    };
  }

  /**
   * Stages an apply_diff patch into the active transaction.
   * Validates patch contract, checks source hash, computes diff, runs deterministicCodeGuard.
   */
  stagePatch(transactionId, { path: relPath, search, replace, expectedSourceHash }) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'ACTIVE') {
      return { success: false, code: 'INVALID_TRANSACTION', error: `Transaction ${transactionId} is not active` };
    }

    // Canonical patch contract validation
    if (!relPath || typeof relPath !== 'string') {
      return { success: false, code: 'INVALID_PATCH_CONTRACT', error: 'Missing or invalid path in apply_diff' };
    }
    if (!search || typeof search !== 'string' || !search.trim()) {
      return { success: false, code: 'INVALID_PATCH_CONTRACT', error: 'Non-empty search block is required for apply_diff' };
    }
    if (typeof replace !== 'string') {
      return { success: false, code: 'INVALID_PATCH_CONTRACT', error: 'Replace block must be a string for apply_diff' };
    }
    if (expectedSourceHash !== undefined && typeof expectedSourceHash !== 'string') {
      return { success: false, code: 'INVALID_PATCH_CONTRACT', error: 'expectedSourceHash must be a string if provided' };
    }

    // Security check: resolve safe path
    const resolvedPath = resolveSafePath(tx.workspacePath, relPath);
    if (!resolvedPath) {
      return { success: false, code: 'ACCESS_DENIED', error: `Access denied or path traversal blocked: ${relPath}` };
    }

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, code: 'FILE_NOT_FOUND', error: `File not found: ${relPath}. Use read_file first.` };
    }

    // Capture snapshot of original state before any modification
    if (!tx.snapshots.has(relPath)) {
      const origContent = fs.readFileSync(resolvedPath, 'utf-8');
      const origHash = crypto.createHash('sha256').update(origContent).digest('hex');
      tx.snapshots.set(relPath, { exists: true, content: origContent, hash: origHash, diskPath: resolvedPath });
    }

    const currentSnapshot = tx.snapshots.get(relPath);
    const baseContent = tx.stagedWrites.has(relPath)
      ? tx.stagedWrites.get(relPath).newContent
      : currentSnapshot.content;

    // Apply DiffEngine
    const diffResult = DiffEngine.apply(baseContent, search, replace, { expectedSourceHash });
    if (!diffResult.success) {
      return { success: false, code: diffResult.code || 'DIFF_FAILED', error: diffResult.error };
    }

    // DeterministicCodeGuard validation
    const guard = deterministicCodeGuard.guard(relPath, diffResult.newContent);
    if (!guard.accepted) {
      return {
        success: false,
        code: 'GUARD_REJECTED',
        error: `Code rejected before persistence: ${guard.reason}`,
        diagnostics: guard.diagnostics,
        verification: guard.verification
      };
    }

    tx.stagedWrites.set(relPath, {
      newContent: diffResult.newContent,
      strategy: diffResult.strategy,
      confidence: diffResult.confidence,
      diagnostics: guard.diagnostics,
      verification: guard.verification
    });

    return {
      success: true,
      path: relPath,
      strategy: diffResult.strategy,
      confidence: diffResult.confidence,
      newContent: diffResult.newContent,
      verification: guard.verification
    };
  }

  /**
   * Commits all staged writes to disk atomically.
   * If any disk write fails, triggers automatic rollback immediately.
   */
  commit(transactionId) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'ACTIVE') {
      return { success: false, code: 'INVALID_TRANSACTION', error: 'No active transaction to commit' };
    }

    const writtenFiles = [];
    try {
      for (const [relPath, staged] of tx.stagedWrites.entries()) {
        const snapshot = tx.snapshots.get(relPath);
        const diskPath = snapshot ? snapshot.diskPath : safeJoin(tx.workspacePath, relPath);
        fs.mkdirSync(path.dirname(diskPath), { recursive: true });
        fs.writeFileSync(diskPath, staged.newContent, 'utf-8');
        writtenFiles.push(relPath);
      }
      tx.status = 'COMMITTED';
      return { success: true, status: 'COMMITTED', committedFiles: writtenFiles };
    } catch (writeErr) {
      // Auto-rollback immediately on write failure
      const rbResult = this.rollback(transactionId);
      return {
        success: false,
        code: 'COMMIT_FAILED',
        error: `Write failure during commit: ${writeErr.message}. Automatic rollback executed.`,
        rollback: rbResult
      };
    }
  }

  /**
   * Rolls back the transaction to the exact before-state.
   * Verifies that the restored file hashes exactly match original before-hashes.
   */
  rollback(transactionId) {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      return { success: false, code: 'TRANSACTION_NOT_FOUND', error: 'Transaction not found' };
    }

    let restoredCount = 0;
    const errors = [];

    for (const [relPath, snapshot] of tx.snapshots.entries()) {
      try {
        if (snapshot.exists) {
          fs.mkdirSync(path.dirname(snapshot.diskPath), { recursive: true });
          fs.writeFileSync(snapshot.diskPath, snapshot.content, 'utf-8');
          // Verify restored hash
          const currentHash = crypto.createHash('sha256').update(fs.readFileSync(snapshot.diskPath, 'utf-8')).digest('hex');
          if (currentHash !== snapshot.hash) {
            errors.push(`Hash mismatch after restore on ${relPath}: expected ${snapshot.hash}, found ${currentHash}`);
          } else {
            restoredCount++;
          }
        } else {
          if (fs.existsSync(snapshot.diskPath)) {
            fs.unlinkSync(snapshot.diskPath);
            restoredCount++;
          }
        }
      } catch (e) {
        errors.push(`Failed restoring ${relPath}: ${e.message}`);
      }
    }

    if (errors.length > 0) {
      tx.status = 'CRITICAL_RESTORE_FAILED';
      return {
        success: false,
        code: 'CRITICAL_RESTORE_FAILED',
        error: `Rollback failed: ${errors.join('; ')}`,
        restoredCount
      };
    }

    tx.status = 'ROLLED_BACK';
    return {
      success: true,
      status: 'ROLLED_BACK',
      message: `Successfully rolled back ${restoredCount} file(s) to previous exact hash.`,
      restoredCount
    };
  }
}

const defaultInstance = new TransactionManager();
defaultInstance.TransactionManager = TransactionManager;
module.exports = defaultInstance;
