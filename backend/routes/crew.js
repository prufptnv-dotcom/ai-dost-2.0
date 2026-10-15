const express = require('express');
const router = express.Router();
const logger = require('../logger');
const { Agent, MultiAgentCrew } = require('../agent/multiAgentCrew');

/**
 * crew.js
 * 
 * Route for triggering massive multi-agent tasks.
 * Instead of simple chat, this endpoint spins up a "Crew" of agents 
 * (e.g. Coder, QA, Security) to collaboratively solve a massive prompt.
 */

router.post('/run', async (req, res) => {
    try {
        const { taskDescription, projectId } = req.body;

        if (!taskDescription) {
            return res.status(400).json({ success: false, error: "taskDescription is required to start the crew." });
        }

        logger.info(`[Route: Crew] Received massive task request. Spinning up AI Crew...`);

        // 1. Define Sub-Agents
        const coderAgent = new Agent(
            "Senior Software Engineer",
            "Write highly optimized, bug-free code.",
            "You are a 10x developer who architects clean systems and writes flawless code."
        );

        const qaAgent = new Agent(
            "Quality Assurance Lead",
            "Identify bugs, edge cases, and performance bottlenecks in code.",
            "You are a strict QA engineer who hates bugs and always finds ways to break code."
        );

        const securityAgent = new Agent(
            "Cybersecurity Auditor",
            "Ensure the code is secure against OWASP Top 10 vulnerabilities.",
            "You are an elite hacker turned security reviewer. You find SQLi, XSS, and CSRF vulnerabilities instantly."
        );

        // 2. Form the Crew
        const crew = new MultiAgentCrew();
        crew.addAgent(coderAgent);
        crew.addAgent(qaAgent);
        crew.addAgent(securityAgent);

        // 3. Define the collaborative pipeline (Tasks)
        crew.addTask(`Write the implementation for: ${taskDescription}`, coderAgent);
        crew.addTask(`Review the implementation provided by the engineer. Run simulated tests and point out edge cases.`, qaAgent);
        crew.addTask(`Review the final implementation and the QA report. Fix any security flaws and provide the final secure code block.`, securityAgent);

        // 4. Kickoff the swarm
        const finalCompiledOutput = await crew.kickoff();

        res.json({
            success: true,
            message: "Multi-Agent Crew successfully completed the task.",
            result: finalCompiledOutput
        });

    } catch (e) {
        logger.error("Crew API Error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
