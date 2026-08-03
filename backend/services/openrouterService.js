class OpenRouterService {
    static async chat(message, history = [], customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.OPENROUTER_API_KEY;
            
            if (!API_KEY) {
                logger.error('❌ OpenRouter API Key not found!');
                return 'OpenRouter API key set nahi hai. settings icon pe click karke apni custom key enter karein.';
            }

            const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
            
            const messages = [
                { 
                    role: 'system', 
                    content: `You are AI-Dost, an expert Senior Software Engineer and AI Assistant.
Write clean, optimal, production-grade code wrapped inside markdown code blocks.` 
                },
                ...history,
                { role: 'user', content: message }
            ];
            
            logger.info('🔄 Calling OpenRouter API...');
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'AI-Dost'
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3.1-8b-instruct',
                    messages: messages,
                    temperature: 0.2,
                    max_tokens: 2500
                }),
                signal: AbortSignal.timeout(10000)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('❌ OpenRouter API Error:', response.status, errorText);
                return `OpenRouter API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            logger.info('✅ OpenRouter response received');

            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            } else {
                return 'OpenRouter returned empty content.';
            }
        } catch (error) {
            logger.error('❌ OpenRouter Service Error:', error.message);
            return 'OpenRouter service error: ' + error.message;
        }
    }
}

module.exports = OpenRouterService;
