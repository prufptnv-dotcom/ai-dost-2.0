const logger = require('../logger');
const { RobustApiClient } = require('./apiClient');
const { withQualityStandard } = require('./outputQualityStandard');

// OpenRouter par available Free Models ki Category-wise List (2026 Active & Verified)
const FREE_MODELS = {
    // 1. Automatic Best Free Model
    "auto": "openrouter/free",

    // 2. General Reasoning & Heavy Tasks
    "nemotron_3_ultra": "nvidia/nemotron-3-ultra-550b-a55b:free",
    "nemotron_3_super": "nvidia/nemotron-3-super-120b-a12b:free",
    "nemotron_3_lightning": "nvidia/nemotron-3.5-lightning:free",
    "inkling": "thinkingmachines/inkling:free",
    "inkling_small": "thinkingmachines/inkling-small:free",
    "dots_3_note": "dots-studio/dots-3-note-preview:free",
    "lfm_reasoning": "liquid/lfm-2.5-2.6b:free",

    // 3. Coding & Developer Agents
    "laguna_s": "poolside/laguna-s-2.1:free",
    "laguna_xs": "poolside/laguna-xs-2.1:free",
    "north_mini_code": "cohere/north-mini-code:free",

    // 4. Multimodal (Image, Video & Vision RAG)
    "gemma_26b": "google/gemma-4-26b-a4b-it:free",
    "gemma_31b": "google/gemma-4-31b-it:free",
    "qwen_38": "qwen/qwen3.8-27b:free",
    "nemotron_nano_omni": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nemotron_rerank_vl": "nvidia/llama-nemotron-rerank-vl-1b-v2:free",
    "nemotron_embed_vl": "nvidia/llama-nemotron-embed-vl-1b-v2:free",

    // 5. Specialized / Niche Tasks
    "ling_sante": "inclusionai/ling-3.0-flash-sante:free",      // Medical & Health
    "apodex_mini": "apodex/apodex-1.1-mini:free",                // Long Research & Forecasting
    "mercury_decide": "inception/mercury-decide:free",           // Fast Structured Decisions
    "content_safety": "nvidia/nemotron-3.5-content-safety:free", // Guardrails & Content Moderation
    "nemotron_embed": "nvidia/nemotron-3-embed-1b:free"          // Search & Vector Embeddings
};

// Friendly categories and descriptions
const MODEL_METADATA = {
    "auto": { name: "Auto Best Free", category: "Automatic", description: "Dynamic OpenRouter router selecting highest uptime free model" },
    "nemotron_3_ultra": { name: "Nemotron 3 Ultra (550B)", category: "General Reasoning & Heavy Tasks", description: "Heavyweight 550B MoE reasoning architecture" },
    "nemotron_3_super": { name: "Nemotron 3 Super (120B)", category: "General Reasoning & Heavy Tasks", description: "High-parameter reasoning for system architecture and logic" },
    "nemotron_3_lightning": { name: "Nemotron 3.5 Lightning", category: "General Reasoning & Heavy Tasks", description: "Ultra-fast thought process & lightning chain-of-thought" },
    "inkling": { name: "Inkling (Agentic)", category: "General Reasoning & Heavy Tasks", description: "Thinking Machines agentic harness model" },
    "inkling_small": { name: "Inkling Small", category: "General Reasoning & Heavy Tasks", description: "Lightweight agentic harness model" },
    "dots_3_note": { name: "Dots 3 Note Preview", category: "General Reasoning & Heavy Tasks", description: "Deep technical documentation & structured notes" },
    "lfm_reasoning": { name: "Liquid LFM 2.5", category: "General Reasoning & Heavy Tasks", description: "Liquid AI hybrid liquid state-space reasoning architecture" },
    "laguna_s": { name: "Poolside Laguna-S 2.1", category: "Coding & Developer Agents", description: "Specialized autonomous software engineering agent model" },
    "laguna_xs": { name: "Poolside Laguna-XS 2.1", category: "Coding & Developer Agents", description: "High-speed developer coding model" },
    "north_mini_code": { name: "Cohere North Mini Code", category: "Coding & Developer Agents", description: "Cohere coding, syntax, and logic model" },
    "gemma_26b": { name: "Google Gemma 4 (26B)", category: "Multimodal & Vision", description: "Instruction-tuned vision and reasoning model" },
    "gemma_31b": { name: "Google Gemma 4 (31B)", category: "Multimodal & Vision", description: "Google Gemma 31B high-capability model" },
    "qwen_38": { name: "Qwen 3.8 (27B)", category: "Multimodal & Vision", description: "Alibaba multimodal vision-language model" },
    "nemotron_nano_omni": { name: "Nemotron Nano Omni (30B)", category: "Multimodal & Vision", description: "Omni-modal reasoning & vision agent" },
    "nemotron_rerank_vl": { name: "Nemotron Rerank VL", category: "Multimodal & Vision", description: "Reranking model for RAG and search pipelines" },
    "nemotron_embed_vl": { name: "Nemotron Embed VL", category: "Multimodal & Vision", description: "Multimodal visual and text embedding model" },
    "ling_sante": { name: "Ling 3.0 Santé", category: "Specialized & Niche Tasks", description: "Medical, healthcare, and clinical inquiry specialist" },
    "apodex_mini": { name: "Apodex 1.1 Mini", category: "Specialized & Niche Tasks", description: "Long-horizon research, synthesis, and forecasting" },
    "mercury_decide": { name: "Mercury Decide", category: "Specialized & Niche Tasks", description: "Fast structured decision trees and policy evaluations" },
    "content_safety": { name: "Nemotron Content Safety", category: "Specialized & Niche Tasks", description: "Guardrails, safety moderation, and defensive verification" },
    "nemotron_embed": { name: "Nemotron Embed 1B", category: "Specialized & Niche Tasks", description: "Dense semantic vector embeddings for search" }
};

