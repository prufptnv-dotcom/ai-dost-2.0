'use strict';

const crypto = require('crypto');

const SCHEMA_PLAN_VERSION = '1.0.0';
const CAPABILITY_ID = 'coding.database_schema_generation';

const SUPPORTED_ENGINES = Object.freeze([
  'sqlite',
  'postgresql',
  'postgres',
  'mysql',
  'none'
]);

function sanitizeIdentifier(name, fallback = 'table') {
  if (!name || typeof name !== 'string') return fallback;
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') || fallback;
}

/**
 * Creates a normalized, validated, serializable DatabaseSchemaPlan data structure.
 */
function createDatabaseSchemaPlan(spec = {}) {
  const planId = spec.planId || `dbplan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const requestId = spec.requestId || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const rawEngine = (spec.engine || spec.type || 'sqlite').toLowerCase().trim();
  const engine = rawEngine === 'postgres' ? 'postgresql' : rawEngine;
  const databaseName = sanitizeIdentifier(spec.database || spec.databaseName || 'app_db', 'app_db');

  // Normalize tables
  const rawTables = Array.isArray(spec.tables) ? spec.tables : [];
  const tables = rawTables.map(t => {
    const tableName = sanitizeIdentifier(t.name, 'unnamed_table');
    const rawColumns = Array.isArray(t.columns) ? t.columns : [];
    
    // Normalize columns
    const columns = rawColumns.map(c => ({
      name: sanitizeIdentifier(c.name, 'col'),
      type: String(c.type || 'text').toLowerCase().trim(),
      length: c.length ? Number(c.length) : null,
      primaryKey: Boolean(c.primaryKey || c.pk),
      autoIncrement: Boolean(c.autoIncrement || c.autoincrement),
      nullable: c.nullable !== undefined ? Boolean(c.nullable) : (c.primaryKey ? false : true),
      unique: Boolean(c.unique),
      default: c.default !== undefined ? c.default : null,
      references: c.references ? {
        table: sanitizeIdentifier(c.references.table || c.references.tableName),
        column: sanitizeIdentifier(c.references.column || c.references.columnName || 'id'),
        onDelete: (c.references.onDelete || 'CASCADE').toUpperCase(),
        onUpdate: (c.references.onUpdate || 'CASCADE').toUpperCase()
      } : null,
      description: typeof c.description === 'string' ? c.description.slice(0, 200) : ''
    }));

    // Normalize indexes
    const rawIndexes = Array.isArray(t.indexes) ? t.indexes : [];
    const indexes = rawIndexes.map(idx => ({
      name: sanitizeIdentifier(idx.name, `idx_${tableName}_${idx.columns ? idx.columns.join('_') : 'col'}`),
      columns: Array.isArray(idx.columns) ? idx.columns.map(c => sanitizeIdentifier(c)) : [],
      unique: Boolean(idx.unique)
    }));

    // Normalize foreign keys defined at table level
    const rawFks = Array.isArray(t.foreignKeys) ? t.foreignKeys : [];
    const foreignKeys = rawFks.map(fk => ({
      column: sanitizeIdentifier(fk.column),
      referencedTable: sanitizeIdentifier(fk.referencedTable || fk.table),
      referencedColumn: sanitizeIdentifier(fk.referencedColumn || fk.column || 'id'),
      onDelete: (fk.onDelete || 'CASCADE').toUpperCase(),
      onUpdate: (fk.onUpdate || 'CASCADE').toUpperCase()
    }));

    return {
      name: tableName,
      description: typeof t.description === 'string' ? t.description.slice(0, 300) : '',
      columns,
      indexes,
      foreignKeys,
      timestamps: t.timestamps !== false
    };
  });

  const options = {
    generateMigrations: spec.options?.generateMigrations !== false,
    generateRollback: spec.options?.generateRollback !== false,
    dryRun: Boolean(spec.options?.dryRun),
    seed: Boolean(spec.options?.seed),
    mode: spec.mode || 'generate'
  };

  const seedData = Array.isArray(spec.seedData) ? spec.seedData : (Array.isArray(spec.seeds) ? spec.seeds : []);

  let connectionUrl = spec.connectionUrl || null;
  if (connectionUrl && typeof connectionUrl === 'string') {
    connectionUrl = connectionUrl.replace(/:([^:@]+)@/, ':***@');
  }

  return {
    version: spec.version || SCHEMA_PLAN_VERSION,
    planVersion: SCHEMA_PLAN_VERSION,
    capabilityId: CAPABILITY_ID,
    planId: spec.planId || `db_plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    requestId,
    engine,
    databaseName,
    connectionUrl,
    tables,
    options,
    seedData,
    seeds: seedData,
    destructiveOperations: Array.isArray(spec.destructiveOperations) ? spec.destructiveOperations : [],
    createdAt: new Date().toISOString()
  };
}

