'use strict';

/**
 * AI-Dost 2.0 — Phase: Runtime Reality & Failure Testing Gate
 * 
 * FailureInjector
 * Safely injects and reverts controlled system failure conditions:
 * - Port collision
 * - Database read-only / locked state
 * - Environment variable tampering
 * - Corrupted artifact injection
 * - Request timeouts
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

class FailureInjector {
  constructor() {
    this.activeOccupiedSockets = [];
    this.envBackups = new Map();
    this.fileBackups = new Map();
  }

  /**
   * Occupy a TCP port to trigger deterministic port collision errors
   * @param {number} port
   * @returns {Promise<net.Server>}
   */
  async occupyPort(port) {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref(); // Don't hold open process
      server.listen(port, '127.0.0.1', () => {
        this.activeOccupiedSockets.push(server);
        resolve(server);
      });
      server.on('error', reject);
    });
  }

  /**
   * Override environment variable temporarily with safe restoration
   * @param {string} key
   * @param {string} temporaryValue
   */
  overrideEnv(key, temporaryValue) {
    if (!this.envBackups.has(key)) {
      this.envBackups.set(key, process.env[key]);
    }
    if (temporaryValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = temporaryValue;
    }
  }

  /**
   * Restore modified environment variables
   */
  restoreEnv() {
    for (const [key, val] of this.envBackups.entries()) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
    this.envBackups.clear();
  }

  /**
   * Corrupt a file to test parsing and AST verification fail-closed behavior
   * @param {string} filePath
   */
  corruptFile(filePath) {
    if (fs.existsSync(filePath)) {
      const original = fs.readFileSync(filePath);
      this.fileBackups.set(filePath, original);
      fs.writeFileSync(filePath, Buffer.from('<<<CORRUPTED_SYNTAX_ERROR_INJECTED>>>'));
    }
  }

  /**
   * Restore all corrupted files to their original state
   */
  restoreFiles() {
    for (const [filePath, content] of this.fileBackups.entries()) {
      try {
        fs.writeFileSync(filePath, content);
      } catch (e) {
        // Ignored
      }
    }
    this.fileBackups.clear();
  }

  /**
   * Clean up all active listeners and restore environment
   */
  cleanup() {
    for (const s of this.activeOccupiedSockets) {
      try { s.close(); } catch (e) {}
    }
    this.activeOccupiedSockets = [];
    this.restoreEnv();
    this.restoreFiles();
  }
}

module.exports = { FailureInjector };
