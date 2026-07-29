class OpenRouterService {
    static async chat(message, history = [], customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.OPENROUTER_API_KEY;
            
            if (!API_KEY || API_KEY === 'your_openrouter_key') {
                console.error('❌ OpenRouter API Key not found or still default!');
                return 'OpenRouter API key set nahi hai. settings icon pe click karke apni custom key enter karein.';
            }

            const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
            
            const messages = [
                { 
                    role: 'system', 
                    content: `You are AI Dost, a powerful, state-of-the-art engineering companion and collaborative coding environment.
Always present yourself as AI Dost, speak in a friendly and professional tone, and respond in the user's preferred language (Hindi, Hinglish, English, etc.).
- Image Generation: If the user asks you to generate, draw, create, or make an image, graphic, or picture, respond ONLY with the tag: [GENERATE_IMAGE: descriptive prompt for the image] and nothing else.
- PDF Generation: If the user asks you to generate, write, or export a PDF document or research paper, write the content of the PDF and wrap it inside the custom tags '[GENERATE_PDF: Title of Document]' and '[/GENERATE_PDF]'. For example: '[GENERATE_PDF: History of Bihar]\nBihar has a rich history...\n[/GENERATE_PDF]'. The platform will automatically compile it and give the user a clickable download button link.` 
                },
                ...history,
                { role: 'user', content: message }
            ];
            
            console.log('🔄 Calling OpenRouter API...');
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3-8b-instruct',
                    messages: messages,
                    max_tokens: 2048
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ OpenRouter API Error:', response.status, errorText);
                return `OpenRouter API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            console.log('✅ OpenRouter response received');

            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content;
            } else {
                console.error('❌ Unexpected OpenRouter API response structure:', data);
                return 'OpenRouter returned an unexpected response. Please try again.';
            }
        } catch (error) {
            console.error('❌ OpenRouter Service Error:', error.message);
            return 'OpenRouter service me error: ' + error.message;
        }
    }
}

module.exports = OpenRouterService;
