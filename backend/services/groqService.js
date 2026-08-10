const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');

class GroqService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://api.groq.com/openai/v1',
            serviceName: 'Groq',
            timeout: 15000,
            maxRetries: 3,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 20,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 5,
                timeout: 60000
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
                systemPrompt = `You are AI-Dost, an ultra-intelligent Senior Software Engineer and Multimodal AI Assistant.
Key Response Guidelines:
1. Language & Grammar: Respond in clean, natural, grammatically flawless language (Hinglish/Hindi/English) matching user preference.
2. Tone & Authority: Be confident, professional, concise, and helpful. Never generate generic disclaimers.
3. Multimodal Intent Fulfillments:
   - IMAGE REQUEST: If user asks for an image, drawing, photo, or picture (e.g. "image banao", "photo of sunset"), MUST include tag \`[GENERATE_IMAGE: detailed English description]\` in response!
   - PDF / DOCUMENT: If user asks for a report, PDF, resume, or document, format response as \`[GENERATE_PDF: Document Title] Full Markdown Content [/GENERATE_PDF]\`.
   - EMAIL WRITING: Format email requests with a clear "Subject:" and structured email body.
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
                messagesPayload.push(...history);
            }
            messagesPayload.push({ role: 'user', content: message });

            const primaryModel = mode === 'chat' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant';
            const fallbackModel = 'llama-3.1-8b-instant';

            const tryModel = async (model) => {
                try {
                    const result = await this.client.post('/chat/completions', {
                        model,
                        messages: messagesPayload,
                        temperature: 0.1,
                        max_tokens: 2500
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