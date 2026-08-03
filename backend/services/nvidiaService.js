const logger = require('../logger');

class NvidiaService {
    static async chat(message, history = [], customApiKey = null, mode = 'project') {
        try {
            const API_KEY = customApiKey || process.env.NVIDIA_API_KEY;
            
            if (!API_KEY || API_KEY === 'your_nvidia_key') {
                logger.error('❌ NVIDIA API Key not found or still default!');
                return 'NVIDIA API key set nahi hai. settings icon pe click karke apni custom key enter karein.';
            }

            const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
            
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

            logger.info('🔄 Calling NVIDIA NIM API...');
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'meta/llama-3.1-70b-instruct',
                    messages: messagesPayload,
                    temperature: 0.1,
                    max_tokens: 2500
                }),
                signal: AbortSignal.timeout(10000) // 10 second fast timeout
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('❌ NVIDIA API Error:', response.status, errorText);
                return `NVIDIA API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            logger.info('✅ NVIDIA response received');

            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            } else {
                return 'NVIDIA returned an unexpected response.';
            }
        } catch (error) {
            logger.error('❌ NVIDIA Service Error:', error.message);
            return 'NVIDIA service me error: ' + error.message;
        }
    }
}

module.exports = NvidiaService;
