const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../logger');

/**
 * SkillRegistry — Discovers and loads agent skills (Instructional & Executable) for AI-Dost.
 * 
 * Support Types:
 * 1. Instructional (SKILL.md): Instruction packs for the LLM.
 * 2. Executable (TOOL.js): JavaScript functions that the agent can run.
 */
class SkillRegistry {
    constructor() {
        this.skillsDir = path.join(os.homedir(), '.agents', 'skills');
        this.repoSkillsDir = path.join(__dirname, '..', '..', '.agents', 'skills');
        this.skills = new Map(); // name -> { name, description, content, path, type, execute }
        this._loaded = false;
    }

    /**
     * Scan the skills directory and load all SKILL.md and TOOL.js files.
     */
    load() {
        if (this._loaded) return this.skills;
        try {
            const dirs = [this.skillsDir, this.repoSkillsDir];
            for (const dir of dirs) {
                if (!fs.existsSync(dir)) {
                    logger.warn(`Skills directory not found: ${dir}`);
                    continue;
                }
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (!entry.isDirectory()) continue;
                    if (this.skills.has(entry.name)) continue;
                    const skillDir = path.join(dir, entry.name);
                    
                    // 1. Check for Instructional Skill (SKILL.md)
                    const skillFile = path.join(skillDir, 'SKILL.md');
                    let skillData = {
                        name: entry.name,
                        path: skillDir,
                        type: 'instructional'
                    };

                    if (fs.existsSync(skillFile)) {
                        const content = fs.readFileSync(skillFile, 'utf-8');
                        skillData.content = content;
                        skillData.description = this._extractDescription(content, entry.name);
                    }

                    // 2. Check for Executable Skill (TOOL.js)
                    const toolFile = path.join(skillDir, 'TOOL.js');
                    if (fs.existsSync(toolFile)) {
                        try {
                            const toolModule = require(toolFile);
                            skillData.type = 'executable';
                            skillData.execute = typeof toolModule === 'function' ? toolModule : toolModule.run;
                            
                            const manifestFile = path.join(skillDir, 'manifest.json');
                            if (fs.existsSync(manifestFile)) {
                                const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
                                skillData.description = manifest.description || skillData.description;
                                skillData.params = manifest.params || [];
                            } else if (!skillData.description) {
                                skillData.description = `Executable tool for ${entry.name}`;
                            }
                        } catch (e) {
                            logger.warn(`Failed to load executable tool ${entry.name}: ${e.message}`);
                        }
                    }

                    if (skillData.description) {
                        this.skills.set(entry.name, skillData);
                        logger.info(`📚 Skill loaded: ${entry.name} [${skillData.type}] — ${skillData.description.slice(0, 60)}`);
                    }
                }
            }
            this._loaded = true;
            logger.info(`📚 Total skills loaded: ${this.skills.size}`);
        } catch (e) {
            logger.error('SkillRegistry load error:', e.message);
        }
        return this.skills;
    }

    _extractDescription(content, fallback) {
        const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (fmMatch) {
            const descMatch = fmMatch[1].match(/description:\s*["']?([^"'\n]+)["']?/);
            if (descMatch) return descMatch[1].trim();
        }
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) return headingMatch[1].trim();
        return fallback;
    }

    get(name) {
        if (!this._loaded) this.load();
        return this.skills.get(name) || null;
    }

    list() {
        if (!this._loaded) this.load();
        return Array.from(this.skills.values()).map(s => ({
            name: s.name,
            description: s.description,
            type: s.type
        }));
    }

    findRelevant(task = '', maxSkills = 3) {
        if (!this._loaded) this.load();
        if (!task) return [];

        const taskLower = task.toLowerCase();
        const scored = [];

        for (const [name, skill] of this.skills) {
            let score = 0;
            const nameWords = name.replace(/[-_]/g, ' ').split(' ');
            for (const w of nameWords) {
                if (w.length > 2 && taskLower.includes(w)) score += 3;
            }
            const descWords = skill.description.toLowerCase().split(/\s+/);
            for (const w of descWords) {
                if (w.length > 4 && taskLower.includes(w)) score += 1;
            }
            if (score > 0) {
                scored.push({ name, score, skill });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, maxSkills).map(s => ({
            name: s.name,
            description: s.skill.description,
            content: s.skill.content || `Executable tool. Parameters: ${JSON.stringify(s.skill.params || [])}`
        }));
    }

    buildSystemPromptSection() {
        const skills = this.list();
        if (skills.length === 0) return '';

        const lines = skills.map(s => `- ${s.name} [${s.type}]: ${s.description.slice(0, 80)}`);
        return `\nAVAILABLE SKILLS (load via load_skill(name) when task matches):\n${lines.join('\n')}\n`;
    }
}

module.exports = new SkillRegistry();
