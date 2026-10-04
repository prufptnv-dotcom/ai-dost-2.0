const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../logger');

/**
 * ToolMakerService: Allows AI-Dost to autonomously create, test, and register new tools.
 * This is the "God-Mode" capability where the agent extends its own codebase.
 */
class ToolMakerService {
    constructor() {
        this.skillsDir = path.join(os.homedir(), '.agents', 'skills');
        this.repoSkillsDir = path.join(__dirname, '..', '..', '.agents', 'skills');
    }

    /**
     * Creates a new executable tool based on the agent's generated code.
     * @param {string} toolName - Name of the tool to create.
     * @param {string} jsCode - The actual JavaScript code for the tool.
     * @param {object} manifest - { description, params }
     */
    async createTool(toolName, jsCode, manifest = {}) {
        try {
            const toolFolder = path.join(this.repoSkillsDir, toolName);
            
            if (!fs.existsSync(toolFolder)) {
                fs.mkdirSync(toolFolder, { recursive: true });
            }

            // 1. Write the executable logic (TOOL.js)
            fs.writeFileSync(path.join(toolFolder, 'TOOL.js'), jsCode, 'utf-8');

            // 2. Write the manifest (manifest.json)
            const manifestContent = JSON.stringify({
                name: toolName,
                description: manifest.description || `Autonomously created tool for ${toolName}`,
                params: manifest.params || [],
                createdAt: new Date().toISOString(),
                createdBy: 'AI-Dost ToolMaker'
            }, null, 2);
            fs.writeFileSync(path.join(toolFolder, 'manifest.json'), manifestContent, 'utf-8');

            logger.info(`🛠️ [ToolMaker] Successfully created new tool: ${toolName}`);
            
            // Trigger SkillRegistry to reload
            const skillRegistry = require('./skillRegistry');
            skillRegistry.load();

            return { success: true, message: `Tool ${toolName} created and registered successfully.` };
        } catch (e) {
            logger.error(`❌ [ToolMaker] Error creating tool ${toolName}: ${e.message}`);
            return { success: false, error: e.message };
        }
    }

    /**
     * Validates if the generated code is syntactically correct before saving.
     */
    async validateToolCode(jsCode) {
        try {
            const vm = require('vm');
            new vm.Script(jsCode); 
            return { valid: true };
        } catch (e) {
            return { valid: false, error: e.message };
        }
    }

    /**
     * High-level loop: Think -> Write Tool -> Validate -> Register.
     */
    async autonomousToolCreation(task, req) {
        logger.info(`🛠️ [ToolMaker] Attempting to create a custom tool for: ${task}`);
        
        const toolDesignPrompt = `
            TASK: ${task}
            The current toolset is insufficient. You must create a new JavaScript tool to solve this.
            
            REQUIREMENTS:
            1. The code must be a module exporting a 'run' function: module.exports.run = async (params) => { ... }
            2. Use only standard Node.js libraries or available npm packages.
            3. The tool must be pure and idempotent.
            
            OUTPUT FORMAT (JSON):
            {
                "toolName": "unique-kebab-case-name",
                "jsCode": "the full javascript code",
                "manifest": { "description": "...", "params": ["param1", "param2"] }
            }
        `;

        const MoERouterService = require('./moeRouterService');
        const designResult = await MoERouterService.executeExpert(toolDesignPrompt, 'You are a Senior Systems Engineer specializing in Tool Development.', [], 'chat', {});
        
        try {
            const design = JSON.parse(designResult.response);
            
            const validation = await this.validateToolCode(design.jsCode);
            if (!validation.valid) {
                return { success: false, error: `Syntax error in generated tool: ${validation.error}` };
            }

            return await this.createTool(design.toolName, design.jsCode, design.manifest);
            
        } catch (e) {
            logger.error(`❌ [ToolMaker] Failed to parse tool design: ${e.message}`);
            return { success: false, error: 'Could not parse tool design as JSON.' };
        }
    }
}

module.exports = new ToolMakerService();
