const express = require('express');
const logger = require('../logger');
const router = express.Router();
const GroqService = require('../services/groqService');
const GeminiService = require('../services/geminiService');
const DeepSeekService = require('../services/deepseekService');
const HuggingFaceService = require('../services/huggingfaceService');
const NvidiaService = require('../services/nvidiaService');
const OpenRouterService = require('../services/openrouterService');
const MistralService = require('../services/mistralService');
const TogetherService = require('../services/togetherService');
const CerebrasService = require('../services/cerebrasService');

// Helper to check if response indicates rate limit or error
function isRateLimitedOrError(response) {
    if (!response || typeof response !== 'string') return false;
    const errorIndicators = [
        'RATE_LIMIT',
        'CIRCUIT_OPEN',
        'rate_limit',
        '429',
        '413',
        'Quota exceeded',
        'quota exceeded',
        'API error',
        'API Error',
        'key set nahi hai',
        'service me error',
        'service error',
        'Service Error',
        'temporarily unavailable',
        'unexpected response',
        'not found',
        'All models unavailable',
        'Max retries exceeded'
    ];
    return errorIndicators.some(indicator => response.includes(indicator));
}

// Helper to check if response is a valid AI response
function isValidResponse(response) {
    if (!response || typeof response !== 'string' || response.length < 10) return false;
    if (isRateLimitedOrError(response)) return false;
    // Error responses from services usually start with "<Service> ... Error"
    if (/^(groq|gemini|nvidia|deepseek|openrouter|mistral|together|huggingface|hf).*error/i.test(response)) return false;
    return true;
}

// Local models list endpoint
router.get('/local-models', async (req, res) => {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/tags');
        if (!response.ok) {
            return res.json({ success: true, models: [] });
        }
        const data = await response.json();
        
        const formattedModels = (data.models || []).map(m => {
            const sizeInGB = m.size / (1024 * 1024 * 1024);
            let weight = 'Lightweight';
            let category = 'Light (Fast)';
            
            const paramSize = m.details?.parameter_size || '';
            let paramNum = 0;
            if (paramSize) {
                const num = parseFloat(paramSize);
                if (!isNaN(num)) {
                    paramNum = num;
                    if (num >= 10) {
                        weight = 'Heavy';
                        category = 'Heavy (Needs GPU)';
                    } else if (num >= 4) {
                        weight = 'Medium';
                        category = 'Medium (Balanced)';
                    }
                }
            }

            // Guard RTX 4050 (6GB VRAM): Incompatible if parameters > 9.0B or file size > 5.6 GB
            let isCompatible = true;
            let warning = '';
            if (paramNum > 9.0 || sizeInGB > 5.6) {
                isCompatible = false;
                warning = '⚠️ Exceeds 6GB VRAM';
            }

            return {
                id: `local:${m.name}`,
                name: m.name,
                size: `${sizeInGB.toFixed(2)} GB`,
                weight: weight,
                category: category,
                isCompatible: isCompatible,
                warning: warning,
                details: m.details
            };
        });
        
        res.json({ success: true, models: formattedModels });
    } catch (error) {
        // Return empty list if Ollama is not running
        res.json({ success: true, models: [] });
    }
});

