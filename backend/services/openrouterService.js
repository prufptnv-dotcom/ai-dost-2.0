const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class OpenRouterService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://openrouter.ai/api/v1',
            serviceName: 'OpenRouter',
            timeout: 15000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 20,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 5,
                timeout: 60000
            }
        });
    }

    static async chat(message, history = [], customApiKey = null, mode = 'project') {
        const instance = new OpenRouterService();
        return instance._chat(message, history, customApiKey, mode);
    }

    async _chat(message, history = [], customApiKey = null, mode = 'project') {
        try {
            const API_KEY = customApiKey || process.env.OPENROUTER_API_KEY;

            if (!API_KEY) {
                logger.error('❌ OpenRouter API Key not found!');
                return 'OpenRouter API key set nahi hai. Settings icon pe click karke apni custom key enter karein.';
            }

            const messages = [];
            if (mode !== 'agent') {
                messages.push({
                    role: 'system',
                    content: `You are AI-Dost, an expert Senior Software Engineer and AI Assistant. Write clean, optimal, production-grade code wrapped inside markdown code blocks.`
                });
            }
            messages.push(...history);
            messages.push({ role: 'user', content: message });

            // Free models (2026) — pehle walo ka free tier hat chuka hai.
            // Verified working: openai/gpt-oss-20b:free. Baaki provider availability pe depend karte hain.
            const freeModels = [
                'openai/gpt-oss-20b:free',
                'cohere/north-mini-code:free',
                'z-ai/glm-5.2:free',
                'google/gemma-4-31b-it:free',
                'liquid/lfm-2.5-2.6b:free'
            ];

            let lastError = null;
            for (const model of freeModels) {
                try {
                    const result = await this.client.post('/chat/completions', {
                        model,
                        messages: messages,
                        temperature: 0.1,
                        max_tokens: 16384
                    }, {
                        'Authorization': `Bearer ${API_KEY}`,
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'AI-Dost'
                    });

                    logger.info(`✅ OpenRouter response received (${model})`);

                    if (result.data.choices && result.data.choices[0] && result.data.choices[0].message) {
                        const content = result.data.choices[0].message.content;
                        if (content && content.trim()) {
                            return content;
                        }
                        lastError = `empty content from ${model}`;
                    } else {
                        lastError = `empty response from ${model}`;
                    }
                } catch (error) {
                    lastError = error.message;
                    logger.warn(`⚠️ OpenRouter model ${model} failed: ${error.message}`);
                    continue;
                }
            }

            throw new Error(lastError || 'All OpenRouter free models failed');

        } catch (error) {
            logger.error('❌ OpenRouter Service Error:', error.message);

            if (error.message.includes('RATE_LIMIT')) {
                return 'OPENROUTER_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'OPENROUTER_CIRCUIT_OPEN';
            }

            return 'OpenRouter service error: ' + error.message;
        }
    }
}

module.exports = OpenRouterService;