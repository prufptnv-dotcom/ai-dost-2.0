const { DatabaseSync: Database } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const MigrationRunner = require('./migrationRunner');
const migration001 = require('./migrations/001_universal_schema');
const migration002 = require('./migrations/002_agent_runtime');
const migration003 = require('./migrations/003_agent_handoffs');
const migration004 = require('./migrations/004_agent_handoff_results');
const migration005 = require('./migrations/005_workflows_schema');
const migration006 = require('./migrations/006_skills_schema');
const migration007 = require('./migrations/007_performance_indexes');
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

  // Polyfill for better-sqlite3 db.transaction()
  if (typeof dbInstance.transaction !== 'function') {
    dbInstance.transaction = function(fn) {
      return function(...args) {
        dbInstance.exec('BEGIN');
        try {
          const result = fn(...args);
          dbInstance.exec('COMMIT');
          return result;
        } catch (e) {
          dbInstance.exec('ROLLBACK');
          throw e;
        }
      };
    };
  }

  // Configure SQLite invariants
  dbInstance.exec('PRAGMA journal_mode = WAL');
  dbInstance.exec('PRAGMA synchronous = NORMAL');
  dbInstance.exec('PRAGMA foreign_keys = ON');
  dbInstance.exec('PRAGMA busy_timeout = 5000');

  // Run versioned migrations
  const runner = new MigrationRunner(dbInstance);
  runner.runAll([
    migration001,
    { version: 2, name: '002_agent_runtime', up: migration002.up },
    migration003,
    migration004,
    migration005,
    { version: 6, name: '006_skills_schema', up: migration006.up },
    migration007
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
    try { dbInstance.close(); } catch(e){}
    dbInstance = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};

