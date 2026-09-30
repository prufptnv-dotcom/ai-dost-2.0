const logger = require('../logger');

/**
 * vllmService.js
 * 
 * High-performance inference connector for vLLM or TensorRT-LLM.
 * Connects to OpenAI-compatible local/remote endpoints that serve models
 * using advanced techniques like Speculative Decoding, PagedAttention, etc.
 */
class VllmService {
    constructor() {
        // Assume default vLLM server runs on port 8000
        this.baseUrl = process.env.VLLM_BASE_URL || 'http://localhost:8000/v1';
        this.apiKey = process.env.VLLM_API_KEY || 'dummy-key';
        this.modelName = process.env.VLLM_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
    }

    /**
     * Checks if the vLLM server is reachable
     */
    async isAvailable() {
        try {
            const res = await fetch(`${this.baseUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
                signal: AbortSignal.timeout(2000)
            });
            return res.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Executes a chat completion query on the vLLM server
     */
    async chat(message, history = [], fileContent = '') {
        try {
            const messages = [...history];
            
            if (fileContent) {
                messages.push({ role: 'user', content: `File content:\n${fileContent}\n\nUser message: ${message}` });
            } else {
                messages.push({ role: 'user', content: message });
            }

            const payload = {
                model: this.modelName,
                messages: messages,
                // Advanced Inference Parameters for Speculative Decoding & Quality
                temperature: 0.7,
                top_p: 0.95,
                presence_penalty: 0.1,
                frequency_penalty: 0.1,
                max_tokens: 4096,
                stream: false
            };

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`vLLM Error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            logger.error('vLLM Inference Error:', error);
            throw error;
        }
    }
}

module.exports = new VllmService();
