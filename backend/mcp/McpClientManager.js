const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const logger = require('../logger');

class McpClientManager {
  constructor() {
    this.client = null;
    this.transport = null;
    this.availableTools = [];
    this.isConnected = false;
  }

  async connect(command, args = [], env = process.env) {
    if (this.isConnected) {
      return this.availableTools;
    }

    try {
      logger.info(`🔌 Connecting to MCP Server via: ${command} ${args.join(' ')}`);
      
      this.transport = new StdioClientTransport({
        command,
        args,
        env
      });

      this.client = new Client({
        name: 'ai-dost-backend',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info('✅ MCP Server Connected Successfully!');

      // Fetch Tools
      const response = await this.client.listTools();
      this.availableTools = response.tools || [];
      
      logger.info(`🛠️ Discovered ${this.availableTools.length} MCP Tools`);
      return this.availableTools;

    } catch (error) {
      logger.error('❌ MCP Connection Error:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async callTool(name, args) {
    if (!this.isConnected || !this.client) {
      throw new Error('MCP Client is not connected');
    }
    logger.info(`⚙️ Calling MCP Tool: ${name}`);
    
    try {
      const response = await this.client.callTool({
        name: name,
        arguments: args
      });
      return response;
    } catch (error) {
      logger.error(`❌ Error calling MCP tool ${name}:`, error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this.transport) {
      await this.transport.close();
    }
    this.isConnected = false;
    this.client = null;
    logger.info('🛑 MCP Server Disconnected');
  }
}

module.exports = new McpClientManager();
