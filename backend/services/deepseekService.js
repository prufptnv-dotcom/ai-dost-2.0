const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class DeepSeekService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.deepseek.com/v1',
            serviceName: 'DeepSeek',
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

    static async chat(message, history = [], customApiKey = null) {
        const instance = new DeepSeekService();
        return instance._chat(message, history, customApiKey);
    }

    async _chat(message, history = [], customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.DEEPSEEK_API_KEY;

            if (!API_KEY || API_KEY === 'your_deepseek_key') {
                logger.error('❌ DEEPSEEK API Key not found or still default!');
                return 'DeepSeek API key set nahi hai. Settings icon pe click karke apni custom key enter karein.';
            }

            const messages = [
                {
                    role: 'system',
                    content: `You are AI Dost, a powerful, state-of-the-art engineering companion and collaborative coding environment.
Here is what you can do and what features are available to the user on this platform:
1. Multi-file Monaco Code Editor: Write, edit, and read files seamlessly in real-time.
2. File Explorer: Create, rename, and delete nested files and folders dynamically in a tree structure.
3. Isolated Code Execution Sandbox: Execute Python, Node.js, and Go scripts securely inside Docker containers with immediate console log outputs.
4. Intelligent AI Code suggestions: Provide context-aware autocompletions (powered by Hugging Face models) in real-time.
5. Real-Time Collaboration: Support multi-user collaborative editing, cursor tracking, and presence syncing over raw WebSockets channels.
6. Git-like Version History: Auto-save snapshots and provide detailed file revision histories.
7. Profile Settings: Customize themes (vs-dark, vs-light), confidence thresholds, and user credentials.
8. Image Generation: If the user asks you to generate, draw, create, or make an image, graphic, or picture, respond ONLY with the tag: [GENERATE_IMAGE: descriptive prompt for the image] and nothing else.
Always present yourself as AI Dost, speak in a friendly and professional tone, and respond in the user's preferred language (Hindi, Hinglish, English, etc.).`
                },
                ...history,
                { role: 'user', content: message }
            ];

            const result = await this.client.post('/chat/completions', {
                model: 'deepseek-chat',
                messages: messages,
                temperature: 0.7
            }, {
                'Authorization': `Bearer ${API_KEY}`
            });

            logger.info('✅ DeepSeek response received');

            if (result.data.choices && result.data.choices[0] && result.data.choices[0].message) {
                return result.data.choices[0].message.content;
            } else {
                logger.error('❌ Unexpected DeepSeek API response structure:', result.data);
                return 'DeepSeek returned an unexpected response. Please try again.';
            }

        } catch (error) {
            logger.error('❌ DeepSeek Service Error:', error.message);

            if (error.message.includes('RATE_LIMIT')) {
                return 'DEEPSEEK_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'DEEPSEEK_CIRCUIT_OPEN';
            }

            return 'DeepSeek service me error: ' + error.message;
        }
    }
}

module.exports = DeepSeekService;