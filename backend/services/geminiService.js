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
                systemPrompt = `You are AI Dost, an ultra-intelligent Senior Software Engineer and Autonomous AI Assistant.
You are in General Chat Mode.
- Answer queries, generate images, explain concepts, or write complete, working applications and scripts.
- Autonomous Responsibility: Be confident, proactive, and authoritative. NEVER make excuses, lecture the user, or say things like "chhoti-chhoti cheezein miss ho jaati hain". Deliver complete, working solutions on the first attempt without requiring the user to manually debug or wire files together.
- Animation & Interactive UI (STRICT AUTONOMOUS RULE): When asked for an animation, game, canvas art, or interactive component, ALWAYS provide a SINGLE, COMPLETE, 100% SELF-CONTAINED HTML block with internal <style> and <script>. NEVER split into separate style.css or script.js files with external <link> or <script src="..."> that cause 404s or blank screens. Always place <script> at the end of <body> so all DOM/canvas elements are ready when the script runs.
- Do NOT talk about the workspace editor, "Apply Code" buttons, project files, sandbox execution, or Monaco panels in general chat mode.
- Image Generation: If the user asks you to generate, draw, create, or make an image, graphic, or picture, respond ONLY with the tag: [GENERATE_IMAGE: descriptive prompt for the image] and nothing else.
- PDF Generation: If the user asks you to generate, write, or export a PDF document or research paper, write the content of the PDF and wrap it inside the custom tags '[GENERATE_PDF: Title of Document]' and '[/GENERATE_PDF]'.
- Language & Grammar Rule (STRICT): Always respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching the exact language written by the user. Always use correct spelling and never write typos or broken words. Present yourself confidently as AI-Dost.`;
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

    // Vision analysis for screenshots
    async analyzeScreenshot(base64Image, mimeType = 'image/png', prompt = null) {
        try {
            const API_KEY = process.env.GEMINI_API_KEY;
            if (!API_KEY || API_KEY === 'your_gemini_key') {
                logger.error('❌ GEMINI API Key not found for vision analysis!');
                return { success: false, error: 'No API key', analysis: null };
            }

            const visionPrompt = prompt || `Analyze this UI screenshot for issues. Look for:

VISUAL & LAYOUT BUGS:
1. Broken layout: overlapping elements, misaligned content, broken grid/flex containers
2. Missing elements: navigation, buttons, forms, images, cards, modals, dropdowns
3. White/blank screens: empty pages, failed renders, missing content
4. Overflow issues: horizontal scroll, content cut off, text overflow

CSS GRID/FLEXBOX ISSUES:
5. Flex container not working: items not aligning, wrapping incorrectly
6. Grid layout broken: columns not matching, gaps missing, auto-fit issues
7. Centering problems: items not centered vertically/horizontally

RESPONSIVE DESIGN ISSUES:
8. Mobile breakpoints: content not adapting at <768px, <480px
9. Tablet/desktop layouts: content too wide/narrow, touch targets too small
10. Orientation issues: landscape vs portrait problems

ACCESSIBILITY ISSUES (WCAG):
11. Color contrast: text/background ratios below 4.5:1 (AA) or 3:1 (large text)
12. Missing alt text: images without descriptive alt attributes
13. Missing labels: form inputs without associated labels
14. Focus indicators: missing focus rings on interactive elements
14. ARIA issues: missing roles, states, live regions
15. Heading hierarchy: h1-h6 order violations

CONSOLE & RUNTIME ERRORS:
16. JavaScript errors visible in console
17. Network failures: failed API calls, 404s, CORS errors
18. Hydration mismatches (React/Next.js)
19. Missing dependencies: modules not found

LOADING & STATE ISSUES:
20. Missing loading states: spinners, skeletons, progress bars
21. Error boundaries: missing error fallbacks
22. Empty states: no empty list/placeholder UI

Return a JSON object with:
{
  "issues": ["specific issue with location/context", ...],
  "severity": "critical|major|minor|none",
  "suggestions": ["specific fix with CSS/JS code pattern", ...],
  "summary": "Brief summary of the UI state",
  "categories": {
    "layout": ["issue1", ...],
    "accessibility": ["issue1", ...],
    "responsive": ["issue1", ...],
    "console": ["issue1", ...],
    "loading": ["issue1", ...]
  }
}`;

            const contents = [{
                role: 'user',
                parts: [
                    { text: visionPrompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    }
                ]
            }];

            const bodyPayload = { 
                contents,
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json'
                }
            };

            const models = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
            let lastError = null;

            for (const model of models) {
                const endpoint = `/models/${model}:generateContent?key=${API_KEY}`;
                try {
                    // Add timeout wrapper to prevent hanging
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Vision request timeout')), 25000)
                    );
                    
                    const result = await Promise.race([
                        this.client.post(endpoint, bodyPayload),
                        timeoutPromise
                    ]);

                    logger.info(`✅ Gemini Vision response received (model: ${model})`);

                    if (result.data.candidates && result.data.candidates[0] && result.data.candidates[0].content) {
                        const responseText = result.data.candidates[0].content.parts[0].text;
                        try {
                            const analysis = JSON.parse(responseText);
                            return { success: true, analysis, rawResponse: responseText };
                        } catch (parseError) {
                            // Try to extract JSON from response
                            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                            if (jsonMatch) {
                                const analysis = JSON.parse(jsonMatch[0]);
                                return { success: true, analysis, rawResponse: responseText };
                            }
                            return { success: false, error: 'Failed to parse vision response', analysis: null, rawResponse: responseText };
                        }
                    } else {
                        return { success: false, error: 'No vision response content', analysis: null };
                    }
                } catch (error) {
                    lastError = error;
                    if (error.status === 429) {
                        logger.warn(`⚠️ Gemini Vision model ${model} rate limited, trying next...`);
                        continue;
                    }
                    if (error.status === 404) {
                        logger.warn(`⚠️ Gemini Vision model ${model} not available, trying next...`);
                        continue;
                    }
                    // Don't break on timeout, try next model
                    if (error.message?.includes('timeout')) {
                        logger.warn(`⚠️ Gemini Vision model ${model} timeout, trying next...`);
                        continue;
                    }
                    break;
                }
            }

            logger.error('❌ All Gemini Vision models failed');
            return { success: false, error: lastError?.message || 'Vision analysis failed', analysis: null };

        } catch (error) {
            logger.error('❌ Gemini Vision Error:', error.message);
            return { success: false, error: error.message, analysis: null };
        }
    }
}

module.exports = GeminiService;

// Add text-only generation for auto-fix
async function generateFixes(prompt) {
  const instance = new GeminiService();
  return instance._chat(prompt, [], null, 'project');
}

module.exports.generateFixes = generateFixes;