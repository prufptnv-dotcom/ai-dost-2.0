'use strict';

/**
 * AI-Dost Durable Receipt Replay Protection Store
 * Uses SQLite with an atomic PRIMARY KEY uniqueness constraint and WAL mode
 * to guarantee that receipt signatures can never be replayed across concurrent
 * requests or service restarts.
 */

const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

let defaultDbPath = process.env.AIDOST_REPLAY_DB_PATH || path.join(__dirname, '..', 'data', 'receipt_replay.db');
let dbInstance = null;

function _setDefaultDbPathForTesting(customPath) {
  defaultDbPath = customPath;
  dbInstance = null;
}

function getReplayDatabase(customPath = null) {
  if (customPath) {
    const dir = path.dirname(customPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(customPath);
    initReplaySchema(db);
    return db;
  }

  if (dbInstance) return dbInstance;

  const dir = path.dirname(defaultDbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  dbInstance = new DatabaseSync(defaultDbPath);
  initReplaySchema(dbInstance);
  return dbInstance;
}

function initReplaySchema(db) {
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  } catch (_) {
    // In-memory or temporary SQLite instances may ignore WAL mode pragma
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS consumed_receipts (
      signature TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      artifact_hash TEXT NOT NULL,
      consumed_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_consumed_receipts_run ON consumed_receipts(run_id);
  `);
}

/**
 * Atomically records and consumes a receipt signature.
 * Throws RECEIPT_REPLAY_DETECTED if signature was already consumed.
 * Throws REPLAY_REGISTRY_ERROR if persistence fails.
 */
function consumeReceiptSignature(signature, runId = 'unknown', artifactHash = 'unknown', customDb = null) {
  if (!signature || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature.trim())) {
    throw new Error('MALFORMED_RECEIPT_SIGNATURE: Signature must be a 64-character hex string.');
  }

  const sig = signature.trim().toLowerCase();
  const db = customDb || getReplayDatabase();

  try {
    const stmt = db.prepare(`
      INSERT INTO consumed_receipts (signature, run_id, artifact_hash, consumed_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sig, String(runId), String(artifactHash), new Date().toISOString());
    return true;
  } catch (err) {
    if (err && (err.message.includes('UNIQUE constraint failed') || err.message.includes('PRIMARY KEY'))) {
      const replayError = new Error(`RECEIPT_REPLAY_DETECTED: Signature ${sig} has already been consumed.`);
      replayError.code = 'RECEIPT_REPLAY_DETECTED';
      throw replayError;
    }
    const regError = new Error(`REPLAY_REGISTRY_ERROR: Failed to persist consumed receipt signature: ${err.message}`);
    regError.code = 'REPLAY_REGISTRY_ERROR';
    throw regError;
  }
}

/**
 * Checks whether a signature has already been consumed.
 * Throws REPLAY_REGISTRY_ERROR on database lookup error (fail closed).
 */
function isReceiptSignatureConsumed(signature, customDb = null) {
  if (!signature || typeof signature !== 'string') return false;
  const sig = signature.trim().toLowerCase();
  const db = customDb || getReplayDatabase();

  try {
    const stmt = db.prepare('SELECT 1 FROM consumed_receipts WHERE signature = ? LIMIT 1');
    const row = stmt.get(sig);
    return Boolean(row);
  } catch (err) {
    const regError = new Error(`REPLAY_REGISTRY_ERROR: Failed to query replay registry: ${err.message}`);
    regError.code = 'REPLAY_REGISTRY_ERROR';
    throw regError;
  }
}

/**
 * Testing utility to reset replay store.
 */
function _clearConsumedReceiptsForTesting(customDb = null) {
  try {
    const db = customDb || getReplayDatabase();
    db.exec('DELETE FROM consumed_receipts;');
  } catch (_) {
    // Database table may not exist yet in fresh test environment
  }
}

module.exports = {
  consumeReceiptSignature,
  isReceiptSignatureConsumed,
  getReplayDatabase,
  _clearConsumedReceiptsForTesting,
  _setDefaultDbPathForTesting
};
