'use strict';

const { SUPPORTED_ENGINES } = require('./DatabaseSchemaPlan');

// Strict SQL identifier pattern (table, column, index, database names)
// Prevents SQL injection fragments, quotes, semicolons, comments, spaces
const STRICT_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

// Allowlisted data types per engine
const ALLOWED_TYPES_BY_ENGINE = Object.freeze({
  sqlite: new Set([
    'text', 'varchar', 'char', 'integer', 'int', 'bigint', 'smallint',
    'real', 'float', 'double', 'numeric', 'decimal', 'blob', 'boolean',
    'timestamp', 'datetime', 'date', 'uuid', 'json'
  ]),
  postgresql: new Set([
    'text', 'varchar', 'char', 'integer', 'int', 'bigint', 'smallint',
    'serial', 'bigserial', 'numeric', 'decimal', 'real', 'double precision',
    'boolean', 'bool', 'timestamp', 'timestamptz', 'date', 'time',
    'uuid', 'json', 'jsonb', 'bytea'
  ]),
  mysql: new Set([
    'varchar', 'char', 'text', 'mediumtext', 'longtext', 'int', 'integer',
    'bigint', 'smallint', 'tinyint', 'decimal', 'numeric', 'float', 'double',
    'boolean', 'datetime', 'timestamp', 'date', 'time', 'json', 'blob'
  ]),
  none: new Set(['none', 'text', 'any'])
});

// Dangerous / Destructive keywords
const DESTRUCTIVE_KEYWORDS = Object.freeze([
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\s+.*?\bDROP\b/i
]);

