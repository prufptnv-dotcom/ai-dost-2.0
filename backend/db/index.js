const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const MigrationRunner = require('./migrationRunner');
const migration001 = require('./migrations/001_universal_schema');
const migration002 = require('./migrations/002_agent_runtime');
const migration003 = require('./migrations/003_agent_handoffs');
const migration004 = require('./migrations/004_agent_handoff_results');
const logger = require('../logger');

let dbInstance = null;

function initDatabase(customPath = null) {
  if (dbInstance) return dbInstance;

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = customPath || path.join(dataDir, 'app.db');
  dbInstance = new Database(dbPath);

  // Configure SQLite invariants
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');

  // Run versioned migrations
  const runner = new MigrationRunner(dbInstance);
  runner.runAll([
    migration001,
    { version: 2, name: '002_agent_runtime', up: migration002.up },
    migration003,
    migration004
  ]);

  // Run legacy data migrator (idempotent)
  const LegacyMigrator = require('./legacyMigrator');
  const migrator = new LegacyMigrator(dbInstance);
  migrator.migrateAll();

  // Run memory migrator
  const { migrateLegacyMemory } = require('./legacyMemoryMigrator');
  migrateLegacyMemory(dbInstance);

  return dbInstance;
}

function getDatabase() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};

