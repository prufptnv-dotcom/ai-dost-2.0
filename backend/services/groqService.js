const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class GroqService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.groq.com/openai/v1',
            serviceName: 'Groq',
            timeout: 60000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 500, // Unlimited for personal project
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 10,
                timeout: 30000
            }
        });
    }

    static async chat(message, history = [], mode = 'project', customApiKey = null) {
        const instance = new GroqService();
        return instance._chat(message, history, mode, customApiKey);
    }

    async _chat(message, history = [], mode = 'project', customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.GROQ_API_KEY;

            if (!API_KEY || API_KEY === 'gsk_your_key_here') {
                logger.error('❌ GROQ API Key not found or still default!');
                return 'Groq API key set nahi hai. Settings icon pe click karke apni custom key enter karein.';
            }

            let systemPrompt = '';
            if (mode === 'chat') {
                systemPrompt = `You are AI-Dost, an ultra-intelligent Senior Software Engineer and Autonomous AI Assistant.
Key Response Guidelines:
1. Language & Grammar: Respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching user preference.
2. Tone & Autonomous Authority: Be confident, professional, concise, and proactive. NEVER make excuses, lecture the user, or say things like "chhoti-chhoti cheezein miss ho jaati hain". As an autonomous system, you take full responsibility for delivering verified, working solutions on the first attempt without requiring the user to debug or assemble basic wiring.
3. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: If user asks for an image, drawing, photo, or picture (e.g. "image banao", "photo of sunset"), MUST include tag \`[GENERATE_IMAGE: detailed English description]\` in response!
   - PDF / DOCUMENT: If user asks for a report, PDF, resume, or document, format response as \`[GENERATE_PDF: Document Title] Full Markdown Content [/GENERATE_PDF]\`.
   - EMAIL WRITING: Format email requests with a clear "Subject:" and structured email body.
   - ANIMATION & VISUAL APPS (STRICT AUTONOMOUS RULE):
      * When asked for an animation, game, canvas art, or interactive UI, ALWAYS provide a SINGLE, COMPLETE, 100% SELF-CONTAINED HTML block wrapped in \`\`\`html ... \`\`\` with internal <style> and <script> placed at the end of <body>. ZERO external CSS/JS dependencies.
      * HIGH-FIDELITY CREATIVE ART MANDATE: NEVER draw crude stick figures, simple circles, or elementary lines for deities, characters, or art. Use multi-segment Bezier/quadratic curves (bezierCurveTo, quadraticCurveTo) for organic silhouettes, glowing neon bloom (shadowBlur: 25-50px, shadowColor, globalCompositeOperation: 'lighter'), sacred iconography (for Lord Krishna: radiant forehead Tilak, glowing peacock feather with gradient eye, spinning Sudarshan Chakra on index finger with light rays and sparks, flowing celestial drapes, stardust particle field), and a smooth requestAnimationFrame loop with high-DPI scaling.
   - CODE & EXPLANATION: Write production-grade code in markdown codeblocks with clear, concise explanations.`;
            } else if (mode === 'project') {
                systemPrompt = `You are AI-Dost, a state-of-the-art Senior Software Engineer and Autonomous Coding Companion in Project Workspace Mode.
Key Response Guidelines:
1. Write clean, optimal, production-grade code snippets wrapped inside markdown code blocks.
2. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: Include \`[GENERATE_IMAGE: detailed English description]\` when images are requested.
   - PDF / DOCUMENT: Format printable documents as \`[GENERATE_PDF: Title] Content [/GENERATE_PDF]\`.
3. Language & Grammar: Respond in clean, natural, grammatically flawless language matching user preference.`;
            } else if (mode === 'agent') {
                systemPrompt = 'You are an autonomous code generation engine. Do NOT call tools. Write complete, functional production code for each file requested.';
            }

            const messagesPayload = [];
            let hasImage = false;
            
            const processContent = (text) => {
                if (typeof text !== 'string') return text;
                const imgRegex = /\[IMAGE_BASE64:([^\]]+)\]/g;
                if (!imgRegex.test(text)) return text;
                
                hasImage = true;
                const parts = [];
                let lastIndex = 0;
                let match;
                
                // Reset regex state just in case
                imgRegex.lastIndex = 0;
                
                while ((match = imgRegex.exec(text)) !== null) {
                    if (match.index > lastIndex) {
                        parts.push({ type: 'text', text: text.substring(lastIndex, match.index) });
                    }
                    // Extract base64 and append as image_url
                    parts.push({
                        type: 'image_url',
                        image_url: { url: `data:image/png;base64,${match[1]}` }
                    });
                    lastIndex = imgRegex.lastIndex;
                }
                
                if (lastIndex < text.length) {
                    parts.push({ type: 'text', text: text.substring(lastIndex) });
                }
                
                return parts;
            };

            if (systemPrompt) {
                messagesPayload.push({ role: 'system', content: systemPrompt });
            }
            if (history && history.length > 0) {
                history.forEach(h => {
                    messagesPayload.push({ role: h.role, content: processContent(h.content) });
                });
            }
            messagesPayload.push({ role: 'user', content: processContent(message) });

            let primaryModel = 'openai/gpt-oss-20b';
            if (hasImage) {
                primaryModel = 'openai/gpt-oss-20b';
            }
            const fallbackModel = 'qwen/qwen3.8-27b';

            const MAX_OUTPUT_TOKENS = {
                'openai/gpt-oss-20b': 4096,
                'qwen/qwen3.8-27b': 4096,
                'openai/gpt-oss-120b': 2048,
                'qwen/qwen3.6-27b': 4096,
            };
            const maxTokensFor = (model) => MAX_OUTPUT_TOKENS[model] || 4096;

            const tryModel = async (model) => {
                try {
                    const result = await this.client.post('/chat/completions', {
                        model,
                        messages: messagesPayload,
                        temperature: 0.1,
                        max_tokens: maxTokensFor(model)
                    }, {
                        'Authorization': `Bearer ${API_KEY}`
                    });

                    // New client throws on error, so if we get here, it's success
                    return result.data.choices[0].message.content;
                } catch (error) {
                    // Convert thrown error to result format for compatibility
                    if (error.status === 429 && error.retryable) {
                        throw new Error(`RATE_LIMIT: ${error.message}`);
                    }
                    if (error.lastError) {
                        const le = error.lastError;
                        throw new Error(`${le.status}: ${le.message}`);
                    }
                    throw new Error(`${error.status || 500}: ${error.message}`);
                }
            };

            try {
                logger.info(`🔄 Calling Groq API with model: ${primaryModel}`);
                return await tryModel(primaryModel);
            } catch (primaryError) {
                if (primaryError.message.includes('RATE_LIMIT') && primaryModel !== fallbackModel) {
                    logger.info('⚠️ Groq rate limited on primary model, retrying with fallback model...');
                    try {
                        return await tryModel(fallbackModel);
                    } catch (fallbackError) {
                        if (fallbackError.message.includes('RATE_LIMIT')) {
                            throw new Error('RATE_LIMIT_EXCEEDED: Both primary and fallback models rate limited');
                        }
                        throw fallbackError;
                    }
                }
                throw primaryError;
            }

        } catch (error) {
            logger.error('❌ Groq Service Error:', error.message);
            
            if (error.message.includes('RATE_LIMIT')) {
                return 'GROQ_RATE_LIMITED';
            }
            
            if (error.message.includes('Circuit breaker')) {
                return 'GROQ_CIRCUIT_OPEN';
            }
            
            return 'Groq service me error: ' + error.message;
        }
    }
}

module.exports = GroqService;