const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class TogetherService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.together.xyz/v1',
            serviceName: 'Together',
            timeout: 15000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 30,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 5,
                timeout: 60000
            }
        });
    }

    static async chat(message, history = [], customKey = null) {
        const instance = new TogetherService();
        return instance._chat(message, history, customKey);
    }

    async _chat(message, history = [], customKey = null) {
        const apiKey = customKey || process.env.TOGETHER_API_KEY;
        if (!apiKey) {
            return "Together AI API key set nahi hai.";
        }

        try {
            const formattedHistory = (history || []).map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

            const result = await this.client.post('/chat/completions', {
                model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                messages: [
                    { role: "system", content: "You are Ai-Dost, a helpful AI assistant." },
                    ...formattedHistory,
                    { role: "user", content: message }
                ],
                temperature: 0.7
            }, {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            });

            return result.data.choices?.[0]?.message?.content || "Together AI se response nahi mila.";
        } catch (error) {
            logger.error("Together Service Error:", error);

            if (error.message.includes('RATE_LIMIT')) {
                return 'TOGETHER_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'TOGETHER_CIRCUIT_OPEN';
            }

            return `Together Service Error: ${error.message}`;
        }
    }
}

module.exports = TogetherService;