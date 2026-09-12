'use strict';

/**
 * SQLite Polyfill for Node.js built-in node:sqlite (DatabaseSync)
 * Adds better-sqlite3 compatibility methods: .pragma() and .transaction()
 */

try {
  const { DatabaseSync } = require('node:sqlite');

  if (DatabaseSync && DatabaseSync.prototype) {
    if (typeof DatabaseSync.prototype.pragma !== 'function') {
      DatabaseSync.prototype.pragma = function(pragmaStr, options = {}) {
        const isSetter = pragmaStr.includes('=');
        if (isSetter) {
          return this.exec(`PRAGMA ${pragmaStr}`);
        }
        const stmt = this.prepare(`PRAGMA ${pragmaStr}`);
        const rows = stmt.all();
        if (options && options.simple) {
          if (!rows || rows.length === 0) return null;
          const firstKey = Object.keys(rows[0])[0];
          return rows[0][firstKey];
        }
        return rows;
      };
    }

    if (typeof DatabaseSync.prototype.transaction !== 'function') {
      DatabaseSync.prototype.transaction = function(fn) {
        const self = this;
        return function(...args) {
          self.exec('BEGIN');
          try {
            const result = fn(...args);
            self.exec('COMMIT');
            return result;
          } catch (e) {
            self.exec('ROLLBACK');
            throw e;
          }
        };
      };
    }

    if (typeof DatabaseSync.prototype.close === 'function') {
      const origClose = DatabaseSync.prototype.close;
      DatabaseSync.prototype.close = function() {
        try {
          return origClose.call(this);
        } catch (err) {
          if (err && (err.code === 'ERR_INVALID_STATE' || (err.message && err.message.includes('not open')))) {
            return;
          }
          throw err;
        }
      };
    }
  }
} catch (err) {
  // node:sqlite unavailable or not supported in this node version
}