// Service health check endpoint
router.get('/health/services', async (req, res) => {
    const services = {
        groq: { available: !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'gsk_your_key_here' },
        gemini: { available: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_key' },
        nvidia: { available: !!process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'your_nvidia_key' },
        deepseek: { available: !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your_deepseek_key' },
        openrouter: { available: !!process.env.OPENROUTER_API_KEY },
        mistral: { available: !!process.env.MISTRAL_API_KEY },
        together: { available: !!process.env.TOGETHER_API_KEY },
        huggingface: { available: !!process.env.HUGGINGFACE_API_KEY && process.env.HUGGINGFACE_API_KEY !== 'hf_your_key_here' },
        ollama: { available: false }
    };

    // Check Ollama
    try {
        const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
        services.ollama.available = ollamaRes.ok;
    } catch (e) {
        services.ollama.available = false;
    }

    res.json({ success: true, services });
});

// Clean history: dynamic sliding window up to 20 messages and 24,000 char budget
function buildCleanHistory(history, maxMessages = 20, maxTotalChars = 24000) {
    if (!history || !Array.isArray(history)) return [];
    const valid = history.filter(msg => msg && msg.role && msg.content);
    const sliced = valid.slice(-maxMessages);
    let totalChars = 0;
    const result = [];
    for (let i = sliced.length - 1; i >= 0; i--) {
        const item = sliced[i];
        const contentStr = String(item.content || '').substring(0, 3000);
        if (totalChars + contentStr.length > maxTotalChars && result.length > 0) {
            break;
        }
        totalChars += contentStr.length;
        result.unshift({
            role: item.role === 'ai' || item.role === 'model' ? 'assistant' : item.role,
            content: contentStr
        });
    }
    return result;
}

// Main chat endpoint
router.post('/', async (req, res) => {
    const startTime = Date.now();
    try {
        const { message, model, section, fileContent, history, mode, customKeys, uploadedDocs, persona } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
                code: 'MISSING_MESSAGE'
            });
        }
        
        // Persona tone control (hinglish / english / formal)
        const PERSONAS = {
            hinglish: 'Tone: Always reply in Hinglish (Hindi written in Roman script, mixed with English). Be friendly, casual and fun. Use light emojis. Keep technical accuracy. ',
            english: 'Tone: Reply in clear simple English. Friendly but professional. ',
            formal: 'Tone: Reply in formal, professional Hindi or English. Polite, structured, no slang, no emojis. '
        };
        let processedMessage = message;
        if (persona && PERSONAS[persona]) {
            processedMessage = `${PERSONAS[persona]}\n\n${message}`;
        }
        if (uploadedDocs && uploadedDocs.length > 0) {
            const docsContext = uploadedDocs.map(doc => `--- START OF DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.name} ---`).join('\n\n');
            processedMessage = `Knowledge Base / Document Library Context:\n${docsContext}\n\nUser Message:\n${message}`;
        }
        
        // Clean history: sliding window up to 20 messages
        const cleanHistory = buildCleanHistory(history, 20, 24000);

        let response;
        let usedModel = model || 'auto';
        let fallbacksAttempted = [];

        if (model && model.startsWith('local:')) {
            const localModelName = model.substring(6);
            const localMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
            
            logger.info(`🔄 Routing request to local model: ${localModelName}`);
            const localPayload = {
                model: localModelName,
                messages: [
                    ...cleanHistory,
                    { role: 'user', content: localMsg }
                ],
                stream: false
            };
            
            const localRes = await fetch('http://127.0.0.1:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localPayload),
                signal: AbortSignal.timeout(30000)
            });
            
            if (!localRes.ok) {
                const errText = await localRes.text();
                throw new Error(`Local model error: ${errText}`);
            }
            
            const localData = await localRes.json();
            response = localData.message?.content || 'No response from local model.';
        } else {
            // Model-specific routing with intelligent failover
            const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;
            
            const tryModel = async (modelName, serviceFn, ...args) => {
                fallbacksAttempted.push(modelName);
                logger.info(`🔄 Trying model: ${modelName}`);
                const result = await serviceFn(...args);
                return result;
            };

            const executeWithFailover = async (primaryModel, primaryFn, primaryArgs, fallbackChain) => {
                // Try primary model
                let result = await tryModel(primaryModel, primaryFn, ...primaryArgs);
                
                if (isValidResponse(result)) {
                    return { response: result, model: primaryModel };
                }
                
                logger.warn(`⚠️ ${primaryModel} failed or rate limited, trying fallbacks...`);
                
                // Try fallback chain
                for (const { name, fn, args } of fallbackChain) {
                    result = await tryModel(name, fn, ...args);
                    if (isValidResponse(result)) {
                        logger.info(`✅ Fallback to ${name} succeeded`);
                        return { response: result, model: name };
                    }
                    logger.warn(`⚠️ Fallback ${name} also failed`);
                }
                
                return { response: null, model: primaryModel };
            };

            switch(model) {
                case 'groq': {
                    const result = await executeWithFailover(
                        'groq',
                        GroqService.chat,
                        [groqMsg, cleanHistory, mode, customKeys?.groq],
                        [
                            { name: 'gemini', fn: GeminiService.chat, args: [processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini] },
                            { name: 'cerebras', fn: CerebrasService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.cerebras] },
                            { name: 'nvidia', fn: NvidiaService.chat, args: [groqMsg, cleanHistory, customKeys?.nvidia] },
                            { name: 'openrouter', fn: OpenRouterService.chat, args: [groqMsg, cleanHistory, customKeys?.openrouter] },
                            { name: 'together', fn: TogetherService.chat, args: [groqMsg, cleanHistory, customKeys?.together] },
                            { name: 'deepseek', fn: DeepSeekService.chat, args: [groqMsg, cleanHistory, customKeys?.deepseek] },
                            { name: 'mistral', fn: MistralService.chat, args: [groqMsg, cleanHistory, customKeys?.mistral] },
                            { name: 'huggingface', fn: HuggingFaceService.chat, args: [groqMsg] }
                        ]
                    );
                    response = result.response;
                    usedModel = result.model;
                    break;
                }
                case 'gemini': {
                    const result = await executeWithFailover(
                        'gemini',
                        GeminiService.chat,
                        [processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini],
                        [
                            { name: 'groq', fn: GroqService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.groq] },
                            { name: 'cerebras', fn: CerebrasService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.cerebras] },
                            { name: 'nvidia', fn: NvidiaService.chat, args: [groqMsg, cleanHistory, customKeys?.nvidia] },
                            { name: 'openrouter', fn: OpenRouterService.chat, args: [groqMsg, cleanHistory, customKeys?.openrouter] }
                        ]
                    );
                    response = result.response;
                    usedModel = result.model;
                    break;
                }
                case 'nvidia': {
                    const result = await executeWithFailover(
                        'nvidia',
                        NvidiaService.chat,
                        [groqMsg, cleanHistory, customKeys?.nvidia],
                        [
                            { name: 'groq', fn: GroqService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.groq] },
                            { name: 'cerebras', fn: CerebrasService.chat, args: [groqMsg, cleanHistory, mode, customKeys?.cerebras] },
                            { name: 'gemini', fn: GeminiService.chat, args: [processedMessage, cleanHistory, fileContent, mode, customKeys?.gemini] },
                            { name: 'openrouter', fn: OpenRouterService.chat, args: [groqMsg, cleanHistory, customKeys?.openrouter] }
                        ]
                    );
                    response = result.response;
                    usedModel = result.model;
                    break;
                }
                case 'deepseek':
                    response = await DeepSeekService.chat(groqMsg, cleanHistory, customKeys?.deepseek);
                    break;
                case 'cerebras':
                    response = await CerebrasService.chat(groqMsg, cleanHistory, mode, customKeys?.cerebras);
                    break;
                case 'openrouter':
                    response = await OpenRouterService.chat(groqMsg, cleanHistory, customKeys?.openrouter);
                    break;
                case 'mistral':
                    response = await MistralService.chat(groqMsg, cleanHistory, customKeys?.mistral);
                    break;
                case 'together':
                    response = await TogetherService.chat(groqMsg, cleanHistory, customKeys?.together);
                    break;
                case 'huggingface':
                    response = await HuggingFaceService.chat(groqMsg);
                    break;
                default:
                    // Auto-select best model with intelligent intent detection
                    const autoResult = await autoSelectModel(processedMessage, section, fileContent, cleanHistory, mode, customKeys);
                    response = autoResult.response;
                    usedModel = autoResult.model;
            }
        }
        
        // Final fallback if all models failed
        if (!isValidResponse(response)) {
            logger.error('All AI models failed, returning fallback response');
            response = "Ai-Dost: Sabhi AI models temporarily unavailable. Please check your API keys in settings, try again in a moment, or use local Ollama (http://127.0.0.1:11434) for offline mode.";
            usedModel = 'fallback';
        }
        
        const duration = Date.now() - startTime;
        logger.info(`✅ Chat completed in ${duration}ms using model: ${usedModel}`);
        
        res.json({
            success: true,
            reply: response,
            model: usedModel,
            fallbacksAttempted,
            duration
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            code: 'CHAT_ERROR',
            duration
        });
    }
});

