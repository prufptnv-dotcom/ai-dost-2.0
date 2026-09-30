const logger = require('../logger');
const { ollamaBaseUrl } = require('./ollamaEnv');
const { isValidResponse } = require('../utils/chatUtils');

const MoERouterService = require('./moeRouterService');
const GroqService = require('./groqService');
const GeminiService = require('./geminiService');
const DeepSeekService = require('./deepseekService');
const HuggingFaceService = require('./huggingfaceService');
const NvidiaService = require('./nvidiaService');
const OpenRouterService = require('./openrouterService');
const MistralService = require('./mistralService');
const TogetherService = require('./togetherService');
const CerebrasService = require('./cerebrasService');
const OpenAIService = require('./openaiService');

async function executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys) {
    // Wrap each provider call: resolves with response if valid, rejects if not
    const makeRacer = async (name, fn, timeoutMs = 7000) => {
        try {
            logger.info(`⚡ Racing ${name}...`);
            const res = await Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`${name}: timeout after ${timeoutMs}ms`)), timeoutMs))
            ]);
            if (isValidResponse(res)) {
                logger.info(`✅ ${name} won the race`);
                return { response: res, winner: name };
            } else {
                throw new Error(`${name}: invalid/rate-limited response`);
            }
        } catch (e) {
            throw new Error(`${name}: ${e.message}`);
        }
    };

    // ── TIER 1: Top fastest active providers — race simultaneously ────────
    try {
        const tier1 = await Promise.any([
            makeRacer('Gemini',     () => GeminiService.chat(message, cleanHistory, fileContent, mode, customKeys?.gemini), 20000),
            makeRacer('Groq',       () => GroqService.chat(groqMsg, cleanHistory, mode, customKeys?.groq), 15000),
            makeRacer('OpenRouter', () => OpenRouterService.chat(groqMsg, cleanHistory, customKeys?.openrouter), 20000),
            makeRacer('Cerebras',   () => CerebrasService.chat(groqMsg, cleanHistory, mode, customKeys?.cerebras), 10000),
        ]);
        logger.info(`🏆 Tier-1 winner: ${tier1.winner}`);
        return tier1;
    } catch (t1Err) {
        logger.warn(`⚠️ Tier-1 all failed, escalating to Tier-2...`);
    }

    // ── TIER 2: Secondary providers ───────────────────────────────────────
    try {
        const tier2 = await Promise.any([
            makeRacer('NVIDIA',     () => NvidiaService.chat(groqMsg, cleanHistory, customKeys?.nvidia), 10000),
            makeRacer('OpenAI',     () => OpenAIService.chat(groqMsg, cleanHistory, mode, customKeys?.openai), 10000),
            makeRacer('Together',   () => TogetherService.chat(groqMsg, cleanHistory, customKeys?.together), 8000),
        ]);
        logger.info(`🏆 Tier-2 winner: ${tier2.winner}`);
        return tier2;
    } catch (t2Err) {
        logger.warn(`⚠️ Tier-2 all failed, escalating to Tier-3...`);
    }

    // ── TIER 3: Last resort providers ─────────────────────────────────────
    try {
        const tier3 = await Promise.any([
            makeRacer('DeepSeek',    () => DeepSeekService.chat(groqMsg, cleanHistory, customKeys?.deepseek), 3000),
            makeRacer('Mistral',     () => MistralService.chat(groqMsg, cleanHistory, customKeys?.mistral), 3000),
            makeRacer('HuggingFace', () => HuggingFaceService.chat(groqMsg), 3000),
        ]);
        logger.info(`🏆 Tier-3 winner: ${tier3.winner}`);
        return tier3;
    } catch (t3Err) {
        logger.warn(`⚠️ Tier-3 all failed, trying local Ollama...`);
    }

    // ── TIER 4: Local Ollama (offline fallback) ───────────────────────────
    try {
        logger.info("🦙 Trying local Ollama (offline fallback)...");
        const tagsRes = await fetch(`${ollamaBaseUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) });
        if (tagsRes.ok) {
            const tagsData = await tagsRes.json();
            const models = tagsData.models || [];
            if (models.length > 0) {
                const genRes = await fetch(`${ollamaBaseUrl()}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: models[0].name, prompt: message, stream: false }),
                    signal: AbortSignal.timeout(60000)
                });
                if (genRes.ok) {
                    const genData = await genRes.json();
                    if (genData.response) {
                        logger.info('✅ Ollama local fallback succeeded');
                        return { response: genData.response, winner: 'ollama' };
                    }
                }
            }
        }
    } catch (e) {
        logger.warn("Ollama fallback failed:", e.message);
    }

    return { response: "Ai-Dost: Sabhi AI providers temporarily unavailable. Please check API keys in settings or start Ollama locally.", winner: 'fallback' };
}

// Auto select best AI model using Smart Natural Language Intent Detection (Mixture of Experts)
async function autoSelectModel(message, section, fileContent, cleanHistory, mode, customKeys = null) {
    const text = message.toLowerCase();
    const groqMsg = fileContent ? `File content:\n${fileContent}\n\nUser message: ${message}` : message;

    // Intent Detection
    const codeKeywords = ['code', 'function', 'bug', 'error', 'debug', 'refactor', 'python', 'javascript', 'html', 'css', 'java', 'c++', 'react', 'api', 'syntax', 'script', 'compile', 'regex', 'database', 'sql', 'backend', 'frontend', '3d', 'three.js', 'threejs', 'webgl', 'dna', 'helix', 'simulation', 'simulator', 'animation', 'canvas', 'render'];
    const isCodingIntent = section === 'coding' || codeKeywords.some(kw => text.includes(kw)) || /```[\s\S]*```/.test(message);

    const translationKeywords = ['translate', 'translation', 'anuvad', 'hindi me', 'english me', 'spanish', 'french', 'german', 'language conversion', 'convert text'];
    const isTranslationIntent = section === 'translation' || translationKeywords.some(kw => text.includes(kw));

    const writingKeywords = ['write an essay', 'write a blog', 'draft an email', 'write a story', 'poem', 'article', 'summary', 'paraphrase', 'cover letter', 'creative writing', 'kavita', 'kahani'];
    const isWritingIntent = section === 'writing' || writingKeywords.some(kw => text.includes(kw));

    const mathKeywords = ['solve', 'equation', 'math', 'calculus', 'algebra', 'matrix', 'derivative', 'integral', 'step by step math', 'proof'];
    const isMathIntent = section === 'math' || mathKeywords.some(kw => text.includes(kw));

    // Delegate to MoERouterService
    const route = MoERouterService.analyzeAndRoute(message, section, isCodingIntent, isMathIntent, isWritingIntent, isTranslationIntent);
    return await MoERouterService.executeExpert(route, message, groqMsg, cleanHistory, fileContent, mode, customKeys);
}

module.exports = {
    executeCascadingFailover,
    autoSelectModel
};
