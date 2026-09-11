const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class HuggingFaceService {
    constructor() {
        const customModel = process.env.HUGGINGFACE_MODEL || process.env.HUGGINGFACE_ENDPOINT;
        let customUrl = null;

        if (customModel && customModel.trim()) {
            const trimmed = customModel.trim();
            customUrl = trimmed.startsWith('http')
                ? trimmed
                : `https://router.huggingface.co/hf-inference/models/${trimmed}`;
        }

        this.models = [
            ...(customUrl ? [customUrl] : []),
            'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.2',
            'https://router.huggingface.co/hf-inference/models/meta-llama/Llama-2-7b-chat-hf',
            'https://router.huggingface.co/hf-inference/models/tiiuae/falcon-7b-instruct'
        ];
        
        this.clients = this.models.map(modelUrl => new RobustApiClient({
            baseUrl: '',
            serviceName: `HuggingFace-${modelUrl.split('/').pop()}`,
            timeout: 30000,
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
        // If a custom model is configured, always try it first (index 0)
        const hasCustomModel = !!(process.env.HUGGINGFACE_MODEL || process.env.HUGGINGFACE_ENDPOINT);
        const startIndex = hasCustomModel ? 0 : Math.floor(Math.random() * this.models.length);
        
        for (let i = 0; i < this.models.length; i++) {
            const modelIndex = (startIndex + i) % this.models.length;
            const modelUrl = this.models[modelIndex];
            const client = this.clients[modelIndex];

            try {
                const API_KEY = process.env.HUGGINGFACE_API_KEY;
                const headers = { 'Content-Type': 'application/json' };

                if (API_KEY && API_KEY !== 'hf_your_key_here') {
                    headers['Authorization'] = `Bearer ${API_KEY}`;
                }

                logger.info(`🔄 Calling Hugging Face API with model: ${modelUrl}...`);

                // Check if target is a Gradio Space API endpoint
                const isGradio = modelUrl.includes('.hf.space') || modelUrl.endsWith('/api/predict');
                const requestPayload = isGradio
                    ? { data: [message] }
                    : {
                        inputs: `<|user|>\n${message}\n<|assistant|>\n`,
                        parameters: {
                            max_new_tokens: 500,
                            temperature: 0.7
                        },
                        options: {
                            wait_for_model: true,
                            use_cache: false
                        }
                    };

                const result = await client.post(modelUrl, requestPayload, headers);

                logger.info('✅ Hugging Face response received');

                // 1. Standard Hugging Face Serverless response: [{ generated_text: ... }]
                if (Array.isArray(result.data) && result.data[0] && result.data[0].generated_text) {
                    const text = result.data[0].generated_text;
                    return text.split('<|assistant|>')[1] || text;
                }
                // 2. Gradio Space response: { data: ["..."] }
                if (result.data && Array.isArray(result.data.data) && result.data.data[0]) {
                    return String(result.data.data[0]).trim();
                }
                // 3. OpenAI-compatible format: { choices: [{ message: { content: ... } }] }
                if (result.data && Array.isArray(result.data.choices) && result.data.choices[0]?.message?.content) {
                    return result.data.choices[0].message.content.trim();
                }
                // 4. Direct generated text string or error check
                if (result.data && typeof result.data.generated_text === 'string') {
                    return result.data.generated_text.split('<|assistant|>')[1] || result.data.generated_text;
                }

                if (result.data && result.data.error) {
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