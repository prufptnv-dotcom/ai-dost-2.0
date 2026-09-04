const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class OpenAIService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.openai.com/v1',
            serviceName: 'OpenAI',
            timeout: 60000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 500,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 10,
                timeout: 30000
            }
        });
    }

    static async chat(message, history = [], mode = 'project', customApiKey = null) {
        const instance = new OpenAIService();
        return instance._chat(message, history, mode, customApiKey);
    }

    async _chat(message, history = [], mode = 'project', customApiKey = null) {
        try {
            const API_KEY = customApiKey || process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY;

            if (!API_KEY || API_KEY === 'sk_your_key_here') {
                logger.error('❌ OpenAI API Key not found or still default!');
                return 'OpenAI API key set nahi hai. Settings me apni OpenAI key enter karein.';
            }

            let systemPrompt = '';
            if (mode === 'chat') {
                systemPrompt = `You are AI-Dost, an ultra-intelligent Senior Software Engineer and Autonomous AI Assistant powered by OpenAI GPT-4o.
Key Response Guidelines:
1. Language & Grammar: Respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching user preference.
2. Tone & Autonomous Authority: Be confident, professional, concise, and proactive. NEVER make excuses, lecture the user, or say things like "chhoti-chhoti cheezein miss ho jaati hain". Deliver verified, working solutions on the first attempt without requiring manual user debugging.
3. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: If user asks for an image, drawing, photo, or picture, MUST include tag \`[GENERATE_IMAGE: detailed English description]\` in response!
   - PDF / DOCUMENT: If user asks for a report, PDF, resume, or document, format response as \`[GENERATE_PDF: Document Title] Full Markdown Content [/GENERATE_PDF]\`.
   - ANIMATION & VISUAL APPS (STRICT AUTONOMOUS RULE):
     * When asked for an animation, game, canvas art, or interactive UI, ALWAYS provide a SINGLE, COMPLETE, 100% SELF-CONTAINED HTML block wrapped in \`\`\`html ... \`\`\` with internal <style> and <script> placed at the end of <body>. ZERO external CSS/JS dependencies.
     * HIGH-FIDELITY CREATIVE ART MANDATE: NEVER draw crude stick figures, simple circles, or elementary lines for deities, characters, or art. Use multi-segment Bezier/quadratic curves (bezierCurveTo, quadraticCurveTo) for organic silhouettes, glowing neon bloom (shadowBlur: 25-50px, shadowColor, globalCompositeOperation: 'lighter'), sacred iconography (for Lord Krishna: radiant forehead Tilak, glowing peacock feather with gradient eye, spinning Sudarshan Chakra on index finger with light rays and sparks, flowing celestial drapes, stardust particle field), and a smooth requestAnimationFrame loop with high-DPI scaling.
   - CODE & EXPLANATION: Write production-grade code in markdown codeblocks with clear step-by-step explanations.`;
            } else if (mode === 'project') {
                systemPrompt = `You are AI-Dost, a state-of-the-art Senior Software Engineer and Autonomous Coding Companion in Project Workspace Mode powered by OpenAI GPT-4o.
1. Write clean, optimal, production-grade code snippets wrapped inside markdown code blocks.
2. Multimodal Intent Fulfillments: Include \`[GENERATE_IMAGE: detailed English description]\` when images are requested.
3. Language & Grammar: Respond in clean, natural, grammatically flawless language matching user preference.`;
            } else if (mode === 'agent') {
                systemPrompt = 'You are an autonomous code generation engine powered by OpenAI GPT-4o. Do NOT call tools. Write complete, functional production code for each file requested.';
            }

            const messagesPayload = [];
            if (systemPrompt) {
                messagesPayload.push({ role: 'system', content: systemPrompt });
            }

            if (Array.isArray(history) && history.length > 0) {
                for (const h of history) {
                    messagesPayload.push({
                        role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
                        content: h.parts && Array.isArray(h.parts) ? h.parts.map(p => p.text || '').join('\n') : (h.content || '')
                    });
                }
            }

            messagesPayload.push({ role: 'user', content: message });

            const response = await this.client.post('/chat/completions', {
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: messagesPayload,
                temperature: 0.3,
                max_tokens: 4096
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.choices && response.data.choices[0]?.message?.content) {
                return response.data.choices[0].message.content;
            }

            throw new Error('OpenAI response format unrecognized');
        } catch (error) {
            logger.error(`❌ OpenAI Service Error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = OpenAIService;
