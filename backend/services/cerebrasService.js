const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class CerebrasService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.cerebras.ai/v1',
            serviceName: 'Cerebras',
            timeout: 60000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 25,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 8,
                timeout: 60000
            }
        });
    }

    static async chat(message, history = [], mode = 'project', customApiKey = null) {
        const instance = new CerebrasService();
        return instance._chat(message, history, mode, customApiKey);
    }

    async _chat(message, history = [], mode = 'project', customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.CEREBRAS_API_KEY;

            if (!API_KEY || API_KEY === 'your_cerebras_key_here') {
                logger.error('❌ CEREBRAS API Key not found!');
                return 'Cerebras API key set nahi hai. CerebrasSettings ke liye .env me CEREBRAS_API_KEY add karein (cerebras.ai/cloud se free key milegi).';
            }

            let systemPrompt = '';
            if (mode === 'chat') {
                systemPrompt = `You are AI-Dost, an ultra-intelligent Senior Software Engineer and Autonomous AI Assistant.
Key Response Guidelines:
1. Language & Grammar: Respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching user preference.
2. Tone & Autonomous Authority: Be confident, professional, concise, and proactive. NEVER make excuses, lecture the user, or say things like "chhoti-chhoti cheezein miss ho jaati hain". Deliver verified, working solutions on the first attempt without requiring manual user debugging.
3. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: If user asks for an image, drawing, photo, or picture (e.g. "image banao", "photo of sunset"), MUST include tag \`[GENERATE_IMAGE: detailed English description]\` in response!
   - PDF / DOCUMENT: If user asks for a report, PDF, resume, or document, format response as \`[GENERATE_PDF: Document Title] Full Markdown Content [/GENERATE_PDF]\`.
   - EMAIL WRITING: Format email requests with a clear "Subject:" and structured email body.
   - ANIMATION & VISUAL APPS (STRICT AUTONOMOUS RULE):
     * When asked for an animation, game, canvas art, or interactive UI, ALWAYS provide a SINGLE, COMPLETE, 100% SELF-CONTAINED HTML block wrapped in \`\`\`html ... \`\`\` with internal <style> and <script> placed at the end of <body>. ZERO external CSS/JS dependencies.
     * HIGH-FIDELITY CREATIVE ART MANDATE: NEVER draw crude stick figures, simple circles, or elementary lines for deities, characters, or art. Use multi-segment Bezier/quadratic curves (bezierCurveTo, quadraticCurveTo) for organic silhouettes, glowing neon bloom (shadowBlur: 25-50px, shadowColor, globalCompositeOperation: 'lighter'), sacred iconography (for Lord Krishna: radiant forehead Tilak, glowing peacock feather with gradient eye, spinning Sudarshan Chakra on index finger with light rays and sparks, flowing celestial drapes, stardust particle field), and a smooth requestAnimationFrame loop with high-DPI scaling.
   - CODE & EXPLANATION: Write production-grade code in markdown codeblocks with clear step-by-step explanations.`;
            } else if (mode === 'project') {
                systemPrompt = `You are AI-Dost, a state-of-the-art Senior Software Engineer and Autonomous Coding Companion in Project Workspace Mode.
Key Response Guidelines:
1. Write clean, optimal, production-grade code snippets wrapped inside markdown code blocks.
2. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: Include \`[GENERATE_IMAGE: detailed English description]\` when images are requested.
   - PDF / DOCUMENT: Format printable documents as \`[GENERATE_PDF: Title] Content [/GENERATE_PDF]\`.
3. Language & Grammar: Respond in clean, natural, grammatically flawless language matching user preference.`;
            } else if (mode === 'agent') {
                systemPrompt = '';
            }

            const messagesPayload = [];
            if (systemPrompt) {
                messagesPayload.push({ role: 'system', content: systemPrompt });
            }
            if (history && history.length > 0) {
                history.forEach(h => {
                    messagesPayload.push({ role: h.role, content: h.content });
                });
            }
            messagesPayload.push({ role: 'user', content: message });

            const primaryModel = 'gpt-oss-120b';
            const fallbackModel = 'zai-glm-4.7';

            const tryModel = async (model) => {
                try {
                    const result = await this.client.post('/chat/completions', {
                        model,
                        messages: messagesPayload,
                        temperature: 0.1,
                        max_tokens: 8192
                    }, {
                        'Authorization': `Bearer ${API_KEY}`
                    });

                    return result.data.choices[0].message.content;
                } catch (error) {
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
                logger.info(`🔄 Calling Cerebras API with model: ${primaryModel}`);
                return await tryModel(primaryModel);
            } catch (primaryError) {
                if (primaryError.message.includes('RATE_LIMIT') || primaryError.message.includes('429')) {
                    logger.info('⚠️ Cerebras rate limited on primary model, retrying with fallback model...');
                    try {
                        return await tryModel(fallbackModel);
                    } catch (fallbackError) {
                        throw new Error('RATE_LIMIT_EXCEEDED: Both Cerebras models rate limited');
                    }
                }
                throw primaryError;
            }

        } catch (error) {
            logger.error('❌ Cerebras Service Error:', error.message);

            if (error.message.includes('RATE_LIMIT')) {
                return 'CEREBRAS_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'CEREBRAS_CIRCUIT_OPEN';
            }

            return 'Cerebras service me error: ' + error.message;
        }
    }
}

module.exports = CerebrasService;