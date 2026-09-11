const toolRegistry = require('./ToolRegistry');
const McpTool = require('../tools/McpTool');
const LoadSkillTool = require('../tools/LoadSkillTool');
const mcpClientManager = require('../../mcp/McpClientManager');
const skillRegistry = require('../../services/skillRegistry');
const logger = require('../../logger');

/**
 * registerAgentCapabilities — Wires MCP tools + skills into the agent ToolRegistry.
 *
 * This is the bridge between the AI-Dost autonomous agent and the free MCP
 * servers / skills installed on this machine. It:
 *   1. Registers the load_skill tool (skills on demand — token saving).
 *   2. Lazily connects MCP servers and registers their tools as McpTool adapters.
 *   3. Injects a compact skills summary into the agent system prompt.
 *
 * Token-saving design:
 *   - MCP tools are registered once, but results are truncated (4KB default).
 *   - Skill content is NOT in the prompt — loaded on demand via load_skill.
 *   - Only relevant skills are suggested in the system prompt (name + 1 line).
 */

let _registered = false;

/**
 * Register the load_skill tool (always available).
 */
function registerSkillTool() {
    if (toolRegistry.has('load_skill')) return;
    toolRegistry.register(new LoadSkillTool());
    logger.info('🧠 load_skill tool registered');
}

/**
 * Register MCP tools from all configured servers.
 * @param {Array<string>} serverNames - optional subset; defaults to all
 * @param {number} maxToolsPerServer - cap to save context
 */
async function registerMcpTools(serverNames = null, maxToolsPerServer = 15) {
    const names = serverNames || Array.from(mcpClientManager.servers.keys());
    let total = 0;

    for (const name of names) {
        const tools = await mcpClientManager.connect(name);
        if (!tools || tools.length === 0) {
            logger.warn(`⚠️ No tools from MCP server: ${name}`);
            continue;
        }
        const capped = tools.slice(0, maxToolsPerServer);
        for (const toolDef of capped) {
            const toolName = `mcp_${name}_${toolDef.name}`;
            if (toolRegistry.has(toolName)) continue;
            try {
                toolRegistry.register(new McpTool(name, toolDef));
                total++;
            } catch (e) {
                logger.warn(`Skip MCP tool ${toolName}: ${e.message}`);
            }
        }
        logger.info(`🔌 MCP server '${name}': ${capped.length} tools registered`);
    }
    logger.info(`🔌 Total MCP tools registered: ${total}`);
    return total;
}

/**
 * Build the skills section for the agent system prompt (compact).
 */
function buildSkillsPromptSection() {
    return skillRegistry.buildSystemPromptSection();
}

/**
 * One-shot: register everything.
 * @param {object} options
 * @param {Array<string>} options.mcpServers - MCP servers to connect (default all)
 * @param {number} options.maxToolsPerServer
 */
async function registerAll(options = {}) {
    if (_registered && !options.force) {
        return { mcpTools: toolRegistry.list().filter(t => t.name.startsWith('mcp_')).length, skills: skillRegistry.list().length };
    }

    registerSkillTool();
    const mcpTools = await registerMcpTools(options.mcpServers, options.maxToolsPerServer || 15);
    const skills = skillRegistry.list();

    _registered = true;
    logger.info(`✅ Agent capabilities ready: ${mcpTools} MCP tools + ${skills.length} skills + load_skill`);
    return { mcpTools, skills: skills.length };
}

module.exports = {
    registerAll,
    registerSkillTool,
    registerMcpTools,
    buildSkillsPromptSection
};