class DatabaseSchemaPlan {
  constructor(spec = {}) {
    const raw = createDatabaseSchemaPlan(spec);
    Object.assign(this, raw);
    this.version = spec.version || SCHEMA_PLAN_VERSION;
    this.tables = raw.tables.map(t => ({
      ...t,
      columns: t.columns.map(c => ({ ...c })),
      indexes: t.indexes.map(i => ({ ...i })),
      foreignKeys: t.foreignKeys.map(f => ({ ...f }))
    }));
  }

  getTable(tableName) {
    const lower = String(tableName || '').toLowerCase();
    return this.tables.find(t => t.name.toLowerCase() === lower);
  }

  addTable(tableSpec) {
    const normalized = createDatabaseSchemaPlan({ tables: [tableSpec] }).tables[0];
    if (this.getTable(normalized.name)) {
      throw new Error(`Table '${normalized.name}' already exists in schema plan`);
    }
    this.tables.push(normalized);
    return normalized;
  }

  toJSON() {
    return {
      version: this.version || SCHEMA_PLAN_VERSION,
      planVersion: this.planVersion || SCHEMA_PLAN_VERSION,
      capabilityId: this.capabilityId,
      planId: this.planId,
      requestId: this.requestId,
      engine: this.engine,
      databaseName: this.databaseName,
      connectionUrl: this.connectionUrl,
      tables: this.tables,
      options: this.options,
      seedData: this.seedData,
      seeds: this.seeds,
      destructiveOperations: this.destructiveOperations,
      createdAt: this.createdAt
    };
  }

  freeze() {
    Object.freeze(this);
    Object.freeze(this.tables);
    for (const t of this.tables) {
      Object.freeze(t);
      if (Array.isArray(t.columns)) Object.freeze(t.columns);
      if (Array.isArray(t.indexes)) Object.freeze(t.indexes);
      if (Array.isArray(t.foreignKeys)) Object.freeze(t.foreignKeys);
    }
    return this;
  }

  clone(overrides = {}) {
    const current = this.toJSON();
    return new DatabaseSchemaPlan({
      ...current,
      planId: `db_plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      ...overrides
    });
  }

  getSanitizedView() {
    return {
      planId: this.planId,
      engine: this.engine,
      databaseName: this.databaseName,
      tablesCount: this.tables.length,
      tables: this.tables.map(t => ({
        name: t.name,
        columnCount: t.columns.length,
        columns: t.columns.map(c => ({
          name: c.name,
          type: c.type,
          primaryKey: c.primaryKey,
          nullable: c.nullable,
          unique: c.unique
        })),
        indexesCount: t.indexes.length
      })),
      options: this.options,
      createdAt: this.createdAt
    };
  }
}

module.exports = {
  SCHEMA_PLAN_VERSION,
  CAPABILITY_ID,
  SUPPORTED_ENGINES,
  DatabaseSchemaPlan,
  createDatabaseSchemaPlan,
  sanitizeIdentifier
};
