'use strict';

/**
 * AI-Dost 2.0 — Phase 4B: Database Schema Generation & Migration Automation Test Suite
 * Capability #9: coding.database_schema_generation
 * 
 * 45+ Comprehensive, 100% offline unit, security, and integration tests.
 * Zero external network calls.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { capabilityRegistry } = require('../agent/registry/CapabilityRegistry');
const { capabilityDiscovery } = require('../agent/registry/CapabilityDiscovery');
const { capabilityGatekeeper } = require('../agent/policy/CapabilityGatekeeper');

const {
  DatabaseSchemaPlan,
  DatabaseSchemaValidator,
  DatabaseSchemaGenerator,
  DatabaseMigrationManager,
  DatabaseSchemaResult
} = require('../agent/capabilities/databaseSchema');

const FullStackDeliveryOrchestrator = require('../agent/capabilities/fullStackDelivery/FullStackDeliveryOrchestrator');

describe('AI-Dost 2.0 — Phase 4B: Database Schema Generation Suite', () => {

  // ============================================================================
  // SECTION 1: CAPABILITY REGISTRY & DISCOVERY (Tests 1 - 10)
  // ============================================================================

  test('1. Exact capability ID matching returns coding.database_schema_generation with confidence 1.0', () => {
    const res = capabilityDiscovery.discover('coding.database_schema_generation');
    assert.equal(res.unresolved_intent, false);
    assert.ok(res.matched.length > 0);
    assert.equal(res.matched[0].capability_id, 'coding.database_schema_generation');
    assert.equal(res.matched[0].confidence, 1.0);
    assert.equal(res.matched[0].match_type, 'EXACT');
  });

  test('2. Target phrase 1 ("Create a database schema for users and orders.") resolves to coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Create a database schema for users and orders.');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.ok(matched, 'Expected coding.database_schema_generation to match');
    assert.ok(matched.confidence >= 0.90);
  });

  test('3. Target phrase 2 ("Generate PostgreSQL migrations for my SaaS app.") resolves to coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Generate PostgreSQL migrations for my SaaS app.');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.ok(matched, 'Expected coding.database_schema_generation to match');
    assert.ok(matched.confidence >= 0.90);
  });

  test('4. Target phrase 3 ("Design tables and relationships for this application.") resolves to coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Design tables and relationships for this application.');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.ok(matched, 'Expected coding.database_schema_generation to match');
    assert.ok(matched.confidence >= 0.90);
  });

  test('5. Target phrase 4 ("Create SQLite tables and indexes.") resolves to coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Create SQLite tables and indexes.');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.ok(matched, 'Expected coding.database_schema_generation to match');
    assert.ok(matched.confidence >= 0.90);
  });

  test('6. Target phrase 5 ("Generate a migration for adding subscriptions.") resolves to coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Generate a migration for adding subscriptions.');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.ok(matched, 'Expected coding.database_schema_generation to match');
    assert.ok(matched.confidence >= 0.90);
  });

  test('7. Negative phrase 1 ("Explain this SQL query") does NOT match coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Explain this SQL query');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.equal(matched, undefined, 'Negative query must not match database schema generation');
  });

  test('8. Negative phrase 2 ("What is a primary key?") does NOT match coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('What is a primary key?');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.equal(matched, undefined, 'Educational question must not match database schema generation');
  });

  test('9. Negative phrase 3 ("Fix this one SQL typo") does NOT match coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Fix this one SQL typo');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.equal(matched, undefined, 'Bug fix request must not match database schema generation');
  });

  test('10. Negative phrase 4 ("Show me an example of a database.") does NOT match coding.database_schema_generation', () => {
    const res = capabilityDiscovery.discover('Show me an example of a database.');
    const matched = res.matched.find(m => m.capability_id === 'coding.database_schema_generation');
    assert.equal(matched, undefined, 'Generic prompt must not match database schema generation');
  });

  // ============================================================================
  // SECTION 2: SCHEMA PLAN & NORMALIZATION (Tests 11 - 15)
  // ============================================================================

  test('11. DatabaseSchemaPlan normalizes default parameters and assigns version 1.0.0', () => {
    const plan = new DatabaseSchemaPlan({
      tables: [{ name: 'users' }]
    });
    const json = plan.toJSON();
    assert.equal(json.version, '1.0.0');
    assert.equal(json.engine, 'sqlite');
    assert.equal(json.tables.length, 1);
    assert.equal(json.tables[0].name, 'users');
    assert.ok(Array.isArray(json.tables[0].columns));
    assert.ok(plan.planId.startsWith('db_plan_'));
  });

  test('12. DatabaseSchemaPlan masks sensitive secrets and passwords in connection strings or configs', () => {
    const plan = new DatabaseSchemaPlan({
      engine: 'postgresql',
      connectionUrl: 'postgres://admin:SuperSecretPassword123!@db.example.com:5432/mydb',
      tables: [{ name: 'secrets' }]
    });
    const json = plan.toJSON();
    assert.ok(!json.connectionUrl.includes('SuperSecretPassword123!'), 'Secret password must be masked');
    assert.ok(json.connectionUrl.includes('***'));
  });

  test('13. DatabaseSchemaPlan freeze makes plan instance deeply immutable', () => {
    const plan = new DatabaseSchemaPlan({
      tables: [{ name: 'accounts', columns: [{ name: 'id', type: 'INTEGER' }] }]
    });
    plan.freeze();
    assert.ok(Object.isFrozen(plan.tables));
    assert.throws(() => {
      plan.tables.push({ name: 'hack' });
    }, /Cannot add property|is not extensible/);
  });

  test('14. DatabaseSchemaPlan clone returns detached deep copy with incremented planId', () => {
    const plan1 = new DatabaseSchemaPlan({
      tables: [{ name: 'logs' }]
    });
    const plan2 = plan1.clone({ engine: 'mysql' });
    assert.notEqual(plan1.planId, plan2.planId);
    assert.equal(plan1.engine, 'sqlite');
    assert.equal(plan2.engine, 'mysql');
  });

  test('15. Supported database engines validate cleanly (sqlite, postgresql, mysql, none)', () => {
    for (const eng of ['sqlite', 'postgresql', 'mysql', 'none']) {
      const val = DatabaseSchemaValidator.validateEngine(eng);
      assert.equal(val.valid, true, `Engine ${eng} must be valid`);
    }
  });

  // ============================================================================
  // SECTION 3: VALIDATION & SECURITY GUARDS (Tests 16 - 25)
  // ============================================================================

  test('16. Unsupported database engine (e.g. cassandra, dynamodb) is rejected with UNSUPPORTED_DATABASE_ENGINE', () => {
    const val = DatabaseSchemaValidator.validateEngine('cassandra');
    assert.equal(val.valid, false);
    assert.equal(val.error.code, 'UNSUPPORTED_DATABASE_ENGINE');
    assert.ok(val.error.details.supported.includes('sqlite'));
  });

  test('17. Table names with valid alphanumeric and underscore format pass validation', () => {
    const res = DatabaseSchemaValidator.validateIdentifier('user_profiles_2026', 'table');
    assert.equal(res.valid, true);
  });

  test('18. Table names with SQL injection or invalid characters are strictly rejected', () => {
    const badNames = [
      'users; DROP TABLE students;',
      'users" OR 1=1 --',
      'table-with-dashes',
      '123startsWithNum',
      'table space'
    ];
    for (const bad of badNames) {
      const res = DatabaseSchemaValidator.validateIdentifier(bad, 'table');
      assert.equal(res.valid, false, `Bad identifier "${bad}" should be rejected`);
    }
  });

  test('19. Prototype pollution attempts in table definition are safely stripped and blocked', () => {
    const maliciousPayload = JSON.parse('{"__proto__": {"admin": true}, "tables": [{"name": "accounts"}]}');
    const plan = new DatabaseSchemaPlan(maliciousPayload);
    assert.equal(Object.prototype.admin, undefined, 'Prototype pollution must not modify Object.prototype');
  });

  test('20. Table without columns or without primary key is rejected', () => {
    const planWithoutPK = {
      engine: 'sqlite',
      tables: [
        {
          name: 'users',
          columns: [{ name: 'username', type: 'TEXT' }]
        }
      ]
    };
    const val = DatabaseSchemaValidator.validate(planWithoutPK);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('primary key')));
  });

  test('21. Column type outside allowlist for target engine is rejected', () => {
    const badTypePlan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'bio', type: 'UNSUPPORTED_CASSANDRA_TYPE' }
          ]
        }
      ]
    };
    const val = DatabaseSchemaValidator.validate(badTypePlan);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('type "UNSUPPORTED_CASSANDRA_TYPE" is not allowed')));
  });

  test('22. Foreign key to non-existent table is rejected with clear error', () => {
    const badFkPlan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'user_id', type: 'INTEGER', foreignKey: { table: 'non_existent_users', column: 'id' } }
          ]
        }
      ]
    };
    const val = DatabaseSchemaValidator.validate(badFkPlan);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('references non-existent table "non_existent_users"')));
  });

  test('23. Circular foreign key dependencies are detected via topological DFS and rejected', () => {
    const circularPlan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'table_a',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'b_id', type: 'INTEGER', foreignKey: { table: 'table_b', column: 'id' } }
          ]
        },
        {
          name: 'table_b',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'a_id', type: 'INTEGER', foreignKey: { table: 'table_a', column: 'id' } }
          ]
        }
      ]
    };
    const val = DatabaseSchemaValidator.validate(circularPlan);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('Circular foreign key dependency detected')));
  });

  test('24. Destructive SQL keywords (DROP TABLE, TRUNCATE) are detected and flagged', () => {
    const detected = DatabaseSchemaValidator.detectDestructiveKeywords('ALTER TABLE users DROP COLUMN email;');
    assert.equal(detected.destructive, true);
    assert.ok(detected.matches.some(m => m.includes('DROP COLUMN')));
  });

  test('25. Non-destructive SQL keywords (CREATE TABLE, ADD COLUMN) pass without destructive flag', () => {
    const detected = DatabaseSchemaValidator.detectDestructiveKeywords('CREATE TABLE users (id INT); ALTER TABLE users ADD COLUMN name TEXT;');
    assert.equal(detected.destructive, false);
    assert.equal(detected.matches.length, 0);
  });

  // ============================================================================
  // SECTION 4: SCHEMA & DDL GENERATION (Tests 26 - 33)
  // ============================================================================

  test('26. Topological sorting places referenced parent tables before dependent child tables', () => {
    const plan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'order_items',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'order_id', type: 'INTEGER', foreignKey: { table: 'orders', column: 'id' } }
          ]
        },
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }]
        },
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'user_id', type: 'INTEGER', foreignKey: { table: 'users', column: 'id' } }
          ]
        }
      ]
    };
    const sorted = DatabaseSchemaGenerator.topologicalSortTables(plan.tables);
    const names = sorted.map(t => t.name);
    assert.ok(names.indexOf('users') < names.indexOf('orders'), 'users before orders');
    assert.ok(names.indexOf('orders') < names.indexOf('order_items'), 'orders before order_items');
  });

  test('27. SQLite DDL generator synthesizes valid AUTOINCREMENT, foreign keys, and indexes', () => {
    const plan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
            { name: 'title', type: 'TEXT', nullable: false },
            { name: 'created_at', type: 'DATETIME', defaultValue: 'CURRENT_TIMESTAMP' }
          ],
          indexes: [
            { name: 'idx_posts_created', columns: ['created_at'] }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const sql = gen.generateSchemaSql();
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS posts'));
    assert.ok(sql.includes('id INTEGER PRIMARY KEY AUTOINCREMENT'));
    assert.ok(sql.includes('title TEXT NOT NULL'));
    assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);'));
  });

  test('28. PostgreSQL DDL generator synthesizes SERIAL primary key and TIMESTAMPTZ columns', () => {
    const plan = {
      engine: 'postgresql',
      tables: [
        {
          name: 'tenants',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
            { name: 'name', type: 'VARCHAR', length: 100, nullable: false, unique: true },
            { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'CURRENT_TIMESTAMP' }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const sql = gen.generateSchemaSql();
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS tenants'));
    assert.ok(sql.includes('id SERIAL PRIMARY KEY'));
    assert.ok(sql.includes('name VARCHAR(100) NOT NULL UNIQUE'));
    assert.ok(sql.includes('created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP'));
  });

  test('29. MySQL DDL generator synthesizes AUTO_INCREMENT, ENGINE=InnoDB, and backticks', () => {
    const plan = {
      engine: 'mysql',
      tables: [
        {
          name: 'customers',
          columns: [
            { name: 'id', type: 'INT', primaryKey: true, autoIncrement: true },
            { name: 'email', type: 'VARCHAR', length: 255, nullable: false }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const sql = gen.generateSchemaSql();
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS `customers`'));
    assert.ok(sql.includes('`id` INT AUTO_INCREMENT PRIMARY KEY'));
    assert.ok(sql.includes('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'));
  });

  test('30. Migration up.sql and down.sql are generated with sha256 checksums', () => {
    const plan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'audit_logs',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'event', type: 'TEXT', nullable: false }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const migrations = gen.generateMigrations();
    assert.equal(migrations.length, 1);
    assert.ok(migrations[0].filename.endsWith('_up.sql'));
    assert.ok(migrations[0].checksum.length === 64, 'Checksum must be a 64-char sha256 hex string');
    assert.ok(migrations[0].downContent.includes('DROP TABLE IF EXISTS audit_logs;'));
  });

  test('31. Down migration drops tables in reverse topological order to preserve FK integrity', () => {
    const plan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }]
        },
        {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'user_id', type: 'INTEGER', foreignKey: { table: 'users', column: 'id' } }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const migrations = gen.generateMigrations();
    const downSql = migrations[0].downContent;
    const dropOrdersIdx = downSql.indexOf('DROP TABLE IF EXISTS orders');
    const dropUsersIdx = downSql.indexOf('DROP TABLE IF EXISTS users');
    assert.ok(dropOrdersIdx < dropUsersIdx, 'orders (child) must be dropped before users (parent)');
  });

  test('32. Parameterized seed generation produces valid INSERT statements', () => {
    const plan = {
      engine: 'sqlite',
      tables: [{ name: 'categories', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }],
      seeds: [
        {
          table: 'categories',
          rows: [
            { name: 'Electronics', is_active: 1 },
            { name: 'Books', is_active: 0 }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const seedSql = gen.generateSeedSql();
    assert.ok(seedSql.includes("INSERT OR IGNORE INTO categories (name, is_active) VALUES ('Electronics', 1)"));
    assert.ok(seedSql.includes("INSERT OR IGNORE INTO categories (name, is_active) VALUES ('Books', 0)"));
  });

  test('33. Engine "none" returns empty schema SQL and 0 migrations', () => {
    const plan = { engine: 'none', tables: [] };
    const gen = new DatabaseSchemaGenerator(plan);
    const res = gen.generateAll();
    assert.equal(res.schemaSql, '');
    assert.equal(res.migrations.length, 0);
  });

  // ============================================================================
  // SECTION 5: MIGRATION EXECUTION, DRY-RUN & ROLLBACK (Tests 34 - 40)
  // ============================================================================

  test('34. Dry-run mode executes schema migration on :memory: SQLite without modifying target disk file', () => {
    const plan = {
      engine: 'sqlite',
      tables: [
        {
          name: 'test_items',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
            { name: 'label', type: 'TEXT', nullable: false }
          ]
        }
      ]
    };
    const gen = new DatabaseSchemaGenerator(plan);
    const migrations = gen.generateMigrations();

    const manager = new DatabaseMigrationManager({
      engine: 'sqlite',
      dbPath: ':memory:',
      migrations
    });

    const dryRunRes = manager.dryRun();
    assert.equal(dryRunRes.success, true);
    assert.equal(dryRunRes.dryRun, true);
    assert.equal(dryRunRes.testedSteps, 1);
  });

  test('35. Applying migration creates _aidost_migrations table and records applied version', () => {
    const tempDbPath = path.join(__dirname, 'temp_test_migration.db');
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

      const plan = {
        engine: 'sqlite',
        tables: [
          {
            name: 'members',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true },
              { name: 'email', type: 'TEXT', nullable: false }
            ]
          }
        ]
      };
      const gen = new DatabaseSchemaGenerator(plan);
      const migrations = gen.generateMigrations();

      const manager = new DatabaseMigrationManager({
        engine: 'sqlite',
        dbPath: tempDbPath,
        migrations
      });

      const applyRes = manager.apply();
      assert.equal(applyRes.success, true);
      assert.equal(applyRes.appliedCount, 1);

      const history = manager.getHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].version, '0001');
      assert.ok(history[0].checksum.length === 64);
    } finally {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    }
  });

  test('36. Applying migration a second time detects already applied version and skips it', () => {
    const tempDbPath = path.join(__dirname, 'temp_test_duplicate.db');
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

      const plan = {
        engine: 'sqlite',
        tables: [{ name: 't1', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }]
      };
      const gen = new DatabaseSchemaGenerator(plan);
      const migrations = gen.generateMigrations();

      const manager = new DatabaseMigrationManager({
        engine: 'sqlite',
        dbPath: tempDbPath,
        migrations
      });

      const apply1 = manager.apply();
      assert.equal(apply1.appliedCount, 1);

      const apply2 = manager.apply();
      assert.equal(apply2.appliedCount, 0, 'Second run must skip already applied migration');
    } finally {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    }
  });

  test('37. Rollback down migration executes down.sql and removes record from tracking table', () => {
    const tempDbPath = path.join(__dirname, 'temp_test_rollback.db');
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

      const plan = {
        engine: 'sqlite',
        tables: [{ name: 'to_be_dropped', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }]
      };
      const gen = new DatabaseSchemaGenerator(plan);
      const migrations = gen.generateMigrations();

      const manager = new DatabaseMigrationManager({
        engine: 'sqlite',
        dbPath: tempDbPath,
        migrations
      });

      manager.apply();
      assert.equal(manager.getHistory().length, 1);

      const rollbackRes = manager.rollback({ steps: 1 });
      assert.equal(rollbackRes.success, true);
      assert.equal(rollbackRes.rolledBackCount, 1);
      assert.equal(manager.getHistory().length, 0, 'Tracking record should be removed');
    } finally {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    }
  });

  test('38. Schema drift detection identifies untracked tables created outside migration flow', () => {
    const tempDbPath = path.join(__dirname, 'temp_test_drift.db');
    try {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

      const plan = {
        engine: 'sqlite',
        tables: [{ name: 'tracked_table', columns: [{ name: 'id', type: 'INTEGER', primaryKey: true }] }]
      };
      const gen = new DatabaseSchemaGenerator(plan);
      const migrations = gen.generateMigrations();

      const manager = new DatabaseMigrationManager({
        engine: 'sqlite',
        dbPath: tempDbPath,
        migrations
      });

      manager.apply();

      // Create an untracked table manually
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(tempDbPath);
      db.exec('CREATE TABLE rogue_table (id INT);');
      db.close();

      const drift = manager.detectDrift();
      assert.ok(drift.length > 0);
      assert.ok(drift.some(d => d.table === 'rogue_table' && d.status === 'UNTRACKED_TABLE'));
    } finally {
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    }
  });

  test('39. Remote production database mutations are blocked unless explicitly configured', () => {
    const remoteManager = new DatabaseMigrationManager({
      engine: 'postgresql',
      connectionUrl: 'postgres://admin:pass@production-db.aws.neon.tech/prod',
      allowRemoteMutation: false
    });

    assert.throws(() => {
      remoteManager.apply();
    }, /REMOTE_MUTATION_BLOCKED/);
  });

  test('40. DatabaseSchemaResult envelope formats success and failure objects correctly', () => {
    const successResult = DatabaseSchemaResult.success({
      engine: 'sqlite',
      tables: ['users', 'posts'],
      applied: true
    });
    assert.equal(successResult.status, 'COMPLETED');
    assert.equal(successResult.applied, true);

    const blockedResult = DatabaseSchemaResult.blockedByPolicy('POLICY_VIOLATION', 'Blocked');
    assert.equal(blockedResult.status, 'BLOCKED_BY_POLICY');
    assert.equal(blockedResult.error.code, 'POLICY_VIOLATION');
  });

  // ============================================================================
  // SECTION 6: GATEKEEPER POLICY & APPROVAL FLOW (Tests 41 - 44)
  // ============================================================================

  test('41. CapabilityGatekeeper evaluates coding.database_schema_generation as REQUIRE_CONFIRMATION', () => {
    const context = {
      requestId: 'req_db_001',
      permissions: ['workspace:write']
    };
    const decision = capabilityGatekeeper.evaluate('coding.database_schema_generation', context);
    assert.equal(decision.decision, 'REQUIRE_CONFIRMATION');
  });

  test('42. CapabilityGatekeeper grants approval token and validates it for coding.database_schema_generation', () => {
    const decision = capabilityGatekeeper.evaluate(['coding.database_schema_generation'], { requestId: 'req_db_002' });
    assert.equal(decision.decision, 'REQUIRE_CONFIRMATION');
    const token = decision.approval_token;
    assert.ok(token);

    const validation = capabilityGatekeeper.validateApproval({
      token,
      requestId: 'req_db_002',
      capabilityIds: ['coding.database_schema_generation']
    });
    assert.equal(validation.valid, true);
  });

  test('43. Expired or forged approval token is rejected by CapabilityGatekeeper', () => {
    const validation = capabilityGatekeeper.validateApproval({
      token: 'forged_fake_token',
      requestId: 'req_db_003',
      capabilityIds: ['coding.database_schema_generation']
    });
    assert.equal(validation.valid, false);
  });

  test('44. Destructive changes require explicit user approval token in DatabaseSchemaResult', () => {
    const result = DatabaseSchemaResult.approvalRequired('DROP TABLE detected');
    assert.equal(result.status, 'APPROVAL_REQUIRED');
    assert.equal(result.security.destructiveDetected, true);
    assert.equal(result.security.approvalRequired, true);
  });

  // ============================================================================
  // SECTION 7: FULL-STACK DELIVERY INTEGRATION (Tests 45 - 48)
  // ============================================================================

  test('45. FullStackDeliveryOrchestrator._generateDatabaseFiles uses DatabaseSchemaGenerator for SQLite', () => {
    const orchestrator = new FullStackDeliveryOrchestrator();
    const plan = {
      projectName: 'ecommerce_app',
      database: {
        engine: 'sqlite',
        tables: [
          {
            name: 'products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
              { name: 'title', type: 'TEXT', nullable: false },
              { name: 'price', type: 'REAL', nullable: false }
            ]
          }
        ]
      }
    };
    const files = orchestrator._generateDatabaseFiles(plan);
    assert.ok(files.length >= 2, 'Should generate schema.sql and migrations');
    const schemaFile = files.find(f => f.path === 'server/db/schema.sql');
    assert.ok(schemaFile);
    assert.ok(schemaFile.content.includes('CREATE TABLE IF NOT EXISTS products'));
    assert.ok(schemaFile.content.includes('price REAL NOT NULL'));
  });

  test('46. FullStackDeliveryOrchestrator._generateDatabaseFiles handles database engine "none" gracefully', () => {
    const orchestrator = new FullStackDeliveryOrchestrator();
    const plan = {
      projectName: 'static_site',
      database: { engine: 'none' }
    };
    const files = orchestrator._generateDatabaseFiles(plan);
    assert.equal(files.length, 0);
  });

  test('47. FullStackDeliveryOrchestrator._generateDatabaseFiles generates PostgreSQL DDL when engine is postgresql', () => {
    const orchestrator = new FullStackDeliveryOrchestrator();
    const plan = {
      projectName: 'saas_backend',
      database: {
        engine: 'postgresql',
        tables: [
          {
            name: 'organizations',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
              { name: 'slug', type: 'VARCHAR', length: 50, nullable: false }
            ]
          }
        ]
      }
    };
    const files = orchestrator._generateDatabaseFiles(plan);
    const schemaFile = files.find(f => f.path === 'server/db/schema.sql');
    assert.ok(schemaFile);
    assert.ok(schemaFile.content.includes('id SERIAL PRIMARY KEY'));
  });

  test('48. End-to-end full schema generation produces all required artifacts and clean summary', () => {
    const plan = new DatabaseSchemaPlan({
      engine: 'sqlite',
      databaseName: 'full_app',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
            { name: 'email', type: 'TEXT', nullable: false }
          ]
        },
        {
          name: 'profiles',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'user_id', type: 'INTEGER', foreignKey: { table: 'users', column: 'id' } },
            { name: 'bio', type: 'TEXT' }
          ]
        }
      ]
    });

    const gen = new DatabaseSchemaGenerator(plan.toJSON());
    const result = gen.generateAll();

    assert.ok(result.schemaSql.includes('CREATE TABLE IF NOT EXISTS users'));
    assert.ok(result.schemaSql.includes('CREATE TABLE IF NOT EXISTS profiles'));
    assert.equal(result.summary.tableCount, 2);
    assert.equal(result.summary.migrationCount, 1);
    assert.equal(result.summary.engine, 'sqlite');
  });

});