// Aliases and slug normalizers to fix common typos
const MODEL_ALIASES = {
    "dots3-note-preview:free": "dots-studio/dots-3-note-preview:free",
    "dots-studio/dots3-note-preview:free": "dots-studio/dots-3-note-preview:free",
    "dots3_note": "dots-studio/dots-3-note-preview:free",
    "lfm2.5-2.6b:free": "liquid/lfm-2.5-2.6b:free",
    "liquid/lfm2.5-2.6b:free": "liquid/lfm-2.5-2.6b:free",
    "google/gemma-4-26b-a4b:free": "google/gemma-4-26b-a4b-it:free",
    "gemma-4-26b-a4b:free": "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-nano-omni:free": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "nemotron-3-nano-omni:free": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
};

// Resilient fallback order when primary model is rate limited or unavailable (verified 2026 live)
const DEFAULT_FALLBACK_CASCADE = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openrouter/free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3.5-lightning:free',
    'dots-studio/dots-3-note-preview:free',
    'liquid/lfm-2.5-2.6b:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'inclusionai/ling-3.0-flash-sante:free',
    'apodex/apodex-1.1-mini:free',
    'nvidia/nemotron-3.5-content-safety:free'
];

class OpenRouterService {
    constructor() {
        this.client = new RobustApiClient({
            baseUrl: 'https://openrouter.ai/api/v1',
            serviceName: 'OpenRouter',
            timeout: 25000,
            maxRetries: 1,
            retryDelay: 1000,
            rateLimiter: {
                maxRequests: 60,
                windowMs: 60000
            },
            circuitBreaker: {
                failureThreshold: 15,
                timeout: 15000
            }
        });
    }

    /**
     * Resolve task key, alias, or raw model ID to an OpenRouter model slug.
     */
    static resolveModel(taskKeyOrModel = 'auto') {
        if (!taskKeyOrModel) return FREE_MODELS.auto;

        let clean = String(taskKeyOrModel).trim();
        if (clean.startsWith('openrouter:')) {
            clean = clean.slice(11).trim();
        }

        if (FREE_MODELS[clean]) {
            return FREE_MODELS[clean];
        }

        if (MODEL_ALIASES[clean]) {
            return MODEL_ALIASES[clean];
        }

        const lower = clean.toLowerCase();
        if (FREE_MODELS[lower]) {
            return FREE_MODELS[lower];
        }
        if (MODEL_ALIASES[lower]) {
            return MODEL_ALIASES[lower];
        }

        return clean;
    }