// Helper for cascading failover across AI models with better error handling
async function executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys) {
    const tiers = [
        { 
            name: 'Groq (Llama 3.3 70B)', 
            fn: () => GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'Cerebras (GPT-OSS 120B)', 
            fn: () => CerebrasService.chat(groqMsg, cleanHistory, mode, customKeys?.cerebras),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'NVIDIA NIM (Llama 3.1 70B)', 
            fn: () => NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'Gemini Flash', 
            fn: () => GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'OpenRouter (GPT-OSS 20B free)', 
            fn: () => OpenRouterService.chat(groqMsg, cleanHistory, customKeys?.openrouter),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'Together AI (Llama 3.1 8B)', 
            fn: () => TogetherService.chat(groqMsg, cleanHistory, customKeys?.together),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'DeepSeek', 
            fn: () => DeepSeekService.chat(groqMsg, cleanHistory, customKeys?.deepseek),
            check: (r) => isValidResponse(r)
        },
        { 
            name: 'Mistral', 
            fn: () => MistralService.chat(groqMsg, cleanHistory, customKeys?.mistral),
            check: (r) => isValidResponse(r)
        }
    ];

    for (const tier of tiers) {
        try {
            logger.info(`⚡ Trying ${tier.name}...`);
            const res = await tier.fn();
            if (tier.check(res)) {
                logger.info(`✅ ${tier.name} succeeded`);
                return res;
            }
            logger.warn(`⚠️ ${tier.name} returned error/rate limit: ${res?.substring(0, 100)}`);
        } catch (e) {
            logger.warn(`⚠️ ${tier.name} threw error:`, e.message);
        }
    }

    // 4. Try Local Ollama (Offline Mode)
    try {
        logger.info("🦙 Tier: Executing Local Ollama API request...");
        const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
        if (tagsRes.ok) {
            const tagsData = await tagsRes.json();
            const models = tagsData.models || [];
            if (models.length > 0) {
                const genRes = await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: models[0].name,
                        prompt: message,
                        stream: false
                    }),
                    signal: AbortSignal.timeout(60000)
                });
                if (genRes.ok) {
                    const genData = await genRes.json();
                    if (genData.response) return genData.response;
                }
            }
        }
    } catch (e) {
        logger.warn("Tier (Ollama) threw error:", e.message);
    }

    return "Ai-Dost: Direct API response unavailable right now due to provider rate limits. Please check Ollama locally (http://127.0.0.1:11434) or retry in a few seconds!";
}

