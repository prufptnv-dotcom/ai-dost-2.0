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

// Main chat endpoint
router.post('/', async (req, res) => {
    const startTime = Date.now();
    try {
        const { message, model, section, fileContent, history, mode, customKeys, uploadedDocs } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message is required',
                code: 'MISSING_MESSAGE'
            });
        }
        
        let processedMessage = message;
        if (uploadedDocs && uploadedDocs.length > 0) {
            const docsContext = uploadedDocs.map(doc => `--- START OF DOCUMENT: ${doc.name} ---\n${doc.content}\n--- END OF DOCUMENT: ${doc.name} ---`).join('\n\n');
            processedMessage = `Knowledge Base / Document Library Context:\n${docsContext}\n\nUser Message:\n${message}`;
        }
        
        // Clean history: truncate long content & limit to last 6 messages to stay under token limits
        const cleanHistory = (history || [])
            .filter(msg => msg.role && msg.content)
            .slice(-6)
            .map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: String(msg.content).substring(0, 1500)
            }));

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
            name: 'OpenRouter (Llama 3.1 8B)', 
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

module.exports = router;