const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const workspaceManager = require('../services/workspaceManager');
const logger = require('../logger');

const { DatabaseSync: Database } = (() => {
  try { return require('node:sqlite'); } catch(_) { return {}; }
})();

// In-memory mock database store for projects without SQLite files
const mockStores = new Map();

function getMockStore(projectId) {
  if (!mockStores.has(projectId)) {
    mockStores.set(projectId, {
      crypto_assets: [
        { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 64250.80, holdings: 0.45, change_24h: 3.42, status: 'Active' },
        { id: '2', symbol: 'ETH', name: 'Ethereum', price: 3480.25, holdings: 4.20, change_24h: 5.18, status: 'Active' },
        { id: '3', symbol: 'SOL', name: 'Solana', price: 151.84, holdings: 35.00, change_24h: -1.91, status: 'Active' },
        { id: '4', symbol: 'USDT', name: 'Tether USD', price: 1.00, holdings: 12450.00, change_24h: 0.00, status: 'Active' }
      ],
      transactions: [
        { id: 'tx_101', type: 'BUY', symbol: 'BTC', amount: 0.25, price: 61500.00, total_usd: 15375.00, timestamp: '2026-09-06 18:24' },
        { id: 'tx_102', type: 'BUY', symbol: 'ETH', amount: 2.50, price: 3250.00, total_usd: 8125.00, timestamp: '2026-09-06 14:10' },
        { id: 'tx_103', type: 'SELL', symbol: 'SOL', amount: 15.00, price: 155.20, total_usd: 2328.00, timestamp: '2026-09-05 21:05' }
      ],
      users: [
        { id: 'u_1', username: 'trader_pro', email: 'trader@aidost.io', tier: 'PRO', balance_usd: 68421.46 }
      ]
    });
  }
  return mockStores.get(projectId);
}

function findSqliteDbFile(projectId) {
  try {
    const root = workspaceManager.getWorkspacePath(projectId);
    const candidates = ['app.db', 'database.sqlite', 'data.db', 'data/app.db', 'db.sqlite'];
    for (const c of candidates) {
      const fp = path.join(root, c);
      if (fs.existsSync(fp)) return fp;
    }
  } catch (_) {}
  return null;
}

// ── GET /api/database/:projectId/tables ──────────────────────────────────────
router.get('/:projectId/tables', (req, res) => {
  const { projectId } = req.params;
  const dbPath = findSqliteDbFile(projectId);

  if (dbPath && Database) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      db.close();
      const tables = rows.map(r => r.name);
      return res.json({ success: true, isRealSqlite: true, dbPath: path.basename(dbPath), tables });
    } catch (err) {
      logger.warn('[Database] SQLite read error:', err.message);
    }
  }

  // Fallback to project mock store
  const store = getMockStore(projectId);
  const tables = Object.keys(store);
  res.json({ success: true, isRealSqlite: false, dbPath: 'in-memory (Reactive Mock)', tables });
});

// ── GET /api/database/:projectId/table/:tableName ────────────────────────────
router.get('/:projectId/table/:tableName', (req, res) => {
  const { projectId, tableName } = req.params;
  const dbPath = findSqliteDbFile(projectId);

  if (dbPath && Database) {
    try {
      const db = new Database(dbPath, { readonly: true });
      const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      const rows = db.prepare(`SELECT * FROM ${safeTable} LIMIT 100`).all();
      const pragma = db.prepare(`PRAGMA table_info(${safeTable})`).all();
      db.close();
      const columns = pragma.map(p => ({ name: p.name, type: p.type || 'TEXT' }));
      return res.json({ success: true, columns, rows, total: rows.length });
    } catch (err) {
      logger.warn('[Database] Table read error:', err.message);
    }
  }

  // Fallback to mock store
  const store = getMockStore(projectId);
  const rows = store[tableName] || [];
  const columns = rows.length > 0
    ? Object.keys(rows[0]).map(k => ({ name: k, type: typeof rows[0][k] === 'number' ? 'NUMERIC' : 'TEXT' }))
    : [{ name: 'id', type: 'TEXT' }, { name: 'name', type: 'TEXT' }];

  res.json({ success: true, columns, rows, total: rows.length });
});

// ── POST /api/database/:projectId/table/:tableName/row ───────────────────────
router.post('/:projectId/table/:tableName/row', (req, res) => {
  const { projectId, tableName } = req.params;
  const rowData = req.body || {};
  const store = getMockStore(projectId);

  if (!store[tableName]) store[tableName] = [];
  const newRow = { id: String(Date.now()), ...rowData };
  store[tableName].unshift(newRow);

  res.json({ success: true, row: newRow });
});

// ── DELETE /api/database/:projectId/table/:tableName/row/:id ──────────────────
router.delete('/:projectId/table/:tableName/row/:id', (req, res) => {
  const { projectId, tableName, id } = req.params;
  const store = getMockStore(projectId);

  if (store[tableName]) {
    store[tableName] = store[tableName].filter(r => String(r.id) !== String(id));
  }

  res.json({ success: true });
});