// Dangerous SQL injection fragments
const SQLI_PATTERNS = Object.freeze([
  /['";\\]/,
  /--/,
  /\/\*/,
  /\bUNION\b/i,
  /\bSELECT\b/i,
  /\bEXEC\b/i,
  /\bXP_\w+/i
]);

// Prompt injection patterns in schema descriptions
const PROMPT_INJECTION_PATTERNS = Object.freeze([
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /bypass\s+(security|gatekeeper|validation)/i,
  /system\s+override/i,
  /grant\s+admin/i,
  /<script\b[^>]*>[\s\S]*?<\/script>/i
]);

class DatabaseSchemaValidator {
  /**
   * Validates target database engine
   */
  static validateEngine(engine) {
    const raw = String(engine || '').toLowerCase().trim();
    const normalized = raw === 'postgres' ? 'postgresql' : raw;
    if (SUPPORTED_ENGINES.includes(normalized)) {
      return { valid: true, engine: normalized };
    }
    return {
      valid: false,
      error: {
        code: 'UNSUPPORTED_DATABASE_ENGINE',
        message: `Database engine "${engine}" is not supported. Supported engines are: ${SUPPORTED_ENGINES.join(', ')}`,
        details: { engine, supported: Array.from(SUPPORTED_ENGINES) }
      }
    };
  }

  /**
   * Validates an identifier (table, column, index)
   */
  static validateIdentifier(name, type = 'identifier') {
    if (typeof name !== 'string' || !this.isValidIdentifier(name)) {
      return {
        valid: false,
        error: `Invalid ${type} name "${name}". Must be alphanumeric with underscores, starting with letter or underscore (1-64 characters).`
      };
    }
    return { valid: true, name };
  }

  /**
   * Detects destructive keywords in SQL
   */
  static detectDestructiveKeywords(sql) {
    if (!sql || typeof sql !== 'string') return { destructive: false, matches: [] };
    const matches = [];
    for (const pattern of DESTRUCTIVE_KEYWORDS) {
      const found = sql.match(pattern);
      if (found) {
        matches.push(found[0]);
      }
    }
    return {
      destructive: matches.length > 0,
      matches
    };
  }

  /**
   * Validates SQL identifier safely
   */
  static isValidIdentifier(name) {
    if (!name || typeof name !== 'string') return false;
    if (name === '__proto__' || name === 'constructor' || name === 'prototype') return false;
    return STRICT_IDENTIFIER_REGEX.test(name) && !SQLI_PATTERNS.some(p => p.test(name));
  }

  /**
   * Inspects text for prompt injection attempts
   */
  static inspectTextSecurity(text) {
    if (!text || typeof text !== 'string') return { safe: true };
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return { safe: false, reason: `Prompt injection pattern detected: ${pattern.toString()}` };
      }
    }
    return { safe: true };
  }

  /**
   * Main schema validation method
   * @param {object} plan
   * @returns {{ valid: boolean, errors: string[], warnings: string[], destructiveOperations: string[], unsupportedEngine?: boolean }}
   */
  static validate(plan) {
    const errors = [];
    const warnings = [];
    const destructiveOperations = [];

    if (!plan || typeof plan !== 'object') {
      return { valid: false, errors: ['Plan must be a valid object'], warnings, destructiveOperations };
    }

    // 1. Prototype pollution guard
    if (Object.prototype.hasOwnProperty.call(plan, '__proto__') || Object.prototype.hasOwnProperty.call(plan, 'constructor')) {
      errors.push('Prototype pollution payload detected');
    }

    // 2. Validate engine
    const rawEngine = String(plan.engine || '').toLowerCase().trim();
    const engine = rawEngine === 'postgres' ? 'postgresql' : rawEngine;
    if (!SUPPORTED_ENGINES.includes(engine)) {
      return {
        valid: false,
        unsupportedEngine: true,
        errors: [`Unsupported database engine '${plan.engine}'. Supported engines: [${SUPPORTED_ENGINES.join(', ')}]`],
        warnings,
        destructiveOperations
      };
    }

    // Engine 'none' is completely valid with no tables
    if (engine === 'none') {
      return { valid: true, errors: [], warnings: [], destructiveOperations: [] };
    }

    // 3. Validate database name
    if (plan.databaseName && !this.isValidIdentifier(plan.databaseName)) {
      errors.push(`Invalid database name identifier '${plan.databaseName}'`);
    }

    // 4. Validate tables
    const tables = Array.isArray(plan.tables) ? plan.tables : [];
    if (tables.length === 0) {
      errors.push('Schema plan must define at least one table');
      return { valid: false, errors, warnings, destructiveOperations };
    }

    const tableNamesSeen = new Set();
    const allowedTypes = ALLOWED_TYPES_BY_ENGINE[engine] || ALLOWED_TYPES_BY_ENGINE.sqlite;

    // First pass: collect table names and validate identifier rules
    for (const table of tables) {
      const tName = table.name;
      if (!this.isValidIdentifier(tName)) {
        errors.push(`Invalid table name identifier '${tName}'. Names must match ${STRICT_IDENTIFIER_REGEX.toString()}`);
        continue;
      }

      const lowerName = tName.toLowerCase();
      if (tableNamesSeen.has(lowerName)) {
        errors.push(`Duplicate table name detected: '${tName}'`);
      }
      tableNamesSeen.add(lowerName);

      // Check table description security
      if (table.description) {
        const sec = this.inspectTextSecurity(table.description);
        if (!sec.safe) errors.push(`Security violation in table '${tName}' description: ${sec.reason}`);
      }
    }

    // Second pass: validate columns, constraints, foreign keys, indexes
    for (const table of tables) {
      const tName = table.name;
      const columns = Array.isArray(table.columns) ? table.columns : [];

      if (columns.length === 0) {
        errors.push(`Table '${tName}' must have at least one column definition`);
        continue;
      }

      const columnNamesSeen = new Set();
      let primaryKeyCount = 0;

      for (const col of columns) {
        const cName = col.name;
        if (!this.isValidIdentifier(cName)) {
          errors.push(`Table '${tName}': invalid column name identifier '${cName}'`);
          continue;
        }

        const lowerCol = cName.toLowerCase();
        if (columnNamesSeen.has(lowerCol)) {
          errors.push(`Table '${tName}': duplicate column name detected '${cName}'`);
        }
        columnNamesSeen.add(lowerCol);

        // Validate column data type
        const colType = String(col.type || '').toLowerCase().trim();
        if (!colType || !allowedTypes.has(colType)) {
          errors.push(`Table '${tName}', column '${cName}': type "${col.type}" is not allowed for engine '${engine}'`);
        }

        // Validate primary key & nullability
        if (col.primaryKey) {
          primaryKeyCount++;
          if (col.nullable === true) {
            errors.push(`Table '${tName}', column '${cName}': primary key column cannot be nullable`);
          }
        }

        // Validate default value security
        if (col.default !== null && col.default !== undefined) {
          const defStr = String(col.default);
          if (SQLI_PATTERNS.some(p => p.test(defStr)) && !defStr.startsWith("'") && !defStr.toUpperCase().includes('CURRENT_TIMESTAMP')) {
            errors.push(`Table '${tName}', column '${cName}': suspicious or unsafe default value expression '${defStr}'`);
          }
        }

        // Inline Foreign Key Check
        const colFk = col.references || col.foreignKey;
        if (colFk) {
          const targetTable = (colFk.table || colFk.referencedTable || '').toLowerCase();
          if (!tableNamesSeen.has(targetTable)) {
            errors.push(`Table '${tName}', column '${cName}': foreign key references non-existent table "${colFk.table || colFk.referencedTable}"`);
          }
        }

        // Column description security
        if (col.description) {
          const sec = this.inspectTextSecurity(col.description);
          if (!sec.safe) errors.push(`Security violation in column '${tName}.${cName}' description: ${sec.reason}`);
        }
      }

      if (primaryKeyCount === 0) {
        errors.push(`Table '${tName}' must define at least one primary key`);
      }

      // Table-level Foreign Keys
      const foreignKeys = Array.isArray(table.foreignKeys) ? table.foreignKeys : [];
      for (const fk of foreignKeys) {
        if (!columnNamesSeen.has((fk.column || '').toLowerCase())) {
          errors.push(`Table '${tName}': foreign key references undefined local column '${fk.column}'`);
        }
        const refTable = (fk.referencedTable || fk.table || '').toLowerCase();
        if (!tableNamesSeen.has(refTable)) {
          errors.push(`Table '${tName}': foreign key references non-existent table "${fk.referencedTable || fk.table}"`);
        }
      }

      // Indexes Validation
      const indexes = Array.isArray(table.indexes) ? table.indexes : [];
      for (const idx of indexes) {
        if (!this.isValidIdentifier(idx.name)) {
          errors.push(`Table '${tName}': invalid index name identifier '${idx.name}'`);
        }
        const idxCols = Array.isArray(idx.columns) ? idx.columns : [];
        if (idxCols.length === 0) {
          errors.push(`Table '${tName}', index '${idx.name}': must specify at least one column`);
        }
        for (const ic of idxCols) {
          if (!columnNamesSeen.has(String(ic).toLowerCase())) {
            errors.push(`Table '${tName}', index '${idx.name}': indexed column '${ic}' does not exist in table`);
          }
        }
      }
    }

    // 5. Detect circular foreign key dependencies
    const cycleCheck = this._detectCircularDependencies(tables);
    if (cycleCheck.hasCycle) {
      errors.push(`Circular foreign key dependency detected between tables: [${cycleCheck.cycle.join(' -> ')}]`);
    }

    // 6. Check for destructive operations in options or plan
    if (Array.isArray(plan.destructiveOperations)) {
      for (const op of plan.destructiveOperations) {
        destructiveOperations.push(op);
        warnings.push(`Destructive operation declared: ${op}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      destructiveOperations,
      destructiveDetected: destructiveOperations.length > 0
    };
  }

  /**
   * Detects circular dependencies among tables via foreign keys
   */
  static _detectCircularDependencies(tables) {
    const adj = new Map();
    for (const t of tables) {
      const deps = new Set();
      for (const col of (t.columns || [])) {
        const colFk = col.references || col.foreignKey;
        const refTable = colFk?.table || colFk?.referencedTable;
        if (refTable && refTable.toLowerCase() !== t.name.toLowerCase()) {
          deps.add(refTable.toLowerCase());
        }
      }
      for (const fk of (t.foreignKeys || [])) {
        const refTable = fk.referencedTable || fk.table;
        if (refTable && refTable.toLowerCase() !== t.name.toLowerCase()) {
          deps.add(refTable.toLowerCase());
        }
      }
      adj.set(t.name.toLowerCase(), Array.from(deps));
    }

    const visited = new Set();
    const recStack = new Set();
    const path = [];

    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adj.get(node) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          const res = dfs(n);
          if (res) return res;
        } else if (recStack.has(n)) {
          path.push(n);
          return path;
        }
      }

      recStack.delete(node);
      path.pop();
      return null;
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        const cycle = dfs(node);
        if (cycle) return { hasCycle: true, cycle };
      }
    }

    return { hasCycle: false, cycle: [] };
  }
}

DatabaseSchemaValidator.DatabaseSchemaValidator = DatabaseSchemaValidator;
module.exports = {
  STRICT_IDENTIFIER_REGEX,
  ALLOWED_TYPES_BY_ENGINE,
  DatabaseSchemaValidator
};
