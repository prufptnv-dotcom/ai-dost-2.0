const logger = require('../../logger');

/**
 * reactProtocol.js
 * 
 * Implements the ReAct (Reasoning and Acting) loop protocol.
 * Forces the LLM to follow the cycle: Thought -> Action -> Observation -> Final Answer.
 */
class ReActProtocol {
    constructor(llmService) {
        this.llmService = llmService; // An instance of GeminiService, GroqService, etc.
        this.maxSteps = 5;
    }

    /**
     * Executes the ReAct loop for a given task
     */
    async run(taskPrompt, tools = {}) {
        logger.info(`[ReAct] Starting ReAct loop for task: "${taskPrompt.substring(0, 50)}..."`);
        
        let context = `Task: ${taskPrompt}\n\nAvailable Tools: ${Object.keys(tools).join(', ')}\n\n`;
        context += `You must follow this exact format:
Thought: think about what to do next
Action: the tool to use (one of [${Object.keys(tools).join(', ')}])
Action Input: the input to the tool
Observation: the result of the action

When you have the final answer, output:
Final Answer: the answer to the task\n\n`;

        for (let step = 1; step <= this.maxSteps; step++) {
            logger.info(`[ReAct] Step ${step}/${this.maxSteps}`);
            
            // In a real implementation, we call the LLM with the ongoing context here
            // const response = await this.llmService.chat(context);
            const response = "Mock LLM Response. Thought: I should output the final answer. Final Answer: Task completed."; // Placeholder

            // Check if LLM reached the final answer
            if (response.includes("Final Answer:")) {
                const finalAnswer = response.split("Final Answer:")[1].trim();
                logger.info(`[ReAct] Task completed successfully.`);
                return finalAnswer;
            }

            // Extract Action and Action Input
            const actionMatch = response.match(/Action:\s*(.*)/);
            const actionInputMatch = response.match(/Action Input:\s*(.*)/);

            if (actionMatch && actionInputMatch) {
                const action = actionMatch[1].trim();
                const input = actionInputMatch[1].trim();
                
                logger.info(`[ReAct] Executing Action: ${action} with Input: ${input}`);
                
                // Execute tool
                let observation = "Tool execution failed or tool not found.";
                if (tools[action]) {
                    try {
                        observation = await tools[action](input);
                    } catch (e) {
                        observation = `Error executing tool: ${e.message}`;
                    }
                }
                
                // Append to context
                context += `${response}\nObservation: ${observation}\n\n`;
            } else {
                // If the LLM didn't format correctly, force it to correct itself
                context += `${response}\nObservation: Invalid format. Please use Thought -> Action -> Action Input.\n\n`;
            }
        }

        logger.warn(`[ReAct] Max steps reached without finding Final Answer.`);
        return "Task could not be completed within the step limit.";
    }
}

module.exports = ReActProtocol;
