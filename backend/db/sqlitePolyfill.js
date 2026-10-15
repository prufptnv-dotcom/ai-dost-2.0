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
        // P3 #63: pragma strings are interpolated into SQL — keep the API on a
        // safe charset (identifiers/values, spaces, dots, parens, quotes…).
        // Blocks statement stacking (';'), comments ('--', '/*') and backticks.
        if (typeof pragmaStr !== 'string' || !/^[A-Za-z0-9_\s=.'"+,()@:-]+$/.test(pragmaStr) ||
            pragmaStr.includes(';') || pragmaStr.includes('--') || pragmaStr.includes('/*')) {
          throw new Error('Unsafe PRAGMA string rejected');
        }
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
          // P2 #56: bare BEGIN has no nesting guard — a transaction() inside an
          // open transaction threw "cannot start a transaction within a
          // transaction" (and a stray ROLLBACK masked the original error).
          // Depth lives on the instance so ALL wrappers share it.
          if ((self.__txnDepth || 0) > 0) {
            // Already inside a transaction on this connection — run directly
            // (SQLite has no nested BEGIN; nested work joins the outer tx).
            return fn(...args);
          }
          self.__txnDepth = 1;
          self.exec('BEGIN');
          try {
            const result = fn(...args);
            self.exec('COMMIT');
            return result;
          } catch (e) {
            try { self.exec('ROLLBACK'); } catch (_) { /* tx already closed */ }
            throw e;
          } finally {
            self.__txnDepth = 0;
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