// ── POST /api/database/:projectId/query ──────────────────────────────────────
router.post('/:projectId/query', (req, res) => {
  const { projectId } = req.params;
  const { sql } = req.body || {};
  if (!sql) return res.status(400).json({ success: false, error: 'SQL query required' });

  const dbPath = findSqliteDbFile(projectId);
  if (dbPath && Database) {
    try {
      const db = new Database(dbPath);
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA');
      if (isSelect) {
        const rows = db.prepare(sql).all();
        db.close();
        return res.json({ success: true, rows, count: rows.length });
      } else {
        const info = db.prepare(sql).run();
        db.close();
        return res.json({ success: true, changes: info.changes, count: info.changes });
      }
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // Mock query fallback
  const store = getMockStore(projectId);
  const words = sql.trim().toLowerCase().split(/\s+/);
  const targetTable = Object.keys(store).find(t => words.includes(t.toLowerCase())) || Object.keys(store)[0];
  const rows = store[targetTable] || [];

  res.json({
    success: true,
    message: 'Executed against live in-memory store',
    table: targetTable,
    rows: rows.slice(0, 50),
    count: rows.length
  });
});

// ==============================================================================
// Phase 4B: Database Schema Generation & Migration Automation Endpoints
// ==============================================================================

const {
  DatabaseSchemaPlan,
  DatabaseSchemaValidator,
  DatabaseSchemaGenerator,
  DatabaseMigrationManager,
  DatabaseSchemaResult
} = require('../agent/capabilities/databaseSchema');

// Helper to format structured error response
function sendStructuredError(res, status, code, message, details = {}, retryable = false) {
  return res.status(status).json({
    ok: false,
    success: false,
    error: {
      code,
      message,
      details,
      retryable
    }
  });
}

// ── POST /api/database/schema/generate ───────────────────────────────────────
router.post('/schema/generate', (req, res) => {
  try {
    const rawPlan = req.body?.plan || req.body;
    if (!rawPlan || typeof rawPlan !== 'object') {
      return sendStructuredError(res, 400, 'INVALID_SCHEMA_PLAN', 'Schema plan payload is required');
    }

    const planInstance = new DatabaseSchemaPlan(rawPlan);
    const plan = planInstance.toJSON();

    const validation = DatabaseSchemaValidator.validate(plan);
    if (!validation.valid) {
      return sendStructuredError(res, 400, 'SCHEMA_VALIDATION_FAILED', 'Schema validation failed', {
        errors: validation.errors
      });
    }

    const generator = new DatabaseSchemaGenerator(plan);
    const generated = generator.generateAll();

    return res.json({
      ok: true,
      success: true,
      data: {
        engine: plan.engine,
        databaseName: plan.databaseName,
        tables: plan.tables.map(t => t.name),
        schemaSql: generated.schemaSql,
        migrations: generated.migrations,
        seedSql: generated.seedSql,
        summary: generated.summary
      }
    });
  } catch (err) {
    logger.error('[Database] Schema generation error:', err);
    return sendStructuredError(res, 500, 'SCHEMA_GENERATION_FAILED', err.message);
  }
});

// ── POST /api/database/schema/validate ───────────────────────────────────────
router.post('/schema/validate', (req, res) => {
  try {
    const rawPlan = req.body?.plan || req.body;
    if (!rawPlan || typeof rawPlan !== 'object') {
      return sendStructuredError(res, 400, 'INVALID_SCHEMA_PLAN', 'Schema plan payload is required');
    }

    const validation = DatabaseSchemaValidator.validate(rawPlan);
    return res.json({
      ok: true,
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      destructiveDetected: validation.destructiveDetected
    });
  } catch (err) {
    logger.error('[Database] Schema validation error:', err);
    return sendStructuredError(res, 500, 'SCHEMA_VALIDATION_ERROR', err.message);
  }
});

// ── POST /api/database/migration/dry-run ─────────────────────────────────────
router.post('/migration/dry-run', (req, res) => {
  try {
    const rawPlan = req.body?.plan || req.body;
    if (!rawPlan) {
      return sendStructuredError(res, 400, 'INVALID_SCHEMA_PLAN', 'Schema plan payload is required');
    }

    const planInstance = new DatabaseSchemaPlan(rawPlan);
    const plan = planInstance.toJSON();

    const validation = DatabaseSchemaValidator.validate(plan);
    if (!validation.valid) {
      return sendStructuredError(res, 400, 'SCHEMA_VALIDATION_FAILED', 'Schema validation failed', {
        errors: validation.errors
      });
    }

    const generator = new DatabaseSchemaGenerator(plan);
    const generated = generator.generateAll();

    const manager = new DatabaseMigrationManager({
      engine: plan.engine,
      migrations: generated.migrations
    });

    const dryRunResult = manager.dryRun();
    return res.json({
      ok: dryRunResult.success,
      success: dryRunResult.success,
      data: dryRunResult
    });
  } catch (err) {
    logger.error('[Database] Migration dry-run error:', err);
    return sendStructuredError(res, 500, 'MIGRATION_DRYRUN_FAILED', err.message);
  }
});

// ── POST /api/database/migration/apply ───────────────────────────────────────
router.post('/migration/apply', async (req, res) => {
  try {
    const { plan: rawPlan, workspacePath, dbPath, projectId, approvalToken } = req.body || {};
    if (!rawPlan) {
      return sendStructuredError(res, 400, 'INVALID_SCHEMA_PLAN', 'Schema plan is required');
    }

    const planInstance = new DatabaseSchemaPlan(rawPlan);
    const plan = planInstance.toJSON();

    // Check destructive changes policy
    const validation = DatabaseSchemaValidator.validate(plan);
    if (validation.destructiveDetected && !approvalToken) {
      return res.status(403).json(
        DatabaseSchemaResult.approvalRequired(
          'Destructive database operation requires explicit user approval token',
          { engine: plan.engine, warnings: validation.warnings }
        ).toJSON()
      );
    }

    const targetDbPath = dbPath || (projectId ? findSqliteDbFile(projectId) : null) || ':memory:';

    const generator = new DatabaseSchemaGenerator(plan);
    const generated = generator.generateAll();

    const manager = new DatabaseMigrationManager({
      engine: plan.engine,
      dbPath: targetDbPath,
      workspacePath,
      migrations: generated.migrations
    });

    const applyResult = manager.apply();
    if (!applyResult.success) {
      return res.status(500).json({
        ok: false,
        success: false,
        error: {
          code: 'MIGRATION_APPLY_FAILED',
          message: applyResult.error,
          retryable: false
        }
      });
    }

    return res.json({
      ok: true,
      success: true,
      data: applyResult
    });
  } catch (err) {
    logger.error('[Database] Migration apply error:', err);
    return sendStructuredError(res, 500, 'MIGRATION_APPLY_ERROR', err.message);
  }
});

// ── POST /api/database/migration/rollback ────────────────────────────────────
router.post('/migration/rollback', (req, res) => {
  try {
    const { plan: rawPlan, targetVersion, steps, dbPath, projectId } = req.body || {};
    const targetDbPath = dbPath || (projectId ? findSqliteDbFile(projectId) : null) || ':memory:';

    const plan = rawPlan ? new DatabaseSchemaPlan(rawPlan).toJSON() : { engine: 'sqlite' };
    const generator = new DatabaseSchemaGenerator(plan);
    const generated = generator.generateAll();

    const manager = new DatabaseMigrationManager({
      engine: plan.engine,
      dbPath: targetDbPath,
      migrations: generated.migrations
    });

    const rollbackResult = manager.rollback({ targetVersion, steps });
    return res.json({
      ok: rollbackResult.success,
      success: rollbackResult.success,
      data: rollbackResult
    });
  } catch (err) {
    logger.error('[Database] Migration rollback error:', err);
    return sendStructuredError(res, 500, 'MIGRATION_ROLLBACK_ERROR', err.message);
  }
});

// ── GET /api/database/migration/history ──────────────────────────────────────
router.get('/migration/history', (req, res) => {
  try {
    const { projectId, dbPath } = req.query;
    const targetDbPath = dbPath || (projectId ? findSqliteDbFile(projectId) : null);

    if (!targetDbPath) {
      return res.json({ ok: true, success: true, migrations: [] });
    }

    const manager = new DatabaseMigrationManager({
      engine: 'sqlite',
      dbPath: targetDbPath
    });

    const history = manager.getHistory();
    return res.json({
      ok: true,
      success: true,
      migrations: history
    });
  } catch (err) {
    logger.error('[Database] Migration history error:', err);
    return sendStructuredError(res, 500, 'MIGRATION_HISTORY_ERROR', err.message);
  }
});

// ── GET /api/database/schema/drift ───────────────────────────────────────────
router.get('/schema/drift', (req, res) => {
  try {
    const { projectId, dbPath } = req.query;
    const targetDbPath = dbPath || (projectId ? findSqliteDbFile(projectId) : null);

    if (!targetDbPath) {
      return res.json({ ok: true, success: true, drift: [] });
    }

    const manager = new DatabaseMigrationManager({
      engine: 'sqlite',
      dbPath: targetDbPath
    });

    const drift = manager.detectDrift();
    return res.json({
      ok: true,
      success: true,
      drift
    });
  } catch (err) {
    logger.error('[Database] Schema drift check error:', err);
    return sendStructuredError(res, 500, 'SCHEMA_DRIFT_ERROR', err.message);
  }
});

module.exports = router;
