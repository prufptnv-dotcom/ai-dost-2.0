'use strict';

const crypto = require('crypto');

class DatabaseSchemaGenerator {
  constructor(plan = {}) {
    this.plan = plan;
  }

  static topologicalSortTables(tables = []) {
    return this.sortTablesTopologically(tables);
  }

  generateSchemaSql() {
    const engine = (this.plan.engine === 'postgres' ? 'postgresql' : this.plan.engine) || 'sqlite';
    if (engine === 'sqlite') {
      return DatabaseSchemaGenerator.generateSqliteDDL(this.plan.tables || []);
    } else if (engine === 'postgresql') {
      return DatabaseSchemaGenerator.generatePostgresDDL(this.plan.tables || []);
    } else if (engine === 'mysql') {
      return DatabaseSchemaGenerator.generateMysqlDDL(this.plan.tables || []);
    }
    return '';
  }

  generateMigrations() {
    const artifacts = DatabaseSchemaGenerator.generateMigrationArtifacts(this.plan);
    return [
      {
        version: '0001',
        name: 'initial_schema',
        filename: `${artifacts.migrationId}_up.sql`,
        content: artifacts.upSql,
        upSql: artifacts.upSql,
        downContent: artifacts.downSql,
        downSql: artifacts.downSql,
        checksum: artifacts.checksum,
        isReversible: artifacts.isReversible
      }
    ];
  }

  generateSeedSql() {
    return DatabaseSchemaGenerator.generateSeedSql(this.plan);
  }

  generateAll() {
    const schemaSql = this.generateSchemaSql();
    const migrations = this.plan.engine === 'none' ? [] : this.generateMigrations();
    const seedSql = this.generateSeedSql();
    return {
      engine: this.plan.engine || 'sqlite',
      schemaSql,
      migrations,
      seedSql,
      summary: {
        engine: this.plan.engine || 'sqlite',
        tableCount: (this.plan.tables || []).length,
        migrationCount: migrations.length
      }
    };
  }

