const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class HuggingFaceService {
    constructor() {
        this.models = [
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2',
            'https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf',
            'https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct'
        ];
        
        this.clients = this.models.map(modelUrl => new RobustApiClient({
            baseUrl: '',
            serviceName: `HuggingFace-${modelUrl.split('/').pop()}`,
            timeout: 20000,
            maxRetries: 2,
            retryDelay: 2000,
            rateLimiter: {
                maxRequests: 10,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 3,
                timeout: 120000
            }
        }));
    }

    static async chat(message) {
        const instance = new HuggingFaceService();
        return instance._chat(message);
    }

    async _chat(message) {
        const randomModelIndex = Math.floor(Math.random() * this.models.length);
        
        for (let i = 0; i < this.models.length; i++) {
            const modelIndex = (randomModelIndex + i) % this.models.length;
            const modelUrl = this.models[modelIndex];
            const client = this.clients[modelIndex];

            try {
                const API_KEY = process.env.HUGGINGFACE_API_KEY;
                const headers = { 'Content-Type': 'application/json' };

                if (API_KEY && API_KEY !== 'hf_your_key_here') {
                    headers['Authorization'] = `Bearer ${API_KEY}`;
                }

                logger.info(`🔄 Calling Hugging Face API with model: ${modelUrl}...`);

                const result = await client.post(modelUrl, {
                    inputs: `<|user|>\n${message}\n<|assistant|>\n`,
                    parameters: {
                        max_new_tokens: 500,
                        temperature: 0.7
                    }
                }, headers);

                logger.info('✅ Hugging Face response received');

                if (Array.isArray(result.data) && result.data[0] && result.data[0].generated_text) {
                    return result.data[0].generated_text.split('<|assistant|>')[1] || result.data[0].generated_text;
                } else if (result.data.error) {
                    logger.error('❌ Hugging Face returned error:', result.data.error);
                    continue;
                } else {
                    logger.error('❌ Unexpected Hugging Face API response structure:', result.data);
                    continue;
                }
            } catch (error) {
                if (error.status === 429 && error.retryable) {
                    logger.warn(`⚠️ Hugging Face model rate limited, trying next model...`);
                    continue;
                }
                logger.error('❌ Hugging Face Service Error:', error.message);
                continue;
            }
        }

        return 'Hugging Face: All models unavailable. Please try again later.';
    }
}

module.exports = HuggingFaceService;