    /**
     * Check if a given string matches any known OpenRouter model key or slug.
     */
    static isSupportedModel(modelStr) {
        if (!modelStr || typeof modelStr !== 'string') return false;
        let clean = modelStr.trim();
        if (clean.startsWith('openrouter:')) return true;
        if (clean === 'openrouter') return true;
        if (FREE_MODELS[clean]) return true;
        if (MODEL_ALIASES[clean]) return true;
        return Object.values(FREE_MODELS).includes(clean);
    }

    /**
     * Return all available models organized by category with metadata.
     */
    static getModelCatalog() {
        return Object.entries(FREE_MODELS).map(([key, slug]) => {
            const meta = MODEL_METADATA[key] || { name: key, category: 'General', description: slug };
            return {
                key,
                slug,
                name: meta.name,
                category: meta.category,
                description: meta.description
            };
        });
    }

    /**
     * Universal ask_ai function — matches user's Python script signature:
     * ask_ai(prompt, task_key="auto", system_prompt="You are a helpful assistant.")
     */
    static async askAi(prompt, taskKey = 'auto', systemPrompt = 'You are a helpful assistant.', customApiKey = null) {
        const instance = new OpenRouterService();
        return instance._askAi(prompt, taskKey, systemPrompt, customApiKey);
    }

    /**
     * Main chat entrypoint used across AI-Dost backend.
     */
    static async chat(message, history = [], customApiKey = null, mode = 'project', modelOverride = null) {
        const instance = new OpenRouterService();
        return instance._chat(message, history, customApiKey, mode, modelOverride);
    }

