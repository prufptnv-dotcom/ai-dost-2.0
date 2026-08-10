const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class MistralService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.mistral.ai/v1',
            serviceName: 'Mistral',
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

    static async chat(message, history = [], customKey = null, mode = 'project') {
        const instance = new MistralService();
        return instance._chat(message, history, customKey, mode);
    }

    async _chat(message, history = [], customKey = null, mode = 'project') {
        const apiKey = customKey || process.env.MISTRAL_API_KEY;
        if (!apiKey) {
            return "Mistral API key set nahi hai. Kripya Header Settings mein API key enter karein.";
        }

        try {
            const formattedHistory = (history || []).map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content)
            }));

            const messages = [];
            if (mode !== 'agent') {
                messages.push({ role: "system", content: "You are Ai-Dost, a friendly and intelligent AI assistant." });
            }
            messages.push(...formattedHistory);
            messages.push({ role: "user", content: message });

            const result = await this.client.post('/chat/completions', {
                model: "mistral-small-latest",
                messages: messages,
                temperature: 0.1
            }, {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            });

            return result.data.choices?.[0]?.message?.content || "Mistral se koi reply nahi mila.";
        } catch (error) {
            logger.error("Mistral Service Error:", error);

            if (error.message.includes('RATE_LIMIT')) {
                return 'MISTRAL_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'MISTRAL_CIRCUIT_OPEN';
            }

            return `Mistral Service Error: ${error.message}`;
        }
    }
}

module.exports = MistralService;