  /**
   * Sorts tables topologically so referenced tables come before dependent tables.
   * Uses alphabetical ordering for ties to guarantee deterministic output.
   */
  static sortTablesTopologically(tables = []) {
    const tableMap = new Map();
    const inDegree = new Map();
    const adj = new Map();

    for (const t of tables) {
      tableMap.set(t.name.toLowerCase(), t);
      inDegree.set(t.name.toLowerCase(), 0);
      adj.set(t.name.toLowerCase(), []);
    }

    for (const t of tables) {
      const tName = t.name.toLowerCase();
      const deps = new Set();

      for (const col of (t.columns || [])) {
        const refTable = col.references?.table || col.foreignKey?.table || col.foreignKey?.referencedTable;
        if (refTable && refTable.toLowerCase() !== tName && tableMap.has(refTable.toLowerCase())) {
          deps.add(refTable.toLowerCase());
        }
      }
      for (const fk of (t.foreignKeys || [])) {
        const refTable = fk.referencedTable || fk.table;
        if (refTable && refTable.toLowerCase() !== tName && tableMap.has(refTable.toLowerCase())) {
          deps.add(refTable.toLowerCase());
        }
      }

      for (const dep of deps) {
        adj.get(dep).push(tName);
        inDegree.set(tName, (inDegree.get(tName) || 0) + 1);
      }
    }

    // Min-heap or sorted queue for deterministic tie-breaking
    const queue = [];
    for (const [name, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(name);
    }
    queue.sort();

    const sorted = [];
    while (queue.length > 0) {
      const u = queue.shift();
      sorted.push(tableMap.get(u));

      const neighbors = adj.get(u) || [];
      neighbors.sort();
      for (const v of neighbors) {
        inDegree.set(v, inDegree.get(v) - 1);
        if (inDegree.get(v) === 0) {
          queue.push(v);
          queue.sort();
        }
      }
    }

    // Add any remaining tables alphabetically (in case of cycles)
    if (sorted.length < tables.length) {
      for (const t of tables) {
        if (!sorted.some(s => s.name.toLowerCase() === t.name.toLowerCase())) {
          sorted.push(t);
        }
      }
    }

    return sorted;
  }

  /**
   * Sorts columns deterministically (Primary keys first, then original order)
   */
  static sortColumns(columns = []) {
    const pks = columns.filter(c => c.primaryKey);
    const others = columns.filter(c => !c.primaryKey);
    return [...pks, ...others];
  }

  /**
   * Generates DDL for SQLite
   */
  static generateSqliteDDL(tables = []) {
    const sortedTables = this.sortTablesTopologically(tables);
    const ddlStatements = [];
    const indexStatements = [];

    for (const table of sortedTables) {
      const lines = [];
      const sortedCols = this.sortColumns(table.columns || []);

      for (const col of sortedCols) {
        let colDef = `  ${col.name} `;
        const type = col.type.toUpperCase();

        if (col.primaryKey) {
          if (col.autoIncrement && (type === 'INTEGER' || type === 'INT')) {
            colDef += 'INTEGER PRIMARY KEY AUTOINCREMENT';
          } else {
            colDef += `${type} PRIMARY KEY`;
          }
        } else {
          colDef += type;
          if (!col.nullable) colDef += ' NOT NULL';
          if (col.unique) colDef += ' UNIQUE';
          const defVal = col.default !== undefined ? col.default : col.defaultValue;
          if (defVal !== null && defVal !== undefined) {
            colDef += ` DEFAULT ${this._formatDefaultValue(defVal)}`;
          }
        }

        const refTable = col.references?.table || col.foreignKey?.table;
        const refCol = col.references?.column || col.foreignKey?.column || 'id';
        if (refTable) {
          colDef += ` REFERENCES ${refTable}(${refCol}) ON DELETE ${col.references?.onDelete || col.foreignKey?.onDelete || 'CASCADE'}`;
        }
        lines.push(colDef);
      }

      // Foreign keys at table level
      for (const fk of (table.foreignKeys || [])) {
        lines.push(`  FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable || fk.table}(${fk.referencedColumn || fk.column || 'id'}) ON DELETE ${fk.onDelete || 'CASCADE'}`);
      }

      const createTable = `CREATE TABLE IF NOT EXISTS ${table.name} (\n${lines.join(',\n')}\n);`;
      ddlStatements.push(createTable);

      // Indexes
      for (const idx of (table.indexes || [])) {
        const unique = idx.unique ? 'UNIQUE ' : '';
        const cols = (idx.columns || []).map(c => c).join(', ');
        indexStatements.push(`CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table.name}(${cols});`);
      }
    }

    return [...ddlStatements, ...indexStatements].join('\n\n');
  }

  /**
   * Generates DDL for PostgreSQL
   */
  static generatePostgresDDL(tables = []) {
    const sortedTables = this.sortTablesTopologically(tables);
    const ddlStatements = [];
    const indexStatements = [];

    for (const table of sortedTables) {
      const lines = [];
      const sortedCols = this.sortColumns(table.columns || []);

      for (const col of sortedCols) {
        let colDef = `  ${col.name} `;
        let type = col.type.toUpperCase();

        if (col.primaryKey) {
          if (col.autoIncrement && (type === 'INT' || type === 'INTEGER' || type === 'SERIAL')) {
            colDef += 'SERIAL PRIMARY KEY';
          } else if (type === 'UUID') {
            colDef += 'UUID PRIMARY KEY DEFAULT gen_random_uuid()';
          } else {
            colDef += `${type} PRIMARY KEY`;
          }
        } else {
          if (col.length && (type === 'VARCHAR' || type === 'CHAR')) {
            type += `(${col.length})`;
          }
          colDef += type;
          if (col.nullable === false || col.notNull === true) colDef += ' NOT NULL';
          if (col.unique) colDef += ' UNIQUE';
          const defVal = col.default !== undefined ? col.default : col.defaultValue;
          if (defVal !== null && defVal !== undefined) {
            colDef += ` DEFAULT ${this._formatDefaultValue(defVal)}`;
          }
        }

        const refTable = col.references?.table || col.foreignKey?.table;
        const refCol = col.references?.column || col.foreignKey?.column || 'id';
        if (refTable) {
          colDef += ` REFERENCES ${refTable}(${refCol}) ON DELETE ${col.references?.onDelete || col.foreignKey?.onDelete || 'CASCADE'}`;
        }
        lines.push(colDef);
      }

      for (const fk of (table.foreignKeys || [])) {
        const fkName = `fk_${table.name}_${fk.column}`;
        lines.push(`  CONSTRAINT ${fkName} FOREIGN KEY (${fk.column}) REFERENCES ${fk.referencedTable || fk.table}(${fk.referencedColumn || fk.column || 'id'}) ON DELETE ${fk.onDelete || 'CASCADE'}`);
      }

      const createTable = `CREATE TABLE IF NOT EXISTS ${table.name} (\n${lines.join(',\n')}\n);`;
      ddlStatements.push(createTable);

      for (const idx of (table.indexes || [])) {
        const unique = idx.unique ? 'UNIQUE ' : '';
        const cols = (idx.columns || []).map(c => c).join(', ');
        indexStatements.push(`CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table.name}(${cols});`);
      }
    }

    return [...ddlStatements, ...indexStatements].join('\n\n');
  }

  /**
   * Generates DDL for MySQL
   */
  static generateMysqlDDL(tables = []) {
    const sortedTables = this.sortTablesTopologically(tables);
    const ddlStatements = [];
    const indexStatements = [];

    for (const table of sortedTables) {
      const lines = [];
      const sortedCols = this.sortColumns(table.columns || []);

      for (const col of sortedCols) {
        let colDef = `  \`${col.name}\` `;
        let type = col.type.toUpperCase();

        if (col.primaryKey) {
          if (col.autoIncrement) {
            colDef += `${type} AUTO_INCREMENT PRIMARY KEY`;
          } else {
            colDef += `${type} PRIMARY KEY`;
          }
        } else {
          if (col.length && (type === 'VARCHAR' || type === 'CHAR')) {
            type += `(${col.length})`;
          } else if (type === 'VARCHAR' && !col.length) {
            type += '(255)';
          }
          colDef += type;
          if (!col.nullable) colDef += ' NOT NULL';
          if (col.unique) colDef += ' UNIQUE';
          if (col.default !== null && col.default !== undefined) {
            colDef += ` DEFAULT ${this._formatDefaultValue(col.default)}`;
          }
        }
        lines.push(colDef);
      }

      for (const fk of (table.foreignKeys || [])) {
        const fkName = `fk_${table.name}_${fk.column}`;
        lines.push(`  CONSTRAINT \`${fkName}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.referencedTable}\`(\`${fk.referencedColumn || 'id'}\`) ON DELETE ${fk.onDelete || 'CASCADE'}`);
      }

      const createTable = `CREATE TABLE IF NOT EXISTS \`${table.name}\` (\n${lines.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      ddlStatements.push(createTable);

      for (const idx of (table.indexes || [])) {
        const unique = idx.unique ? 'UNIQUE ' : '';
        const cols = (idx.columns || []).map(c => `\`${c}\``).join(', ');
        indexStatements.push(`CREATE ${unique}INDEX \`${idx.name}\` ON \`${table.name}\` (${cols});`);
      }
    }