// Auto select best AI model using Smart Natural Language Intent Detection
async function autoSelectModel(message, section, fileContent, cleanHistory, mode, customKeys = null) {
    const text = message.toLowerCase();
    const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;

    // 1. Coding & Debugging Intent Detection
    const codeKeywords = ['code', 'function', 'bug', 'error', 'debug', 'refactor', 'python', 'javascript', 'html', 'css', 'java', 'c++', 'react', 'api', 'syntax', 'script', 'compile', 'regex', 'database', 'sql', 'backend', 'frontend'];
    const isCodingIntent = section === 'coding' || codeKeywords.some(kw => text.includes(kw)) || /```[\s\S]*```/.test(message);

    // 2. Language Translation Intent Detection
    const translationKeywords = ['translate', 'translation', 'anuvad', 'hindi me', 'english me', 'spanish', 'french', 'german', 'language conversion', 'convert text'];
    const isTranslationIntent = section === 'translation' || translationKeywords.some(kw => text.includes(kw));

    // 3. Creative / Essay / Long-form Writing Intent Detection
    const writingKeywords = ['write an essay', 'write a blog', 'draft an email', 'write a story', 'poem', 'article', 'summary', 'paraphrase', 'cover letter', 'creative writing', 'kavita', 'kahani'];
    const isWritingIntent = section === 'writing' || writingKeywords.some(kw => text.includes(kw));

    // 4. Mathematical Problem Solving Intent
    const mathKeywords = ['solve', 'equation', 'math', 'calculus', 'algebra', 'matrix', 'derivative', 'integral', 'step by step math', 'proof'];
    const isMathIntent = section === 'math' || mathKeywords.some(kw => text.includes(kw));

    // Intent Routing Execution with Cascading Failover
    if (isCodingIntent) {
        logger.info("🧠 Smart Intent Classifier: Detected [CODING/DEBUGGING] -> Cascading AI Router");
        const response = await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
        return { response, model: 'auto-coding' };
    } 
    else if (isTranslationIntent || isWritingIntent) {
        logger.info("🧠 Smart Intent Classifier: Detected [TRANSLATION/WRITING] -> Primary Gemini Flash");
        try {
            const res = await GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini);
            if (isValidResponse(res)) {
                return { response: res, model: 'gemini' };
            }
        } catch (e) {
            logger.warn("Gemini failed for writing/translation:", e.message);
        }
        // Fallback to cascading
        const response = await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
        return { response, model: 'auto-writing' };
    }
    else if (isMathIntent) {
        logger.info("🧠 Smart Intent Classifier: Detected [MATHEMATICAL STEP-BY-STEP] -> Primary NVIDIA NIM");
        try {
            const res = await NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia);
            if (isValidResponse(res)) {
                return { response: res, model: 'nvidia' };
            }
        } catch (e) {
            logger.warn("NVIDIA failed for math:", e.message);
        }
        // Fallback to cascading
        const response = await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
        return { response, model: 'auto-math' };
    }
    else {
        logger.info("🧠 Smart Intent Classifier: Default General Conversation -> Cascading AI Router");
        const response = await executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys);
        return { response, model: 'auto-general' };
    }
}

