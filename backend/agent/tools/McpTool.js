const Tool = require('../runtime/Tool');
const mcpClientManager = require('../../mcp/McpClientManager');
const logger = require('../../logger');

/**
 * McpTool — Adapter that exposes an MCP server tool as an agent Tool.
 *
 * This lets the autonomous agent call MCP tools (filesystem, memory, fetch,
 * context7, sequential-thinking, ...) through the same ToolRegistry interface
 * as native tools, while keeping token usage low via result truncation.
 */
class McpTool extends Tool {
    /**
     * @param {string} serverName - MCP server name (e.g. 'filesystem')
     * @param {object} toolDef - Tool definition from MCP listTools()
     */
    constructor(serverName, toolDef) {
        super({
            name: `mcp_${serverName}_${toolDef.name}`,
            description: `[MCP:${serverName}] ${toolDef.description || toolDef.name}`,
            inputSchema: toolDef.inputSchema || { type: 'object', properties: {} },
            permissions: ['mcp.tools']
        });
        this.serverName = serverName;
        this.mcpToolName = toolDef.name;
        this.maxResultChars = 4000; // token-saving truncation
    }

    async execute(context, input) {
        this.validateInput(input);
        try {
            const response = await mcpClientManager.callTool(
                this.serverName,
                this.mcpToolName,
                input || {},
                this.maxResultChars
            );

            // Normalize MCP response to agent-friendly format
            if (response && response.content) {
                const texts = response.content
                    .filter(c => c.type === 'text' && c.text)
                    .map(c => c.text);
                return {
                    success: true,
                    result: texts.join('\n'),
                    metadata: { server: this.serverName, tool: this.mcpToolName }
                };
            }
            return {
                success: true,
                result: JSON.stringify(response),
                metadata: { server: this.serverName, tool: this.mcpToolName }
            };
        } catch (error) {
            logger.error(`McpTool ${this.serverName}.${this.mcpToolName} failed:`, error.message);
            return {
                success: false,
                error: error.message,
                metadata: { server: this.serverName, tool: this.mcpToolName }
            };
        }
    }
}

module.exports = McpTool;