    /**
     * Internal implementation of askAi.
     */
    async _askAi(prompt, taskKey = 'auto', systemPrompt = 'You are a helpful assistant.', customApiKey = null) {
        const selectedModel = OpenRouterService.resolveModel(taskKey);
        const messages = [];
        if (systemPrompt && systemPrompt.trim()) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });
        return this._executeChat(messages, customApiKey, selectedModel);
    }

    /**
     * Internal implementation of standard chat.
     */
    async _chat(message, history = [], customApiKey = null, mode = 'project', modelOverride = null) {
        try {
            const messages = [];
            if (mode !== 'agent') {
                messages.push({
                    role: 'system',
                    content: withQualityStandard(`You are AI-Dost, an expert Senior Software Engineer and AI Assistant. Write clean, optimal, production-grade code wrapped inside markdown code blocks.`)
                });
            }
            messages.push(...history);
            messages.push({ role: 'user', content: message });

            const primaryModel = modelOverride ? OpenRouterService.resolveModel(modelOverride) : null;
            return await this._executeChat(messages, customApiKey, primaryModel);
        } catch (error) {
            logger.error('❌ OpenRouter Service Error:', error.message);

            if (error.message.includes('RATE_LIMIT')) {
                return 'OPENROUTER_RATE_LIMITED';
            }

            if (error.message.includes('Circuit breaker')) {
                return 'OPENROUTER_CIRCUIT_OPEN';
            }

            return 'OpenRouter service error: ' + error.message;
        }
    }

    /**
     * Execute chat request with model failover and reasoning extraction.
     */
    async _executeChat(messages, customApiKey = null, primaryModel = null) {
        const API_KEY = customApiKey || process.env.OPENROUTER_API_KEY;

        if (!API_KEY) {
            logger.error('❌ OpenRouter API Key not found!');
            return 'OpenRouter API key set nahi hai. Settings me apni key enter karein ya .env file me OPENROUTER_API_KEY set karein.';
        }

        // Build candidate model list starting with the requested model
        const candidateModels = [];
        if (primaryModel) {
            candidateModels.push(primaryModel);
        }
        for (const m of DEFAULT_FALLBACK_CASCADE) {
            if (!candidateModels.includes(m)) {
                candidateModels.push(m);
            }
        }

        let lastError = null;

        for (const model of candidateModels) {
            try {
                logger.info(`🪐 [OpenRouter] Querying model: ${model}`);
                const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_KEY}`,
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'AI-Dost'
                    },
                    body: JSON.stringify({
                        model,
                        messages,
                        temperature: 0.2,
                        max_tokens: 4096
                    }),
                    signal: AbortSignal.timeout(18000)
                });

                if (!res.ok) {
                    const errBody = await res.text();
                    lastError = `model ${model} returned HTTP ${res.status}: ${errBody.slice(0, 100)}`;
                    logger.warn(`⚠️ [OpenRouter] Model ${model} returned status ${res.status}`);
                    continue;
                }

                const data = await res.json();
                if (data.choices && data.choices[0]?.message) {
                    const choice = data.choices[0];
                    const msg = choice.message;
                    let content = msg.content;

                    // Fallback to reasoning field if content was empty due to token length
                    if ((!content || !content.trim()) && msg.reasoning && msg.reasoning.trim()) {
                        logger.info(`ℹ️ [OpenRouter] Extracted output from reasoning delta for ${model}`);
                        content = msg.reasoning.trim();
                    }

                    if (content && content.trim()) {
                        logger.info(`✅ [OpenRouter] Successful response from (${model})`);
                        return content;
                    }

                    lastError = `empty content from ${model}`;
                } else if (data.error) {
                    lastError = typeof data.error === 'object' ? (data.error.message || JSON.stringify(data.error)) : data.error;
                } else {
                    lastError = `empty response from ${model}`;
                }
            } catch (error) {
                lastError = error.message;
                logger.warn(`⚠️ [OpenRouter] Model ${model} failed: ${error.message}`);
                if (error.message?.includes('chat client disconnected') || error.name === 'AbortError') {
                    break;
                }
                continue;
            }
        }

        throw new Error(lastError || 'All OpenRouter free models failed');
    }

    /**
     * Test a single model live on OpenRouter.
     */
    static async testModel(taskKeyOrModel = 'auto', customApiKey = null) {
        const resolved = OpenRouterService.resolveModel(taskKeyOrModel);
        const API_KEY = customApiKey || process.env.OPENROUTER_API_KEY;
        const start = Date.now();

        if (!API_KEY) {
            return {
                modelKey: taskKeyOrModel,
                resolvedModel: resolved,
                success: false,
                latencyMs: 0,
                error: 'OPENROUTER_API_KEY missing'
            };
        }

        try {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'AI-Dost'
                },
                body: JSON.stringify({
                    model: resolved,
                    messages: [{ role: 'user', content: 'Say hello in 3 words' }],
                    max_tokens: 1024
                }),
                signal: AbortSignal.timeout(15000)
            });

            const latencyMs = Date.now() - start;
            const data = await res.json();

            if (res.ok && data.choices && data.choices[0]?.message) {
                const msg = data.choices[0].message;
                const text = (msg.content || msg.reasoning || '').trim();
                return {
                    modelKey: taskKeyOrModel,
                    resolvedModel: resolved,
                    success: true,
                    statusCode: res.status,
                    latencyMs,
                    response: text
                };
            } else {
                return {
                    modelKey: taskKeyOrModel,
                    resolvedModel: resolved,
                    success: false,
                    statusCode: res.status,
                    latencyMs,
                    error: data.error?.message || JSON.stringify(data.error || data)
                };
            }
        } catch (e) {
            return {
                modelKey: taskKeyOrModel,
                resolvedModel: resolved,
                success: false,
                latencyMs: Date.now() - start,
                error: e.message
            };
        }
    }

    /**
     * Test all free models and return an aggregated report.
     */
    static async testAllModels(customApiKey = null) {
        const results = [];
        for (const [key, slug] of Object.entries(FREE_MODELS)) {
            const res = await OpenRouterService.testModel(slug, customApiKey);
            results.push({
                taskKey: key,
                ...res
            });
        }
        return results;
    }
}

OpenRouterService.FREE_MODELS = FREE_MODELS;
OpenRouterService.MODEL_METADATA = MODEL_METADATA;
OpenRouterService.MODEL_ALIASES = MODEL_ALIASES;
OpenRouterService.DEFAULT_FALLBACK_CASCADE = DEFAULT_FALLBACK_CASCADE;

module.exports = OpenRouterService;