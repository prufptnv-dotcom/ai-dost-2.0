const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const logger = require('../logger');

/**
 * McpClientManager
 * Multi-server Model Context Protocol (MCP) client orchestrator.
 * Supports named servers (filesystem, memory, sqlite, etc.) and legacy single-client calls.
 */
class McpClientManager {
  constructor() {
    /** @type {Map<string, { client: Client, transport: StdioClientTransport, tools: Array, isConnected: boolean, config: object }>} */
    this.servers = new Map();

    // Legacy backward-compatibility references (points to default/active server)
    this.client = null;
    this.transport = null;
    this.availableTools = [];
    this.isConnected = false;
  }

  /**
   * Register a named MCP server configuration.
   * @param {string} name - Unique identifier (e.g. 'filesystem', 'sqlite')
   * @param {object} config - { command, args, env }
   */
  registerServer(name, config) {
    if (!name || typeof name !== 'string') throw new Error('Invalid MCP server name');
    this.servers.set(name, {
      name,
      config: config || {},
      client: null,
      transport: null,
      tools: [],
      isConnected: false,
    });
    logger.info(`📋 MCP server registered: ${name}`);
  }

  /**
   * Connect to an MCP server.
   * Polymorphic:
   *   connect('filesystem') -> connects registered server
   *   connect('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/path']) -> connects ad-hoc
   */
  async connect(target, args = [], env = process.env) {
    // Case 1: Connect to an already registered named server
    if (typeof target === 'string' && this.servers.has(target)) {
      const entry = this.servers.get(target);
      if (entry.isConnected && entry.client) {
        return entry.tools;
      }

      const { command, args: cfgArgs = [], env: cfgEnv = process.env } = entry.config;
      if (!command) {
        logger.warn(`⚠️ MCP server '${target}' has no command configured.`);
        return [];
      }

      try {
        logger.info(`🔌 Connecting to registered MCP server '${target}': ${command} ${cfgArgs.join(' ')}`);
        const transport = new StdioClientTransport({ command, args: cfgArgs, env: cfgEnv });
        const client = new Client({ name: `ai-dost-${target}`, version: '1.0.0' }, { capabilities: {} });
        await client.connect(transport);

        entry.client = client;
        entry.transport = transport;
        entry.isConnected = true;

        const response = await client.listTools();
        entry.tools = response?.tools || [];

        // Set as default legacy client if none active
        if (!this.client) {
          this.client = client;
          this.transport = transport;
          this.availableTools = entry.tools;
          this.isConnected = true;
        }

        logger.info(`✅ MCP server '${target}' connected with ${entry.tools.length} tools`);
        return entry.tools;
      } catch (err) {
        logger.error(`❌ MCP connection error for '${target}':`, err.message);
        entry.isConnected = false;
        throw err;
      }
    }

    // Case 2: Ad-hoc command connection
    const serverName = (typeof target === 'string' && !target.includes(' ') && !args.length)
      ? target
      : 'default';

    try {
      const command = typeof target === 'string' ? target : target.command;
      const cmdArgs = Array.isArray(args) ? args : (target.args || []);
      const cmdEnv = env || target.env || process.env;

      logger.info(`🔌 Connecting to MCP server via: ${command} ${cmdArgs.join(' ')}`);
      const transport = new StdioClientTransport({
        command,
        args: cmdArgs,
        env: cmdEnv,
      });

      const client = new Client({
        name: `ai-dost-${serverName}`,
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      await client.connect(transport);

      const response = await client.listTools();
      const tools = response?.tools || [];

      // Update both named map and legacy properties
      this.servers.set(serverName, {
        name: serverName,
        config: { command, args: cmdArgs, env: cmdEnv },
        client,
        transport,
        tools,
        isConnected: true,
      });

      this.client = client;
      this.transport = transport;
      this.availableTools = tools;
      this.isConnected = true;

      logger.info(`✅ MCP Server '${serverName}' connected (${tools.length} tools)`);
      return tools;
    } catch (error) {
      logger.error('❌ MCP Connection Error:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Execute a tool on an MCP server.
   * Polymorphic:
   *   callTool(serverName, toolName, input, maxChars) -> called by McpTool.js
   *   callTool(toolName, input) -> legacy single client call
   */
  async callTool(...args) {
    let serverName = null;
    let toolName = null;
    let toolArgs = {};
    let maxChars = 4000;

    if (args.length >= 2 && typeof args[1] === 'string') {
      // callTool(serverName, toolName, input, maxChars)
      serverName = args[0];
      toolName = args[1];
      toolArgs = args[2] || {};
      if (typeof args[3] === 'number') maxChars = args[3];
    } else {
      // Legacy: callTool(toolName, args)
      toolName = args[0];
      toolArgs = args[1] || {};
    }

    const serverEntry = serverName ? this.servers.get(serverName) : null;
    const client = serverEntry?.client || this.client;

    if (!client) {
      throw new Error(`MCP Client for server '${serverName || 'default'}' is not connected`);
    }

    logger.info(`⚙️ Calling MCP Tool: ${serverName ? `${serverName}.` : ''}${toolName}`);

    try {
      const response = await client.callTool({
        name: toolName,
        arguments: toolArgs,
      });

      // Truncate large output if necessary
      if (response && Array.isArray(response.content) && maxChars > 0) {
        response.content = response.content.map((item) => {
          if (item.type === 'text' && typeof item.text === 'string' && item.text.length > maxChars) {
            return {
              ...item,
              text: `${item.text.slice(0, maxChars)}\n\n[... truncated by MCP manager ...]`,
            };
          }
          return item;
        });
      }

      return response;
    } catch (error) {
      logger.error(`❌ Error calling MCP tool ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Disconnect a specific server or all connected MCP servers.
   * @param {string} [serverName]
   */
  async disconnect(serverName) {
    if (serverName && this.servers.has(serverName)) {
      const entry = this.servers.get(serverName);
      if (entry.transport) {
        await entry.transport.close();
      }
      entry.isConnected = false;
      entry.client = null;
      if (this.client === entry.client) {
        this.client = null;
        this.isConnected = false;
      }
      logger.info(`🛑 MCP Server '${serverName}' Disconnected`);
      return;
    }

    // Disconnect all
    for (const [name, entry] of this.servers.entries()) {
      if (entry.transport) {
        try {
          await entry.transport.close();
        } catch (_) {}
      }
      entry.isConnected = false;
      entry.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (_) {}
    }

    this.isConnected = false;
    this.client = null;
    this.transport = null;
    logger.info('🛑 All MCP Servers Disconnected');
  }
}

module.exports = new McpClientManager();
