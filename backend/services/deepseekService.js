const logger = require('../logger');
class DeepSeekService {
    static async chat(message, history = [], customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.DEEPSEEK_API_KEY;
            
            if (!API_KEY || API_KEY === 'your_deepseek_key') {
                logger.error('❌ DEEPSEEK API Key not found or still default!');
                return 'DeepSeek API key set nahi hai. settings icon pe click karke apni custom key enter karein.';
            }

            const API_URL = 'https://api.deepseek.com/v1/chat/completions';
            
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
            
            logger.info('🔄 Calling DeepSeek API...');
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(8000),
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('❌ DeepSeek API Error:', response.status, errorText);
                return `DeepSeek API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            logger.info('✅ DeepSeek response received');

            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            } else {
                logger.error('❌ Unexpected DeepSeek API response structure:', data);
                return 'DeepSeek returned an unexpected response. Please try again.';
            }
        } catch (error) {
            logger.error('❌ DeepSeek Service Error:', error.message);
            return 'DeepSeek service me error: ' + error.message;
        }
    }
}

module.exports = DeepSeekService;
