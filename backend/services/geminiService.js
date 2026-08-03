const logger = require('../logger');
class GeminiService {
    static async chat(message, history = [], fileContent = null, mode = 'project', customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.GEMINI_API_KEY;
            if (!API_KEY || API_KEY === 'your_gemini_key') {
                logger.error('❌ GEMINI API Key not found or still default!');
                return 'Gemini API key set nahi hai. settings icon pe click karke apni custom key enter karein.';
            }

            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
            
            // Build Gemini contents array containing history
            const contents = [];
            
            if (history && history.length > 0) {
                history.forEach(item => {
                    contents.push({
                        role: item.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: item.content || '' }]
                    });
                });
            }
            
            const currentParts = [{ text: message }];
            if (fileContent) {
                currentParts.unshift({ text: `File content: ${fileContent}` });
            }
            
            contents.push({
                role: 'user',
                parts: currentParts
            });
            
            logger.info('🔄 Calling Gemini API...');
            
            let systemPrompt = '';
            if (mode === 'chat') {
                systemPrompt = `You are AI Dost, a friendly and helpful general coding assistant.
You are in General Chat Mode.
- Answer queries, generate images, explain concepts, or write standalone scripts.
- Speak in a friendly, conversational tone.
- Do NOT talk about the workspace editor, "Apply Code" buttons, project files, sandbox execution, or Monaco panels. Keep the conversation focused purely on general chat and coding help in the chat itself.
- Image Generation: If the user asks you to generate, draw, create, or make an image, graphic, or picture, respond ONLY with the tag: [GENERATE_IMAGE: descriptive prompt for the image] and nothing else.
- PDF Generation: If the user asks you to generate, write, or export a PDF document or research paper, write the content of the PDF and wrap it inside the custom tags '[GENERATE_PDF: Title of Document]' and '[/GENERATE_PDF]'. For example: '[GENERATE_PDF: History of Bihar]\nBihar has a rich history...\n[/GENERATE_PDF]'. The platform will automatically compile it and give the user a clickable download button link.
- Language & Grammar Rule (STRICT): Always respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching the exact language written by the user. Always use correct spelling and never write typos or broken words. Present yourself confidently as AI-Dost. Never output generic self-deprecating system error disclaimers unless explicitly asked to debug broken code.`;
            } else {
                systemPrompt = `You are AI Dost, a powerful, state-of-the-art engineering companion and collaborative coding environment.
You are in Project Workspace Mode.
Here is what you can do and what features are available to the user on this platform:
1. Multi-file Monaco Code Editor: Write, edit, and read files seamlessly in real-time.
2. File Explorer: Create, rename, and delete nested files and folders dynamically in a tree structure.
3. Isolated Code Execution Sandbox: Execute Python, Node.js, and Go scripts securely inside containers with immediate console outputs.
4. Intelligent AI Code suggestions: Provide context-aware autocompletions in real-time.
5. Real-Time Collaboration: Support multi-user collaborative editing, cursor tracking, and presence syncing over WebSockets channels.
6. Git-like Version History: Auto-save snapshots and provide detailed file revision histories.
7. Profile Settings: Customize themes, confidence thresholds, and user credentials.
8. Image Generation: If the user asks you to generate, draw, create, or make an image, graphic, or picture, respond ONLY with the tag: [GENERATE_IMAGE: descriptive prompt for the image] and nothing else.
9. Code Integration: If you write or update code, write it inside a markdown code block (e.g. \`\`\`python ... \`\`\`).
10. PDF Generation: If the user asks you to generate, write, or export a PDF document or research paper, write the content inside tags '[GENERATE_PDF: Title]' and '[/GENERATE_PDF]'.
11. Language & Grammar Rule (STRICT): Always respond in clean, natural, grammatically flawless language matching the user's prompt. Never write typos, broken words, or self-deprecating system disclaimers. Always present yourself as an expert Senior Software Engineer AI.`;
            }

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: contents,
                    systemInstruction: {
                        parts: [{
                            text: systemPrompt
                        }]
                    }
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('❌ Gemini API Error:', response.status, errorText);
                return `Gemini API error (${response.status}): ${errorText}`;
            }

            const data = await response.json();
            logger.info('✅ Gemini response received');

            if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
                return data.candidates[0].content.parts[0].text;
            } else {
                logger.error('❌ Unexpected Gemini API response structure:', data);
                return 'Gemini returned an unexpected response. Please try again.';
            }
        } catch (error) {
            logger.error('❌ Gemini Service Error:', error.message);
            return 'Gemini service me error: ' + error.message;
        }
    }
}

module.exports = GeminiService;
