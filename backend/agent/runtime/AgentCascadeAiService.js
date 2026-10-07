'use strict';

const logger = require('../../logger');
const GroqService = require('../../services/groqService');
const GeminiService = require('../../services/geminiService');
const OpenRouterService = require('../../services/openrouterService');
const CerebrasService = require('../../services/cerebrasService');
const OpenAIService = require('../../services/openaiService');
const { ollamaBaseUrl } = require('../../services/ollamaEnv');

function isErrorResponse(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (!t) return true;
  const lower = t.toLowerCase();

  // Specific service error sentinels
  if (
    t === 'GROQ_RATE_LIMITED' ||
    t === 'GROQ_CIRCUIT_OPEN' ||
    t === 'Gemini response decode nahi ho paya.' ||
    lower.includes('api key set nahi') ||
    lower.includes('api key not found') ||
    lower.startsWith('groq service me error:') ||
    lower.startsWith('gemini service me error:') ||
    lower.startsWith('openrouter service error:') ||
    lower.startsWith('openrouter error:') ||
    lower.startsWith('cerebras error:') ||
    lower.startsWith('openai error:') ||
    lower.includes('chat client disconnected') ||
    lower.includes('service error:') ||
    lower.includes('rate_limit_exceeded') ||
    lower.includes('groq_rate_limited') ||
    lower.includes('openrouter_rate_limited') ||
    lower.includes('credit_balance_exhausted') ||
    lower.includes('circuit breaker open')
  ) {
    return true;
  }

  // Parse pure JSON error responses from API endpoints (e.g. { error: { message: ... } })
  // Do NOT reject structured plans that contain "error" in code or schema.
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const parsed = JSON.parse(t);
      if (parsed && parsed.error && !parsed.goal && !parsed.steps && !parsed.tasks && !parsed.choices && !parsed.content) {
        return true;
      }
    } catch (_) {}
  }

  return false;
}

class AgentCascadeAiService {
  static async chat(prompt, history = [], mode = 'agent', customKeys = null, preferredModel = 'auto') {
    // 1. Try preferred model first if explicitly requested
    if (preferredModel && preferredModel !== 'auto') {
      try {
        if (preferredModel === 'gemini') {
          const resp = await GeminiService.chat(prompt, history, null, mode, customKeys?.gemini);
          if (!isErrorResponse(resp)) return resp;
        } else if (preferredModel === 'groq') {
          const resp = await GroqService.chat(prompt, history, mode, customKeys?.groq);
          if (!isErrorResponse(resp)) return resp;
        } else if (preferredModel.startsWith('openrouter') || OpenRouterService.isSupportedModel(preferredModel)) {
          const resp = await OpenRouterService.chat(prompt, history, customKeys?.openrouter, mode, preferredModel);
          if (!isErrorResponse(resp)) return resp;
        }
      } catch (e) {
        logger.info(`[AgentCascade] Preferred model (${preferredModel}) failed: ${e.message}`);
      }
    }

    // 2. Cascade Tier 1: Groq (ultra fast, high rate limits)
    try {
      const resp = await GroqService.chat(prompt, history, mode, customKeys?.groq);
      if (!isErrorResponse(resp)) {
        logger.info('[AgentCascade] Handled by Groq');
        return resp;
      }
    } catch (e) {
      logger.info(`[AgentCascade] Groq failed: ${e.message}`);
    }

    // 3. Cascade Tier 2: Gemini (1500 req/day free, smart reasoning)
    try {
      const resp = await GeminiService.chat(prompt, history, null, mode, customKeys?.gemini);
      if (!isErrorResponse(resp)) {
        logger.info('[AgentCascade] Handled by Gemini');
        return resp;
      }
    } catch (e) {
      logger.info(`[AgentCascade] Gemini failed: ${e.message}`);
    }

    // 4. Cascade Tier 3: OpenRouter (multiple verified free models)
    try {
      const resp = await OpenRouterService.chat(prompt, history, customKeys?.openrouter, mode);
      if (!isErrorResponse(resp)) {
        logger.info('[AgentCascade] Handled by OpenRouter');
        return resp;
      }
    } catch (e) {
      logger.info(`[AgentCascade] OpenRouter failed: ${e.message}`);
    }

    // 5. Cascade Tier 4: Cerebras
    try {
      const resp = await CerebrasService.chat(prompt, history, mode, customKeys?.cerebras);
      if (!isErrorResponse(resp)) {
        logger.info('[AgentCascade] Handled by Cerebras');
        return resp;
      }
    } catch (e) {
      logger.info(`[AgentCascade] Cerebras failed: ${e.message}`);
    }

    // 6. Cascade Tier 5: Local Ollama (if running)
    try {
      const ollamaRes = await fetch(`${ollamaBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b', prompt, stream: false }),
        signal: AbortSignal.timeout(45000),
      });
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        if (data.response && data.response.trim()) {
          logger.info('[AgentCascade] Handled by Local Ollama');
          return data.response.trim();
        }
      }
    } catch (_) {}

    // 7. Cascade Tier 6: OpenAI (only if configured and valid)
    if (process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || customKeys?.openai) {
      try {
        const resp = await OpenAIService.chat(prompt, history, mode, customKeys?.openai);
        if (!isErrorResponse(resp)) return resp;
      } catch (e) {
        logger.info(`[AgentCascade] OpenAI failed: ${e.message}`);
      }
    }

    throw new Error('All AI providers in cascade failed. Please verify API keys in .env or settings.');
  }
}

module.exports = AgentCascadeAiService;
