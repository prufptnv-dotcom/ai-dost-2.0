'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: MockDeploymentAdapter
 * 
 * Deterministic in-memory deployment emulator.
 * Simulates builds, container runtimes, port collisions, slow boots,
 * crash loops, and rollback execution with zero external daemon dependencies.
 */

const http = require('http');
const { DeploymentProvider } = require('./DeploymentProvider');

const allActiveMockServers = new Set();

class MockDeploymentAdapter extends DeploymentProvider {
  static async cleanupGlobal() {
    for (const srv of allActiveMockServers) {
      try {
        await new Promise(resolve => srv.close(resolve));
      } catch {}
    }
    allActiveMockServers.clear();
  }

  constructor(options = {}) {
    super();
    this._options = options;
    this._simulatedState = options.simulatedState || {};
    this._activeServers = new Map(); // containerId -> http.Server
    this._logs = new Map(); // containerId -> string[]
  }

  get name() {
    return 'mock';
  }

  async checkAvailability() {
    if (this._simulatedState.offline) {
      return { available: false, reason: 'MOCK_PROVIDER_OFFLINE' };
    }
    return { available: true };
  }

  async build(plan, workspaceRoot) {
    if (this._simulatedState.buildError) {
      return {
        success: false,
        error: this._simulatedState.buildError,
        buildLogs: ['Step 1: FROM node:20-alpine', `Build failed: ${this._simulatedState.buildError}`]
      };
    }

    const imageTag = `aidost_img_${plan.targetEnv}_${plan.projectId}:${plan.deploymentVersion}`;
    return {
      success: true,
      imageTag,
      buildLogs: ['Step 1: FROM node:20-alpine', 'Step 2: COPY . .', `Successfully tagged ${imageTag}`]
    };
  }

  async deploy(plan, imageTag) {
    if (this._simulatedState.deployError) {
      return {
        success: false,
        error: this._simulatedState.deployError
      };
    }

    const containerId = `mock_c_${plan.targetEnv}_${plan.projectId}_${Date.now()}`;
    const hostPort = plan.serviceConfig.hostPort;
    const isCrashing = this._simulatedState.crashLoop || false;
    const isSlowBoot = this._simulatedState.slowBoot || false;
    const returnBadHealth = this._simulatedState.badHealth || false;
    const nonJsonHealth = this._simulatedState.nonJsonHealth || false;

    let bootCount = 0;

    // Launch an in-process ephemeral loopback server on the target port to answer real probes
    const server = http.createServer((req, res) => {
      bootCount++;

      if (isCrashing) {
        // Drop socket
        req.destroy();
        return;
      }

      if (isSlowBoot && bootCount < 2) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'starting' }));
        return;
      }

      if (req.url === '/health') {
        if (returnBadHealth) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', error: 'Database connection failed' }));
          return;
        }
        if (nonJsonHealth) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('OK');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', env: plan.targetEnv, version: plan.deploymentVersion }));
        return;
      }

      if (req.url === '/') {
        if (this._simulatedState.missingDoctype) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<div>No doctype</div>');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><head><title>App</title></head><body><div id="root">App</div></body></html>');
        return;
      }

      // Default smoke response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', path: req.url }));
    });

    try {
      await new Promise((resolve, reject) => {
        server.listen(hostPort, '127.0.0.1', () => {
          resolve();
        });
        server.on('error', (err) => {
          reject(err);
        });
      });
    } catch (err) {
      return {
        success: false,
        error: `DEPLOY_FAILED: ${err.message}`
      };
    }

    this._activeServers.set(containerId, server);
    allActiveMockServers.add(server);
    this._logs.set(containerId, [
      `[MOCK] Container started on 127.0.0.1:${hostPort}`,
      `[MOCK] Image: ${imageTag}`
    ]);

    return {
      success: true,
      containerId,
      hostPort
    };
  }

  async stop(containerId) {
    const server = this._activeServers.get(containerId);
    if (server) {
      await new Promise(resolve => server.close(resolve));
      allActiveMockServers.delete(server);
      this._activeServers.delete(containerId);
    }
    return true;
  }

  async getLogs(containerId, lines = 50) {
    return this._logs.get(containerId) || ['[MOCK] No logs found'];
  }

  async destroy(containerId) {
    await this.stop(containerId);
    this._logs.delete(containerId);
    return true;
  }

  /**
   * Teardown all active mock servers
   */
  async cleanupAll() {
    for (const [id, srv] of this._activeServers.entries()) {
      await new Promise(resolve => srv.close(resolve));
    }
    this._activeServers.clear();
    this._logs.clear();
  }
}

module.exports = {
  MockDeploymentAdapter
};
