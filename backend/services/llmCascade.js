const logger = require('../logger');
const GroqService = require('./groqService');
const GeminiService = require('./geminiService');
const CerebrasService = require('./cerebrasService');
const OpenRouterService = require('./openrouterService');
const NvidiaService = require('./nvidiaService');
const DeepseekService = require('./deepseekService');
const MistralService = require('./mistralService');
const OpenCodeService = require('./opencodeService');

/**
 * Shared Multi-Model AI Cascade Helper
 * Tries providers in priority order:
 *   Groq -> Gemini -> Cerebras -> OpenRouter -> Nvidia -> OpenCode (key-less free gateway)
 */
async function callLLM(prompt, systemPrompt = '', options = {}) {
  const cascade = [GroqService, GeminiService, CerebrasService, OpenRouterService, NvidiaService, OpenCodeService];
  let lastError = null;

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  for (const service of cascade) {
    if (!service) continue;
    try {
      let reply = '';
      if (typeof service.chat === 'function') {
        reply = await service.chat(fullPrompt, [], 'agent');
      } else if (typeof service.generateText === 'function') {
        reply = await service.generateText(fullPrompt);
      }
      if (reply && reply.trim()) {
        return reply.trim();
      }
    } catch (err) {
      lastError = err;
      logger.warn(`[LLMCascade] Provider failed, failing over to next:`, err.message);
    }
  }

  throw lastError || new Error('All LLM cascade providers failed');
}

// ── P10.1: restored MoE failover ─────────────────────────────────────────────
// moeRouterService has always imported `executeCascadingFailover` from this
// module, but it was never exported → `TypeError: executeCascadingFailover is
// not a function` on EVERY 'auto-cascade' route and every expert-failure
// fallback (general chat + failover were silently dead). Restored as a
// sequential, timeout-bounded cascade that returns a STRING (the contract MoE
// expects — chat.js keeps its own local {response,winner} variant).

const hasKey = (custom, envVar) => {
  if (typeof custom === 'string' && custom.length > 5 && !custom.includes('your_key_here')) return true;
  const envVal = process.env[envVar];
  return Boolean(typeof envVal === 'string' && envVal.length > 5 && !envVal.includes('your_key_here'));
};

function looksLikeErrorReply(t) {
  if (!t || t.length > 400) return false; // real answers are usually longer than error stubs
  return /API key|rate.?limit|quota exceeded|credit limit|service error|temporarily unavailable|not authenticated|invalid api/i.test(t);
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

async function ollamaLocal(prompt) {
  const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
  if (!tagsRes.ok) throw new Error('ollama: not reachable');
  const tagsData = await tagsRes.json();
  const models = tagsData.models || [];
  if (models.length === 0) throw new Error('ollama: no models pulled');
  const genRes = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: models[0].name, prompt, stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (!genRes.ok) throw new Error(`ollama: generate HTTP ${genRes.status}`);
  const genData = await genRes.json();
  if (!genData.response) throw new Error('ollama: empty response');
  return genData.response;
}

/**
 * String-returning tiered failover used by the MoE router.
 * Providers without a key (custom or env) are skipped BEFORE any network call,
 * so a keyless install falls straight through to OpenCode → Ollama.
 */
async function executeCascadingFailover(message, groqMsg, cleanHistory, fileContent, mode, customKeys = null) {
  const text = typeof message === 'string' ? message : String(message || '');
  const short = typeof groqMsg === 'string' && groqMsg ? groqMsg : text;
  const history = Array.isArray(cleanHistory) ? cleanHistory : [];

  const attempts = [
    { name: 'Groq', env: 'GROQ_API_KEY', custom: customKeys?.groq, ms: 20000, run: () => GroqService.chat(short, history, mode || 'chat', customKeys?.groq) },
    { name: 'Gemini', env: 'GEMINI_API_KEY', custom: customKeys?.gemini, ms: 20000, run: () => GeminiService.chat(text, history, fileContent, mode, customKeys?.gemini) },
    { name: 'Cerebras', env: 'CEREBRAS_API_KEY', custom: customKeys?.cerebras, ms: 15000, run: () => CerebrasService.chat(short, history, mode || 'chat', customKeys?.cerebras) },
    { name: 'OpenRouter', env: 'OPENROUTER_API_KEY', custom: customKeys?.openrouter, ms: 20000, run: () => OpenRouterService.chat(short, history, customKeys?.openrouter, mode || 'chat') },
    { name: 'NVIDIA', env: 'NVIDIA_API_KEY', custom: customKeys?.nvidia, ms: 15000, run: () => NvidiaService.chat(short, history, customKeys?.nvidia, mode || 'chat') },
    { name: 'DeepSeek', env: 'DEEPSEEK_API_KEY', custom: customKeys?.deepseek, ms: 20000, run: () => DeepseekService.chat(short, history, fileContent, mode, customKeys?.deepseek) },
    { name: 'Mistral', env: 'MISTRAL_API_KEY', custom: customKeys?.mistral, ms: 15000, run: () => MistralService.chat(short, history, fileContent, mode, customKeys?.mistral) },
    // Key-less tiers — always eligible:
    { name: 'OpenCode', env: null, ms: 50000, run: () => OpenCodeService.chat(text, history, 'chat', null, { timeoutMs: 45000 }) },
    { name: 'Ollama', env: null, ms: 65000, run: () => ollamaLocal(text) },
  ];

  for (const a of attempts) {
    if (a.env && !hasKey(a.custom, a.env)) continue; // no key → skip without a network call
    if (a.name === 'OpenCode' && !OpenCodeService.isAvailable()) continue;
    try {
      const reply = await withTimeout(a.run(), a.ms, a.name);
      const t = typeof reply === 'string' ? reply.trim() : '';
      if (t && !looksLikeErrorReply(t)) {
        logger.info(`[LLMCascade] Failover winner: ${a.name}`);
        return t;
      }
    } catch (err) {
      logger.warn(`[LLMCascade] Failover ${a.name} failed:`, err.message);
    }
  }

  return 'Ai-Dost: Sabhi AI providers temporarily unavailable. Please check API keys in settings or start Ollama locally.';
}

module.exports = { callLLM, executeCascadingFailover };
