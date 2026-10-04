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
        if (isMathIntent) {
            return { expert: 'nvidia', reason: 'High-precision mathematical reasoning required' };
        }
        
        if (isCodingIntent) {
            if (message.length > 500 || message.toLowerCase().includes('architecture') || message.toLowerCase().includes('fullstack')) {
                return { expert: 'deepseek', reason: 'Complex software architecture and long-context coding' };
            }
            return { expert: 'groq-llama3', reason: 'Fast interactive coding and debugging' };
        }

        if (isTranslationIntent) {
            return { expert: 'mistral', reason: 'Nuanced multilingual translation capabilities' };
        }

        if (isWritingIntent) {
            if (message.length > 1000) {
                return { expert: 'gemini', reason: 'Long-form creative writing and summarization' };
            }
            return { expert: 'groq-llama3', reason: 'Fast short-form creative drafting' };
        }

        return { expert: 'auto-cascade', reason: 'General conversation, falling back to reliability cascade' };
    }

    /**
     * Executes the query using the assigned Expert Model with a reasoning wrapper.
     */
    static async executeExpert(route, message, groqMsg, cleanHistory, fileContent, mode, customKeys) {
        logger.info(`🧠 [MoE Router] Assigned Expert: ${route.expert} (Reason: ${route.reason})`);

        // HYPER-COGNITION: Enforce Inner Monologue
        const reasoningWrapper = `
            Please follow this structure for your response:
            <thought>
            [Analyze the request, identify edge cases, plan your steps, and challenge your own assumptions here]
            </thought>
            <response>
            [Your final, polished answer here]
            </response>
        `;
        
        const enhancedMessage = `${reasoningWrapper}\n\nUSER REQUEST: ${message}`;

        try {
            let rawResponse;
            switch (route.expert) {
                case 'nvidia':
                    rawResponse = await NvidiaService.chat(enhancedMessage, cleanHistory, customKeys?.nvidia);
                    break;
                case 'deepseek':
                    rawResponse = await DeepseekService.chat(enhancedMessage, cleanHistory, fileContent, mode, customKeys?.deepseek);
                    break;
                case 'groq-llama3':
                    rawResponse = await GroqService.chat(enhancedMessage, cleanHistory, customKeys?.groq);
                    break;
                case 'mistral':
                    rawResponse = await MistralService.chat(enhancedMessage, cleanHistory, fileContent, mode, customKeys?.mistral);
                    break;
                case 'gemini':
                    rawResponse = await GeminiService.chat(enhancedMessage, cleanHistory, fileContent, mode, customKeys?.gemini);
                    break;
                case 'auto-cascade':
                default:
                    rawResponse = await executeCascadingFailover(enhancedMessage, groqMsg, cleanHistory, fileContent, mode, customKeys);
            }

            // Parse the <thought> and <response> blocks
            const thoughtMatch = rawResponse.match(/<thought>([\s\S]*?)<\/thought>/i);
            const responseMatch = rawResponse.match(/<response>([\s\S]*?)<\/response>/i);

            const thought = thoughtMatch ? thoughtMatch[1].trim() : '';
            const finalResponse = responseMatch ? responseMatch[1].trim() : rawResponse;

            return { 
                response: finalResponse, 
                thought: thought, 
                model: route.expert === 'auto-cascade' ? 'auto-general' : route.expert 
            };

        } catch (error) {
            logger.warn(`⚠️ [MoE Router] Primary Expert '${route.expert}' failed. Reason: ${error.message}. Initiating failover cascade.`);
            const fallbackResponse = await executeCascadingFailover(enhancedMessage, groqMsg, cleanHistory, fileContent, mode, customKeys);
            
            // Try to extract thought from fallback too
            const thoughtMatch = fallbackResponse.match(/<thought>([\s\S]*?)<\/thought>/i);
            const responseMatch = fallbackResponse.match(/<response>([\s\S]*?)<\/response>/i);
            
            return { 
                response: responseMatch ? responseMatch[1].trim() : fallbackResponse, 
                thought: thoughtMatch ? thoughtMatch[1].trim() : '',
                model: `failover-${route.expert}` 
            };
        }
    }
}

module.exports = MoERouterService;
