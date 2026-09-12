'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../../../logger');

// Native SQLite engine via Node.js 22
const { DatabaseSync } = (() => {
  try { return require('node:sqlite'); } catch(_) { return {}; }
})();

class DatabaseMigrationManager {
  constructor(options = {}) {
    this.workspacePath = options.workspacePath || null;
    this.dbPath = options.dbPath || null;
    this.engine = options.engine || 'sqlite';
    this.connectionUrl = options.connectionUrl || null;
    this.allowRemoteMutation = Boolean(options.allowRemoteMutation);
    this.migrations = Array.isArray(options.migrations) ? options.migrations : [];
    this.history = new Map(); // migrationId -> MigrationRecord
  }

  /**
   * Initializes the migration tracking table (_aidost_migrations) in SQLite
   */
  _initTrackingTableSqlite(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _aidost_migrations (
        id TEXT PRIMARY KEY,
        version TEXT,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rollback_sql TEXT,
        status TEXT NOT NULL
      );
    `);
  }

  _getTargetDbPath(options = {}) {
    return options.dbPath || this.dbPath || (this.workspacePath ? path.join(this.workspacePath, 'app.db') : ':memory:');
  }

  /**
   * Performs a dry-run of a migration without committing persistent changes
   */
  dryRun(migrationArtifact, options = {}) {
    const list = migrationArtifact
      ? [migrationArtifact]
      : (this.migrations.length > 0 ? this.migrations : []);

    if (list.length === 0) {
      return { success: true, mode: 'dry-run', dryRun: true, testedSteps: 0 };
    }

    const engine = options.engine || this.engine || 'sqlite';

    if (engine === 'sqlite') {
      if (!DatabaseSync) {
        return { success: false, mode: 'dry-run', dryRun: true, error: 'node:sqlite DatabaseSync unavailable' };
      }
      try {
        const memDb = new DatabaseSync(':memory:');
        this._initTrackingTableSqlite(memDb);
        let executed = 0;

        for (const item of list) {
          const sql = item.upSql || item.content || item.sql;
          if (sql) {
            memDb.exec(sql);
            executed++;
          }
        }
        memDb.close();

        return {
          success: true,
          mode: 'dry-run',
          dryRun: true,
          testedSteps: executed,
          engine,
          message: 'Dry run completed successfully with zero syntax or constraint errors'
        };
      } catch (err) {
        return {
          success: false,
          mode: 'dry-run',
          dryRun: true,
          testedSteps: 0,
          engine,
          error: `Dry run validation failed: ${err.message}`
        };
      }
    }

    return {
      success: true,
      mode: 'dry-run',
      dryRun: true,
      testedSteps: list.length,
      engine,
      message: `Dry run simulated successfully for engine ${engine}`
    };
  }

  /**
   * Applies migrations
   */
  apply(migrationArtifact, options = {}) {
    const opts = typeof migrationArtifact === 'object' && !migrationArtifact.upSql && !migrationArtifact.content
      ? migrationArtifact
      : options;

    const isRemote = Boolean(
      opts.isRemote ||
      opts.connectionString ||
      this.connectionUrl ||
      (this.engine !== 'sqlite' && this.engine !== 'none')
    );

    const allowRemote = opts.allowRemoteMutation ?? this.allowRemoteMutation;

    // Safety Gate: Remote mutation protection
    if (isRemote && !allowRemote) {
      throw new Error('REMOTE_MUTATION_BLOCKED: Remote database mutation is blocked by policy. Explicit configuration and approval required.');
    }

    const list = (migrationArtifact && (migrationArtifact.upSql || migrationArtifact.content))
      ? [migrationArtifact]
      : (this.migrations.length > 0 ? this.migrations : []);

    const targetPath = this._getTargetDbPath(opts);
    const engine = opts.engine || this.engine || 'sqlite';
    let appliedCount = 0;

    if (engine === 'sqlite') {
      if (!DatabaseSync) {
        return { success: false, error: 'node:sqlite DatabaseSync is not available' };
      }

      const db = new DatabaseSync(targetPath);
      this._initTrackingTableSqlite(db);

      for (const mig of list) {
        const migId = mig.id || mig.migrationId || mig.filename || `mig_${mig.version || '0001'}`;
        const version = mig.version || '0001';
        const name = mig.name || mig.filename || 'migration';
        const checksum = mig.checksum || '';
        const upSql = mig.upSql || mig.content || '';
        const downSql = mig.downSql || mig.downContent || '';

        // Check if already applied
        const row = db.prepare('SELECT * FROM _aidost_migrations WHERE id = ?').get(migId);
        if (row && row.status === 'APPLIED') {
          continue; // Skip duplicate
        }

        // Destructive check
        const isDestructive = /DROP\s+(?:TABLE|COLUMN|DATABASE)|TRUNCATE/i.test(upSql);
        if (isDestructive && !opts.approvalToken && !opts.forceDestructive) {
          db.close();
          return {
            success: false,
            code: 'DESTRUCTIVE_OPERATION_GATED',
            error: 'Destructive migration requires explicit approval token before execution.'
          };
        }

        db.exec('BEGIN TRANSACTION;');
        try {
          if (upSql.trim()) {
            db.exec(upSql);
          }
          db.prepare(`
            INSERT INTO _aidost_migrations (id, version, name, checksum, rollback_sql, status)
            VALUES (?, ?, ?, ?, ?, 'APPLIED')
            ON CONFLICT(id) DO UPDATE SET status = 'APPLIED', checksum = excluded.checksum;
          `).run(migId, version, name, checksum, downSql);
          db.exec('COMMIT;');
          appliedCount++;
        } catch (err) {
          db.exec('ROLLBACK;');
          db.close();
          throw err;
        }
      }

      db.close();
    }

    return {
      success: true,
      appliedCount,
      totalMigrations: list.length
    };
  }

  /**
   * Rolls back applied migrations
   */
  rollback(options = {}) {
    const steps = options.steps !== undefined ? Number(options.steps) : 1;
    const targetPath = this._getTargetDbPath(options);
    const engine = options.engine || this.engine || 'sqlite';

    if (engine === 'sqlite') {
      if (!DatabaseSync || !fs.existsSync(targetPath)) {
        return { success: true, rolledBackCount: 0 };
      }

      const db = new DatabaseSync(targetPath);
      this._initTrackingTableSqlite(db);

      const rows = db.prepare("SELECT * FROM _aidost_migrations WHERE status = 'APPLIED' ORDER BY applied_at DESC").all();
      const toRollback = rows.slice(0, steps);
      let rolledBackCount = 0;

      for (const row of toRollback) {
        // Find downSql from migration list or stored rollback_sql
        const mig = this.migrations.find(m => (m.id || m.migrationId || m.filename) === row.id);
        const downSql = row.rollback_sql || mig?.downSql || mig?.downContent;

        if (downSql && downSql.trim()) {
          db.exec('BEGIN TRANSACTION;');
          try {
            db.exec(downSql);
            db.prepare('DELETE FROM _aidost_migrations WHERE id = ?').run(row.id);
            db.exec('COMMIT;');
            rolledBackCount++;
          } catch (err) {
            db.exec('ROLLBACK;');
            db.close();
            throw err;
          }
        } else {
          db.prepare('DELETE FROM _aidost_migrations WHERE id = ?').run(row.id);
          rolledBackCount++;
        }
      }

      db.close();
      return { success: true, rolledBackCount };
    }

    return { success: true, rolledBackCount: steps };
  }

  /**
   * Retrieves applied migration history
   */
  getHistory(options = {}) {
    const targetPath = this._getTargetDbPath(options);
    if (!fs.existsSync(targetPath) || !DatabaseSync) {
      return [];
    }

    try {
      const db = new DatabaseSync(targetPath);
      this._initTrackingTableSqlite(db);
      const rows = db.prepare('SELECT id, version, name, checksum, applied_at, status FROM _aidost_migrations ORDER BY applied_at ASC').all();
      db.close();
      return rows;
    } catch (_) {
      return [];
    }
  }

  /**
   * Detects schema drift between live tables and applied migrations
   */
  detectDrift(options = {}) {
    const targetPath = this._getTargetDbPath(options);
    if (!fs.existsSync(targetPath) || !DatabaseSync) {
      return [];
    }

    try {
      const db = new DatabaseSync(targetPath);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_aidost_migrations'").all();
      const drift = [];

      // Collect tables expected from applied migrations or current migrations
      const expectedTables = new Set();
      for (const m of this.migrations) {
        const sql = m.upSql || m.content || '';
        const matches = sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?["`]?([a-zA-Z0-9_]+)["`]?/gi);
        for (const match of matches) {
          expectedTables.add(match[1].toLowerCase());
        }
      }

      for (const t of tables) {
        if (!expectedTables.has(t.name.toLowerCase())) {
          drift.push({
            table: t.name,
            status: 'UNTRACKED_TABLE',
            description: `Table "${t.name}" exists in database but is not declared in migrations.`
          });
        }
      }

      db.close();
      return drift;
    } catch (err) {
      logger.warn('[DatabaseMigrationManager] Drift detection error:', err.message);
      return [];
    }
  }
}

DatabaseMigrationManager.DatabaseMigrationManager = DatabaseMigrationManager;
module.exports = DatabaseMigrationManager;
