const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');
const { exec } = require('child_process');

class GeminiService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            serviceName: 'Gemini',
            timeout: 60000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 500, // Increased for personal unlimited use
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 10,
                timeout: 30000
            }
        });
        this.ollamaAvailable = false;
    }

    async checkOllamaAvailability() {
        try {
            await new Promise((resolve, reject) => {
                exec('curl -s http://localhost:11434/api/tags', (error, stdout, stderr) => {
                    if (!error && stdout.includes('models')) {
                        this.ollamaAvailable = true;
                        logger.info('✅ Ollama local model server available');
                    } else {
                        this.ollamaAvailable = false;
                    }
                    resolve();
                });
            });
        } catch (e) {
            this.ollamaAvailable = false;
            logger.warn('⚠️ Ollama not available - will use cloud-only mode');
        }
    }

    static async chat(message, history = [], fileContent = null, mode = 'project', customApiKey = null) {
        const instance = new GeminiService();
        return instance._chat(message, history, fileContent, mode, customApiKey);
    }

    async _chat(message, history = [], fileContent = null, mode = 'project', customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.GEMINI_API_KEY;
            if (!API_KEY || API_KEY === 'your_gemini_key') {
                logger.error('❌ GEMINI API Key not found or still default!');
                return 'Gemini API key set nahi hai. Settings icon pe click karke apni custom key enter karein.';
            }

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
            } else if (mode === 'project') {
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
            } else if (mode === 'agent') {
                systemPrompt = '';
            }

            const bodyPayload = { contents };
            if (systemPrompt) {
                bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
            }

            // Try multiple models in order — free tier quota varies per model/key
            const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
            let lastError = null;

            for (const model of models) {
                const endpoint = `/models/${model}:generateContent?key=${API_KEY}`;
                try {
                    const result = await this.client.post(endpoint, bodyPayload);

                    logger.info(`✅ Gemini response received (model: ${model})`);

                    if (result.data.candidates && result.data.candidates[0] && result.data.candidates[0].content) {
                        return result.data.candidates[0].content.parts[0].text;
                    } else {
                        return 'Gemini response decode nahi ho paya.';
                    }
                } catch (error) {
                    lastError = error;
                    if (error.status === 429) {
                        logger.warn(`⚠️ Gemini model ${model} rate limited, trying next model...`);
                        continue;
                    }
                    if (error.status === 404) {
                        logger.warn(`⚠️ Gemini model ${model} not available, trying next model...`);
                        continue;
                    }
                    // Non-retryable error — break and report
                    break;
                }
            }

            // All Gemini models failed - try Ollama local model fallback
            if (this.ollamaAvailable) {
                try {
                    logger.info('🔄 Falling back to Ollama local model...');
                    const ollamaPrompt = message;
                    const ollamaBody = {
                        model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b',
                        prompt: ollamaPrompt,
                        stream: false
                    };

                    const ollamaResult = await new Promise((resolve, reject) => {
                        exec(`curl -s -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d '${JSON.stringify(ollamaBody)}'`, (error, stdout, stderr) => {
                            if (error) {
                                reject(error);
                                return;
                            }
                            try {
                                const parsed = JSON.parse(stdout);
                                resolve(parsed.response || stdout);
                            } catch (e) {
                                reject(new Error('Ollama response parse error'));
                            }
                        });
                    });

                    logger.info('✅ Ollama local model response received');
                    return ollamaResult;
                } catch (ollamaError) {
                    logger.error('❌ Ollama fallback failed:', ollamaError.message);
                }
            }

            // All fallbacks exhausted - report error
            logger.error('❌ All Gemini models and Ollama fallback failed');
            if (lastError?.status === 429) {
                throw new Error('RATE_LIMIT: ' + lastError.message);
            }
            if (lastError?.lastError) {
                const le = lastError.lastError;
                logger.error('❌ Gemini API Error:', le.status, le.message);
                throw new Error(`${le.status}: ${le.message}`);
            }
            logger.error('❌ Gemini API Error:', lastError?.status || 500, lastError?.message);
            throw new Error(`${lastError?.status || 500}: ${lastError?.message}`);

        } catch (error) {
            logger.error('❌ Gemini Service Error:', error.message);

            if (error.message.includes('RATE_LIMIT')) {
                return 'GEMINI_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'GEMINI_CIRCUIT_OPEN';
            }

            return 'Gemini service me error: ' + error.message;
        }
    }
}

module.exports = GeminiService;