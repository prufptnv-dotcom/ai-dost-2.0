const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class NvidiaService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://integrate.api.nvidia.com/v1',
            serviceName: 'NVIDIA',
            timeout: 7000,
            maxRetries: 1,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 30,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 3,
                timeout: 30000
            }
        });
    }

    static async chat(message, history = [], customApiKey = null, mode = 'project') {
        const instance = new NvidiaService();
        return instance._chat(message, history, customApiKey, mode);
    }

    async _chat(message, history = [], customApiKey = null, mode = 'project') {
        try {
            const API_KEY = customApiKey || process.env.NVIDIA_API_KEY;

            if (!API_KEY || API_KEY === 'your_nvidia_key') {
                logger.error('❌ NVIDIA API Key not found or still default!');
                return 'NVIDIA API key set nahi hai. Settings icon pe click karke apni custom key enter karein.';
            }

            let systemPrompt = '';
            if (mode !== 'agent') {
                systemPrompt = `You are AI-Dost, an expert Senior Software Engineer and AI Assistant.
Key Guidelines:
1. Language & Grammar: Respond in clean, natural, grammatically flawless language matching the user preference.
2. Professional Tone: Present yourself confidently as AI-Dost.
3. High Precision: Ensure all code snippets are accurate and production-ready.`;
            }

            const messagesPayload = [];
            if (systemPrompt) {
                messagesPayload.push({ role: 'system', content: systemPrompt });
            }
            if (history && history.length > 0) {
                messagesPayload.push(...history);
            }
            messagesPayload.push({ role: 'user', content: message });

            const result = await this.client.post('/chat/completions', {
                model: 'z-ai/glm-5.2',
                messages: messagesPayload,
                temperature: 1,
                top_p: 1,
                max_tokens: 16384,
                seed: 42
            }, {
                'Authorization': `Bearer ${API_KEY}`
            });

            logger.info('✅ NVIDIA response received');

            if (result.data.choices && result.data.choices[0] && result.data.choices[0].message) {
                return result.data.choices[0].message.content;
            } else {
                return 'NVIDIA returned an unexpected response.';
            }

        } catch (error) {
            logger.error('❌ NVIDIA Service Error:', error.message);

            if (error.message.includes('RATE_LIMIT')) {
                return 'NVIDIA_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'NVIDIA_CIRCUIT_OPEN';
            }

            return 'NVIDIA service me error: ' + error.message;
        }
    }
}

module.exports = NvidiaService;