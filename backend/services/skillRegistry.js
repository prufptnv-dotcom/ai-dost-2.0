const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../logger');

/**
 * SkillRegistry — Discovers and loads agent skills for the AI-Dost autonomous agent.
 *
 * Skills are markdown instruction packs installed via `npx skills add` into
 * `~/.agents/skills/<name>/SKILL.md`. The agent loads the relevant skill's
 * instructions into its system prompt ONLY when the task matches, saving
 * tokens (no need to re-request instructions from the LLM every time).
 */
class SkillRegistry {
    constructor() {
        this.skillsDir = path.join(os.homedir(), '.agents', 'skills');
        this.skills = new Map(); // name -> { name, description, content, path }
        this._loaded = false;
    }

    /**
     * Scan the skills directory and load all SKILL.md files.
     */
    load() {
        if (this._loaded) return this.skills;
        try {
            if (!fs.existsSync(this.skillsDir)) {
                logger.warn(`Skills directory not found: ${this.skillsDir}`);
                return this.skills;
            }
            const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const skillDir = path.join(this.skillsDir, entry.name);
                const skillFile = path.join(skillDir, 'SKILL.md');
                if (!fs.existsSync(skillFile)) continue;

                try {
                    const content = fs.readFileSync(skillFile, 'utf-8');
                    const description = this._extractDescription(content, entry.name);
                    this.skills.set(entry.name, {
                        name: entry.name,
                        description,
                        content,
                        path: skillFile
                    });
                    logger.info(`📚 Skill loaded: ${entry.name} — ${description.slice(0, 60)}`);
                } catch (e) {
                    logger.warn(`Failed to load skill ${entry.name}: ${e.message}`);
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
        // Try to find a description in frontmatter or first heading
        const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
        if (fmMatch) {
            const descMatch = fmMatch[1].match(/description:\s*["']?([^"'\n]+)["']?/);
            if (descMatch) return descMatch[1].trim();
        }
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) return headingMatch[1].trim();
        return fallback;
    }

    /**
     * Get a skill by name.
     */
    get(name) {
        if (!this._loaded) this.load();
        return this.skills.get(name) || null;
    }

    /**
     * List all available skills (name + description only — keeps tokens low).
     */
    list() {
        if (!this._loaded) this.load();
        return Array.from(this.skills.values()).map(s => ({
            name: s.name,
            description: s.description
        }));
    }

    /**
     * Find skills relevant to a task description using keyword matching.
     * Returns skill names + content so the agent can inject them into its prompt.
     * @param {string} task - user task / prompt
     * @param {number} maxSkills - max skills to return (token budget)
     */
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
            // Check description keywords
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
            content: s.skill.content
        }));
    }

    /**
     * Build a compact skills summary for the agent system prompt.
     * Keeps token usage minimal — only names + one-line descriptions.
     */
    buildSystemPromptSection() {
        const skills = this.list();
        if (skills.length === 0) return '';

        const lines = skills.map(s => `- ${s.name}: ${s.description.slice(0, 80)}`);
        return `\nAVAILABLE SKILLS (load via load_skill(name) when task matches):\n${lines.join('\n')}\n`;
    }
}

module.exports = new SkillRegistry();