    return [...ddlStatements, ...indexStatements].join('\n\n');
  }

  /**
   * Generates complete migration files (up.sql and down.sql)
   */
  static generateMigrationArtifacts(plan) {
    const engine = (plan.engine === 'postgres' ? 'postgresql' : plan.engine) || 'sqlite';
    let upSql = '';

    if (engine === 'sqlite') {
      upSql = this.generateSqliteDDL(plan.tables);
    } else if (engine === 'postgresql') {
      upSql = this.generatePostgresDDL(plan.tables);
    } else if (engine === 'mysql') {
      upSql = this.generateMysqlDDL(plan.tables);
    } else {
      upSql = '-- Database engine is None\n';
    }

    // Down SQL drops tables in reverse topological order to satisfy foreign keys
    const sortedTables = this.sortTablesTopologically(plan.tables || []);
    const reverseTables = [...sortedTables].reverse();
    const downLines = [];

    const isIrreversible = Boolean(plan.destructiveOperations && plan.destructiveOperations.length > 0);

    if (isIrreversible) {
      downLines.push('-- WARNING: This migration contains destructive operations that are irreversible without data loss.');
    }

    for (const t of reverseTables) {
      if (engine === 'mysql') {
        downLines.push(`DROP TABLE IF EXISTS \`${t.name}\`;`);
      } else {
        downLines.push(`DROP TABLE IF EXISTS ${t.name};`);
      }
    }

    const downSql = downLines.join('\n');
    const checksum = crypto.createHash('sha256').update(upSql).digest('hex');
    const migrationId = `m001_initial_schema`;

    // Seed SQL template if seedData provided
    const seedSql = this.generateSeedSql(plan);

    return {
      engine,
      migrationId,
      checksum,
      upSql,
      downSql,
      seedSql,
      isReversible: !isIrreversible,
      files: [
        { path: `migrations/${migrationId}_up.sql`, content: upSql },
        { path: `migrations/${migrationId}_down.sql`, content: downSql }
      ]
    };
  }

  /**
   * Generates parameterized seed SQL statements
   */
  static generateSeedSql(plan) {
    const seedData = Array.isArray(plan.seedData) ? plan.seedData : (Array.isArray(plan.seeds) ? plan.seeds : []);
    if (seedData.length === 0) return '';

    const lines = ['-- Seed Data Generated by AI-Dost 2.0'];
    const engine = plan.engine || 'sqlite';

    for (const item of seedData) {
      const tableName = item.table;
      const rows = Array.isArray(item.rows) ? item.rows : [];
      for (const row of rows) {
        const cols = Object.keys(row).join(', ');
        const vals = Object.values(row).map(v => typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`).join(', ');
        if (engine === 'sqlite') {
          lines.push(`INSERT OR IGNORE INTO ${tableName} (${cols}) VALUES (${vals});`);
        } else {
          lines.push(`INSERT INTO ${tableName} (${cols}) VALUES (${vals});`);
        }
      }
    }

    return lines.join('\n');
  }

  static _formatDefaultValue(def) {
    if (typeof def === 'number' || typeof def === 'boolean') return String(def);
    const str = String(def).trim();
    if (str.toUpperCase() === 'CURRENT_TIMESTAMP' || str.toUpperCase() === 'NOW()' || str.toUpperCase() === 'TRUE' || str.toUpperCase() === 'FALSE' || str.toUpperCase() === 'NULL') {
      return str.toUpperCase();
    }
    if (str.startsWith("'") && str.endsWith("'")) return str;
    return `'${str.replace(/'/g, "''")}'`;
  }
}

DatabaseSchemaGenerator.DatabaseSchemaGenerator = DatabaseSchemaGenerator;
module.exports = DatabaseSchemaGenerator;
