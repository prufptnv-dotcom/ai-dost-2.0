const Tool = require('../runtime/Tool');
const skillRegistry = require('../../services/skillRegistry');
const logger = require('../../logger');

/**
 * LoadSkillTool — Lets the autonomous agent load a skill's instructions
 * into its context on demand. This saves tokens because skill content is
 * only injected when the task actually matches (not always in the prompt).
 */
class LoadSkillTool extends Tool {
    constructor() {
        super({
            name: 'load_skill',
            description: 'Load a skill\'s instructions into context. Call this when the task matches a skill name (e.g. "frontend-design", "webapp-testing", "mcp-builder", "canvas-design", "brand-guidelines", "web-design-guidelines", "web-artifacts-builder", "gemini-api-dev").',
            inputSchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Skill name to load' }
                },
                required: ['name']
            },
            permissions: ['skills.read']
        });
    }

    async execute(context, input) {
        this.validateInput(input);
        const skill = skillRegistry.get(input.name);
        if (!skill) {
            const available = skillRegistry.list().map(s => s.name).join(', ');
            return {
                success: false,
                error: `Skill '${input.name}' not found. Available skills: ${available}`
            };
        }
        logger.info(`📖 Skill loaded by agent: ${input.name}`);
        return {
            success: true,
            result: skill.content,
            metadata: { skill: input.name, chars: skill.content.length }
        };
    }
}

module.exports = LoadSkillTool;