// ── Web Search with sources (Perplexity-style) ────────────────────────────────
router.post('/search', async (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) {
        return res.status(400).json({ success: false, error: 'message is required' });
    }
    const query = message.trim();

    // 1) Gemini with Google Search grounding (free tier, uses existing key)
    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (API_KEY) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`;
            const payload = {
                contents: [{ role: 'user', parts: [{ text: query }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { temperature: 0.4 }
            };
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 25000);
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            clearTimeout(timer);
            const data = await r.json();
            const text = (data?.candidates?.[0]?.content?.parts || [])
                .map((p) => p.text).filter(Boolean).join('\n');
            if (text && text.length > 10) {
                const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
                const sources = chunks
                    .filter((c) => c.web)
                    .map((c) => ({ title: c.web.title || c.web.uri, url: c.web.uri }))
                    .filter((s) => s.url)
                    .slice(0, 6);
                return res.json({ success: true, reply: text, sources, provider: 'gemini-grounding' });
            }
        }
    } catch (e) {
        logger.warn('[Search] Gemini grounding failed:', e.message);
    }

    // 2) Wikipedia search + summary fallback (free, no API key, fast)
    try {
        const wikiRes = await fetch(
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=4&utf8=1`,
            { signal: AbortSignal.timeout(8000) }
        );
        const wikiData = await wikiRes.json();
        const hits = (wikiData?.query?.search || []).slice(0, 4);
        if (hits.length > 0) {
            const sources = hits.map((s) => ({
                title: s.title,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`
            }));
            // Get a short extract from the top result
            const summaryRes = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hits[0].title.replace(/ /g, '_'))}`,
                { signal: AbortSignal.timeout(8000) }
            );
            const summary = await summaryRes.json();
            const extract = summary?.extract || hits[0].snippet?.replace(/<[^>]+>/g, '') || '';
            if (extract) {
                return res.json({
                    success: true,
                    reply: `**${hits[0].title}**\n\n${extract}`,
                    sources,
                    provider: 'wikipedia'
                });
            }
        }
    } catch (e) {
        logger.warn('[Search] Wikipedia failed:', e.message);
    }

    // 3) DuckDuckGo Instant Answer fallback
    try {
        const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`, {
            signal: AbortSignal.timeout(12000)
        });
        const data = await r.json();
        let reply = data?.AbstractText || data?.Answer || '';
        const sources = [];
        (data?.RelatedTopics || []).forEach((t) => {
            if (t.Text && t.FirstURL) sources.push({ title: t.Text.slice(0, 90), url: t.FirstURL });
        });
        if (data?.AbstractURL) sources.unshift({ title: data?.Heading || 'Source', url: data.AbstractURL });
        if (!reply && sources.length === 0) {
            reply = 'Dhundhne me kuch khaas nahi mila — thoda specific prompt try karo.';
        }
        return res.json({
            success: true,
            reply: reply || 'Ye raha summary — sources niche hain.',
            sources: sources.slice(0, 6),
            provider: 'duckduckgo'
        });
    } catch (e) {
        logger.warn('[Search] DuckDuckGo failed:', e.message);
    }

    // 4) Last resort: normal cascading chat
    try {
        const result = await autoSelectModel(query, 'chat', null, [], 'chat', null);
        return res.json({ success: true, reply: result.response, sources: [], provider: 'chat-fallback' });
    } catch (e) {
        logger.error('[Search] All methods failed:', e.message);
        return res.status(500).json({ success: false, error: 'Search failed', detail: e.message });
    }
});

// ── File/image/PDF analysis (Gemini vision + pdf-parse) ──────────────────────
const pdfParse = require('pdf-parse');

router.post('/analyze', async (req, res) => {
    const { message, text, imageBase64, imageMime, pdfBase64 } = req.body;
    if (!message && !text && !imageBase64 && !pdfBase64) {
        return res.status(400).json({ success: false, error: 'Nothing to analyze' });
    }

    let contextText = text || '';

    // PDF → extract text
    if (pdfBase64) {
        try {
            const buf = Buffer.from(pdfBase64, 'base64');
            const parsed = await pdfParse(buf);
            contextText = (contextText + '\n' + parsed.text).trim().slice(0, 20000);
        } catch (e) {
            logger.warn('[Analyze] pdf-parse failed:', e.message);
            return res.json({ success: true, reply: 'PDF ko padh nahi paya — file corrupt ya encrypted ho sakti hai.', provider: 'pdf-error' });
        }
    }

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        const userText = message || 'Is file ka analysis do — Hinglish me, important points ke saath.';
        let parts = [];
        if (contextText) parts.push({ text: `FILE CONTENT:\n${contextText.slice(0, 20000)}\n\nUSER: ${userText}` });
        else parts.push({ text: userText });
        if (imageBase64 && imageMime) {
            parts = [
                { inlineData: { mimeType: imageMime || 'image/png', data: imageBase64 } },
                { text: userText }
            ];
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 40000);
        const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
                signal: controller.signal
            }
        );
        clearTimeout(timer);
        const data = await r.json();
        const reply = (data?.candidates?.[0]?.content?.parts || [])
            .map((p) => p.text).filter(Boolean).join('\n');
        if (reply && reply.length > 10) {
            return res.json({ success: true, reply, provider: imageBase64 ? 'gemini-vision' : 'gemini-file' });
        }
        logger.warn('[Analyze] Gemini empty:', JSON.stringify(data?.error || {}).slice(0, 200));
    } catch (e) {
        logger.warn('[Analyze] Gemini failed:', e.message);
    }

    // Fallback: Groq with file text context
    try {
        const GroqService = require('../services/groqService');
        const prompt = contextText
            ? `FILE CONTENT:\n${contextText.slice(0, 8000)}\n\nUSER: ${message || 'analyze this'}`
            : message || 'analyze this file';
        const reply = await GroqService.chat(prompt, [], 'chat');
        if (reply && !reply.startsWith('Groq')) {
            return res.json({ success: true, reply, provider: 'groq-file' });
        }
    } catch (e) {
        logger.warn('[Analyze] Groq failed:', e.message);
    }

    return res.json({ success: true, reply: 'File ka analysis nahi ho paya — dobara try karo.', provider: 'none' });
});

// ── Stream Chat (Server-Sent Events) ─────────────────────────────────────────
router.post('/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const sendEvent = (data) => {
        if (!res.writableEnded) {
            res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
        }
    };

    try {
        const { message, model, section, fileContent, history, mode, customKeys, uploadedDocs, persona } = req.body;
        if (!message || !message.trim()) {
            sendEvent({ error: 'Message is required' });
            sendEvent('[DONE]');
            return res.end();
        }

        const PERSONAS = {
            hinglish: 'Tone: Always reply in Hinglish (Hindi written in Roman script, mixed with English). Be friendly, casual and fun. Use light emojis. Keep technical accuracy. ',
            english: 'Tone: Reply in clear simple English. Friendly but professional. ',
            formal: 'Tone: Reply in formal, professional Hindi or English. Polite, structured, no slang, no emojis. '
        };
        let processedMessage = message;
        if (persona && PERSONAS[persona]) {
            processedMessage = `${PERSONAS[persona]}\n\n${message}`;
        }
        if (uploadedDocs && uploadedDocs.length > 0) {
            const docsContext = uploadedDocs.map(doc => `--- START OF DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.name} ---`).join('\n\n');
            processedMessage = `Knowledge Base / Document Library Context:\n${docsContext}\n\nUser Message:\n${message}`;
        }

        const cleanHistory = buildCleanHistory(history, 20, 24000);
        const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${processedMessage}` : processedMessage;

        let streamedSuccessfully = false;
        let usedModel = 'auto';

        // 1. If Local Ollama requested
        if (model && model.startsWith('local:')) {
            const localModelName = model.substring(6);
            try {
                const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: localModelName,
                        messages: [
                            ...cleanHistory,
                            { role: 'user', content: groqMsg }
                        ],
                        stream: true
                    }),
                    signal: AbortSignal.timeout(60000)
                });
                if (ollamaRes.ok && ollamaRes.body) {
                    const reader = ollamaRes.body.getReader();
                    const decoder = new TextDecoder();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunkText = decoder.decode(value, { stream: true });
                        const lines = chunkText.split('\n').filter(Boolean);
                        for (const line of lines) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.message?.content) {
                                    sendEvent({ chunk: parsed.message.content });
                                    streamedSuccessfully = true;
                                }
                            } catch (_) {}
                        }
                    }
                    usedModel = `local:${localModelName}`;
                }
            } catch (err) {
                logger.warn('Ollama streaming error:', err.message);
            }
        }

        // 2. Try Groq Streaming (Primary Fast)
        if (!streamedSuccessfully && (model === 'groq' || model === 'auto' || !model)) {
            const apiKey = customKeys?.groq || process.env.GROQ_API_KEY;
            if (apiKey && apiKey !== 'gsk_your_key_here') {
                try {
                    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model: 'openai/gpt-oss-120b',
                            messages: [
                                { role: 'system', content: 'You are AI-Dost, an ultra-intelligent and friendly AI developer assistant. Answer in Hinglish/English naturally.' },
                                ...cleanHistory,
                                { role: 'user', content: groqMsg }
                            ],
                            stream: true,
                            temperature: 0.2,
                            max_tokens: 2048
                        }),
                        signal: AbortSignal.timeout(20000)
                    });

                    if (groqRes.ok && groqRes.body) {
                        const reader = groqRes.body.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '';
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (trimmed.startsWith('data: ')) {
                                    const dataStr = trimmed.slice(6);
                                    if (dataStr === '[DONE]') continue;
                                    try {
                                        const parsed = JSON.parse(dataStr);
                                        const delta = parsed.choices?.[0]?.delta?.content;
                                        if (delta) {
                                            sendEvent({ chunk: delta });
                                            streamedSuccessfully = true;
                                        }
                                    } catch (_) {}
                                }
                            }
                        }
                        if (streamedSuccessfully) usedModel = 'groq (gpt-oss-120b)';
                    }
                } catch (e) {
                    logger.warn('Groq streaming failed, trying Gemini:', e.message);
                }
            }
        }

        // 3. Try Gemini Streaming
        if (!streamedSuccessfully && (model === 'gemini' || model === 'auto' || !model)) {
            const geminiKey = customKeys?.gemini || process.env.GEMINI_API_KEY;
            if (geminiKey && geminiKey !== 'your_gemini_key') {
                try {
                    const geminiModels = ['gemini-2.5-flash', 'gemini-flash-latest'];
                    for (const gModel of geminiModels) {
                        const geminiRes = await fetch(
                            `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:streamGenerateContent?alt=sse&key=${geminiKey}`,
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [
                                        ...cleanHistory.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
                                        { role: 'user', parts: [{ text: processedMessage }] }
                                    ],
                                    generationConfig: { temperature: 0.3 }
                                }),
                                signal: AbortSignal.timeout(25000)
                            }
                        );
                        if (geminiRes.ok && geminiRes.body) {
                            const reader = geminiRes.body.getReader();
                            const decoder = new TextDecoder();
                            let buffer = '';
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) break;
                                buffer += decoder.decode(value, { stream: true });
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || '';
                                for (const line of lines) {
                                    const trimmed = line.trim();
                                    if (trimmed.startsWith('data: ')) {
                                        try {
                                            const parsed = JSON.parse(trimmed.slice(6));
                                            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                                            if (text) {
                                                sendEvent({ chunk: text });
                                                streamedSuccessfully = true;
                                            }
                                        } catch (_) {}
                                    }
                                }
                            }
                            if (streamedSuccessfully) {
                                usedModel = `gemini (${gModel})`;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    logger.warn('Gemini streaming failed:', e.message);
                }
            }
        }

        // 4. Fallback to normal cascading chat if streaming had no output
        if (!streamedSuccessfully) {
            logger.info('Streaming fallbacks exhausted, falling back to synchronous cascade...');
            const fallbackResult = await autoSelectModel(processedMessage, section, fileContent, cleanHistory, mode, customKeys);
            if (isValidResponse(fallbackResult.response)) {
                sendEvent({ chunk: fallbackResult.response });
                usedModel = fallbackResult.model;
            } else {
                sendEvent({ chunk: 'Ai-Dost: Sabhi AI models temporarily busy hain. Please kuch der baad try karein ya Local Ollama use karein.' });
                usedModel = 'fallback';
            }
        }

        sendEvent({ done: true, model: usedModel });
        sendEvent('[DONE]');
        res.end();
    } catch (error) {
        logger.error('Stream chat error:', error);
        sendEvent({ error: error.message || 'Stream failed' });
        sendEvent('[DONE]');
        res.end();
    }
});

