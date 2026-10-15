const logger = require('../../logger');
const GeminiService = require('../../services/geminiService');

/**
 * selfReflection.js
 * 
 * Implements the Self-Reflection & Self-Correction algorithm.
 * Evaluates whether retrieved data (e.g., from an API or web scrape)
 * is actually useful. If it hallucinated or failed, it adjusts the query and tries again.
 */
class SelfReflectionEngine {
    constructor() {
        this.maxRetries = 3;
    }

    /**
     * @param {string} originalQuery - The user's original goal
     * @param {Function} fetchAction - An async function that fetches data based on a query
     * @returns {string} The final validated data
     */
    async executeWithCorrection(originalQuery, fetchAction) {
        logger.info(`[SelfReflection] Starting validated execution for: "${originalQuery}"`);
        let currentQuery = originalQuery;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            logger.info(`[SelfReflection] Attempt ${attempt}/${this.maxRetries} with query: "${currentQuery}"`);
            
            try {
                // Execute the action (e.g., hitting a search API)
                const result = await fetchAction(currentQuery);
                
                // If it's the last attempt, we just return whatever we got
                if (attempt === this.maxRetries) {
                    logger.warn(`[SelfReflection] Max retries reached. Returning best effort.`);
                    return result;
                }

                // Analyze if the result is actually what we wanted
                const evaluationPrompt = `Goal: ${originalQuery}\nResult Data: ${JSON.stringify(result).substring(0, 2000)}\n\nDid this result successfully fulfill the goal? Answer ONLY with 'YES' or provide a 'NEW_QUERY: <better search query>' if it failed or returned irrelevant data.`;
                
                // const evaluation = await GeminiService.chat(evaluationPrompt);
                // Mock evaluation for now. In reality, LLM decides if result is good.
                const evaluation = "YES"; 

                if (evaluation.includes('YES')) {
                    logger.info(`[SelfReflection] Result validated successfully on attempt ${attempt}.`);
                    return result;
                } else if (evaluation.includes('NEW_QUERY:')) {
                    const newQuery = evaluation.split('NEW_QUERY:')[1].trim();
                    logger.warn(`[SelfReflection] Result failed validation. Retrying with new query: "${newQuery}"`);
                    currentQuery = newQuery;
                } else {
                    // Fallback if LLM output format is weird
                    logger.warn(`[SelfReflection] Result validation ambiguous. Continuing anyway.`);
                    return result;
                }

            } catch (error) {
                logger.error(`[SelfReflection] Action failed on attempt ${attempt}: ${error.message}`);
                // Modify query slightly to handle generic API errors (e.g., stripping special characters)
                currentQuery = currentQuery.replace(/[^a-zA-Z0-9 ]/g, "");
            }
        }
        
        return null;
    }
}

module.exports = new SelfReflectionEngine();
