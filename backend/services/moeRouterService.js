const logger = require('../logger');
const GeminiService = require('./geminiService');
const GroqService = require('./groqService');
const DeepseekService = require('./deepseekService');
const NvidiaService = require('./nvidiaService');
const MistralService = require('./mistralService');
const { executeCascadingFailover } = require('./llmCascade');

/**
 * moeRouterService.js
 * 
 * Mixture of Experts (MoE) Orchestrator for AI-Dost.
 * Analyzes query complexity and domain to dynamically route to the best "Expert" model.
 */
class MoERouterService {
    /**
     * Determines the most appropriate expert model for a given prompt
     */
    static analyzeAndRoute(message, section, isCodingIntent, isMathIntent, isWritingIntent, isTranslationIntent) {
        // High-Complexity Coding / Math -> DeepSeek / NVIDIA
        if (isMathIntent) {
            return { expert: 'nvidia', reason: 'High-precision mathematical reasoning required' };
        }
        
        if (isCodingIntent) {
            // If the code prompt is huge or requires architectural thinking
            if (message.length > 500 || message.toLowerCase().includes('architecture') || message.toLowerCase().includes('fullstack')) {
                return { expert: 'deepseek', reason: 'Complex software architecture and long-context coding' };
            }
            return { expert: 'groq-llama3', reason: 'Fast interactive coding and debugging' };
        }

        // Translation / Creative Writing -> Gemini / Mistral
        if (isTranslationIntent) {
            return { expert: 'mistral', reason: 'Nuanced multilingual translation capabilities' };
        }

        if (isWritingIntent) {
            if (message.length > 1000) {
                return { expert: 'gemini', reason: 'Long-form creative writing and summarization' };
            }
            return { expert: 'groq-llama3', reason: 'Fast short-form creative drafting' };
        }

        // Default General Chat
        return { expert: 'auto-cascade', reason: 'General conversation, falling back to reliability cascade' };
    }

    /**
     * Executes the query using the assigned Expert Model
     */
    static async executeExpert(route, message, groqMsg, cleanHistory, fileContent, mode, customKeys) {
        logger.info(`🧠 [MoE Router] Assigned Expert: ${route.expert} (Reason: ${route.reason})`);

        try {
            switch (route.expert) {
                case 'nvidia':
                    return { response: await NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia), model: 'nvidia' };
                
                case 'deepseek':
                    return { response: await DeepseekService.chat(message, cleanHistory, fileContent, mode, customKeys?.deepseek), model: 'deepseek' };
                
                case 'groq-llama3':
                    return { response: await GroqService.chat(groqMsg, cleanHistory, customKeys?.groq), model: 'groq' };
                
                case 'mistral':
                    return { response: await MistralService.chat(message, cleanHistory, fileContent, mode, customKeys?.mistral), model: 'mistral' };
                
                case 'gemini':
                    return { response: await GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini), model: 'gemini' };
                
                case 'auto-cascade':
                default:
                    return { response: await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys), model: 'auto-general' };
            }
        } catch (error) {
            logger.warn(`⚠️ [MoE Router] Primary Expert '${route.expert}' failed. Reason: ${error.message}. Initiating failover cascade.`);
            // Fallback to cascade if the specialized expert fails (API limits, network issues, etc.)
            const fallbackResponse = await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
            return { response: fallbackResponse, model: `failover-${route.expert}` };
        }
    }
}

module.exports = MoERouterService;
