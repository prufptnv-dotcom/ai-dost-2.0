const logger = require('../logger');
const ReActProtocol = require('./reasoning/reactProtocol');
const TreeOfThoughts = require('./reasoning/treeOfThoughts');

/**
 * multiAgentCrew.js
 * 
 * CrewAI / LangGraph inspired Multi-Agent Orchestrator.
 * Breaks down massive tasks and delegates them to specialized Sub-Agents.
 * Sub-Agents can be defined with their own roles, goals, and tools.
 */

class Agent {
    constructor(role, goal, backstory, tools = {}) {
        this.role = role;
        this.goal = goal;
        this.backstory = backstory;
        this.tools = tools;
        // The agent's engine (ReAct loop)
        this.engine = new ReActProtocol(null); 
    }

    async executeTask(taskDescription) {
        logger.info(`[MultiAgentCrew] 🤵 Agent '${this.role}' is starting task: ${taskDescription}`);
        const prompt = `You are a ${this.role}. Your backstory: ${this.backstory}\nYour Goal: ${this.goal}\n\nTask to complete: ${taskDescription}`;
        // Normally passes real LLM service to engine, using mock string for now
        return await this.engine.run(prompt, this.tools);
    }
}

class MultiAgentCrew {
    constructor() {
        this.agents = [];
        this.tasks = [];
    }

    /**
     * Registers a specialized sub-agent
     */
    addAgent(agent) {
        this.agents.push(agent);
    }

    /**
     * Adds a task to the execution pipeline
     */
    addTask(description, assignedAgent) {
        this.tasks.push({ description, agent: assignedAgent });
    }

    /**
     * Executes all tasks sequentially, passing context from one agent to the next
     */
    async kickoff() {
        logger.info(`[MultiAgentCrew] 🚀 Kicking off Swarm Execution with ${this.agents.length} agents and ${this.tasks.length} tasks.`);
        let context = "";

        for (let i = 0; i < this.tasks.length; i++) {
            const task = this.tasks[i];
            const taskWithContext = `${task.description}\n\nPrevious Context/Output from other agents:\n${context}`;
            
            const result = await task.agent.executeTask(taskWithContext);
            context += `\nOutput from ${task.agent.role}:\n${result}\n`;
        }

        logger.info(`[MultiAgentCrew] ✅ Swarm Execution Complete.`);
        return context; // The final compiled work of all agents
    }
}

// Export the framework
module.exports = {
    Agent,
    MultiAgentCrew
};
