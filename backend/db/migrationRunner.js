const logger = require('../logger');

class MigrationRunner {
  constructor(db) {
    this.db = db;
  }

  ensureMigrationTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  getAppliedVersions() {
    this.ensureMigrationTable();
    const rows = this.db.prepare('SELECT version FROM _schema_migrations ORDER BY version ASC').all();
    return new Set(rows.map(r => r.version));
  }

  applyMigration(version, name, migrationFn) {
    this.ensureMigrationTable();
    const applied = this.getAppliedVersions();
    if (applied.has(version)) {
      return false; // already applied
    }

    logger.info(`[Database] Applying migration ${version}: ${name}...`);
    const runInTx = this.db.transaction(() => {
      migrationFn(this.db);
      this.db.prepare('INSERT INTO _schema_migrations (version, name) VALUES (?, ?)').run(version, name);
    });

    runInTx();
    logger.info(`[Database] Successfully applied migration ${version}: ${name}`);
    return true;
  }

  runAll(migrations = []) {
    this.ensureMigrationTable();
    let appliedCount = 0;
    const sorted = [...migrations].sort((a, b) => a.version - b.version);
    for (const m of sorted) {
      const didApply = this.applyMigration(m.version, m.name, m.up);
      if (didApply) appliedCount++;
    }
    return appliedCount;
  }
}

module.exports = MigrationRunner;
