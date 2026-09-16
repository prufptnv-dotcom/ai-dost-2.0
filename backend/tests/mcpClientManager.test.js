'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mcpClientManager = require('../mcp/McpClientManager');

describe('McpClientManager multi-server architecture', () => {
  it('exposes a servers Map with keys for capability discovery', () => {
    assert.ok(mcpClientManager.servers instanceof Map, 'servers should be a Map');
    
    mcpClientManager.registerServer('mock_server', {
      command: 'node',
      args: ['-v'],
    });

    const serverNames = Array.from(mcpClientManager.servers.keys());
    assert.ok(serverNames.includes('mock_server'), 'mock_server should be in servers list');
  });

  it('rejects invalid server registration names', () => {
    assert.throws(() => mcpClientManager.registerServer('', {}), /Invalid MCP server name/);
    assert.throws(() => mcpClientManager.registerServer(null, {}), /Invalid MCP server name/);
  });

  it('throws expected error when calling tool on disconnected server', async () => {
    await assert.rejects(
      async () => mcpClientManager.callTool('mock_server', 'test_tool', {}),
      /is not connected/
    );
  });

  it('supports legacy 2-argument callTool and throws when not connected', async () => {
    await assert.rejects(
      async () => mcpClientManager.callTool('legacy_tool', {}),
      /is not connected/
    );
  });

  it('disconnects cleanly without throwing', async () => {
    await assert.doesNotReject(async () => mcpClientManager.disconnect('mock_server'));
    await assert.doesNotReject(async () => mcpClientManager.disconnect());
  });
});
