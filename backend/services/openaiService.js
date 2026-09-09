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

## INTENT DETECTION — MOST IMPORTANT RULE:
Before responding, first identify what the user actually wants:
- QUESTION / INFO REQUEST ("kya hai", "kaise", "batao", "explain", "difference", "tips", "what is", "how to", "ke bare mein batao", "samjhao") → Give a clear, helpful TEXT ANSWER. Do NOT generate any document, resume, or file.
- EXPLICIT CREATION REQUEST ("banao", "bana do", "create", "generate", "likhdo", "draft karo", "chahiye", "make me", "write me", "taiyar karo") → Then generate as requested.
- Examples:
  - "resume kaise banate hain?" → Answer the question in text. Do NOT generate a resume.
  - "mera resume banao" → Generate a resume.
  - "resume ke tips kya hain?" → Give tips in text. Do NOT generate a resume.
  - "AST parsing algorithm kya hai?" → Explain the algorithm. Do NOT create a document.

1. Language & Grammar: Respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching user preference.
2. Tone & Autonomous Authority: Be confident, professional, concise, and proactive. NEVER make excuses, lecture the user, or say things like "chhoti-chhoti cheezein miss ho jaati hain". Deliver verified, working solutions on the first attempt without requiring manual user debugging.
3. Multimodal Intent Fulfillments (ONLY when user EXPLICITLY asks to create/generate):
   - IMAGE REQUEST: If user explicitly asks to generate/draw/create an image, MUST include tag \`[GENERATE_IMAGE: detailed English description]\` in response!
   - PDF / DOCUMENT: If user explicitly asks to create/write/generate a report, PDF, resume, or document (must use words like banao/create/generate/likhdo), format response as \`[GENERATE_PDF: Document Title] Full Markdown Content [/GENERATE_PDF]\`.
   - ANIMATION & VISUAL APPS (STRICT AUTONOMOUS RULE):
     * When asked for an animation, canvas art, game, or interactive component, ALWAYS provide a SINGLE, COMPLETE, 100% SELF-CONTAINED HTML block wrapped in \`\`\`html ... \`\`\` with internal <style> and <script> placed at the end of <body>. NEVER split into separate files with external links that break.
     * HIGH-FIDELITY CREATIVE ART MANDATE: NEVER draw crude stick figures, simple circles, or elementary lines for deities, characters, or art. SVG paths को actual anatomical/artistic shapes के रूप में design करो। Use multi-segment Bezier/quadratic curves (bezierCurveTo, quadraticCurveTo) or detailed SVG paths for organic silhouettes, glowing neon bloom (shadowBlur: 25-50px, shadowColor, globalCompositeOperation: 'lighter'), sacred iconography (for Lord Krishna: radiant forehead Tilak, glowing peacock feather with gradient eye, spinning Sudarshan Chakra on index finger with light rays and sparks, flowing celestial drapes, stardust particle field), and a smooth requestAnimationFrame loop with high-DPI scaling.
   - CODE & EXPLANATION: Write production-grade code in markdown codeblocks with clear step-by-step explanations.

## DEEP REASONING (Chain-of-Thought) — For Complex Questions:
When the user asks a complex algorithmic, mathematical, distributed systems, computer science theory, or proof question:
1. THINK STEP-BY-STEP: Break the problem into sub-problems first.
2. SOLVE EACH STEP: Address each sub-problem explicitly with reasoning.
3. VERIFY: Double-check each conclusion before moving on.
4. SYNTHESIZE: Combine results into a final, complete answer.
5. Never skip steps or give a surface-level answer for deep technical questions.`;
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
