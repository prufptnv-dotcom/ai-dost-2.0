const logger = require('../logger');
const GroqService = require('./groqService');
const GeminiService = require('./geminiService');
const CerebrasService = require('./cerebrasService');
const OpenRouterService = require('./openrouterService');
const NvidiaService = require('./nvidiaService');

/**
 * Shared Multi-Model AI Cascade Helper
 * Tries providers in priority order: Groq -> Gemini -> Cerebras -> OpenRouter -> Nvidia
 */
async function callLLM(prompt, systemPrompt = '', options = {}) {
  const cascade = [GroqService, GeminiService, CerebrasService, OpenRouterService, NvidiaService];
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

module.exports = { callLLM };