// ── In-Chat Code Execution Runner (Node.js / Python Sandbox) ────────────────
const { exec: runChildExec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

router.post('/execute', async (req, res) => {
    const { code, language } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code is required' });
    }

    const lang = (language || 'javascript').toLowerCase();
    const startTime = Date.now();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-chat-exec-'));
    
    let filePath;
    let execCmd;

    if (lang === 'python' || lang === 'py') {
        filePath = path.join(tempDir, 'script.py');
        fs.writeFileSync(filePath, code, 'utf-8');
        execCmd = `python "${filePath}"`;
    } else if (lang === 'javascript' || lang === 'js' || lang === 'node') {
        filePath = path.join(tempDir, 'script.js');
        fs.writeFileSync(filePath, code, 'utf-8');
        execCmd = `node "${filePath}"`;
    } else {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
        return res.json({
            success: false,
            error: `Execution for '${lang}' is not supported directly in chat. Use Copilot IDE for full-stack environments.`,
            duration: Date.now() - startTime
        });
    }

    runChildExec(execCmd, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        const duration = Date.now() - startTime;
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

        if (err && err.killed) {
            return res.json({
                success: false,
                error: 'Execution timed out (10s limit exceeded)',
                stdout: stdout || '',
                stderr: stderr || '',
                exitCode: 124,
                duration
            });
        }

        res.json({
            success: !err,
            stdout: stdout || '',
            stderr: stderr || (err ? err.message : ''),
            exitCode: err ? (err.code || 1) : 0,
            duration
        });
    });
});

module.exports = router;