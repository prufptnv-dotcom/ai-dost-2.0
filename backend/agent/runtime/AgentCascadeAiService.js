'use strict';

const logger = require('../../logger');
const GroqService = require('../../services/groqService');
const GeminiService = require('../../services/geminiService');
const NvidiaService = require('../../services/nvidiaService');
const DeepSeekService = require('../../services/deepseekService');
const MistralService = require('../../services/mistralService');
const TogetherService = require('../../services/togetherService');
const OpenRouterService = require('../../services/openrouterService');
const CerebrasService = require('../../services/cerebrasService');
const OpenAIService = require('../../services/openaiService');
const { ollamaBaseUrl } = require('../../services/ollamaEnv');

const { isRateLimitedOrError } = require('../../utils/chatUtils');

function isErrorResponse(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (!t || t.length < 5) return true;
  const lower = t.toLowerCase();

  // If chatUtils recognizes it as a rate limit or error, reject immediately
  if (isRateLimitedOrError(t)) return true;

  // Specific service error sentinels and error prefixes
  if (
    t === 'GROQ_RATE_LIMITED' ||
    t === 'GROQ_CIRCUIT_OPEN' ||
    t === 'NVIDIA_RATE_LIMITED' ||
    t === 'NVIDIA_CIRCUIT_OPEN' ||
    t === 'Gemini response decode nahi ho paya.' ||
    lower.includes('api key set nahi') ||
    lower.includes('api key not found') ||
    lower.includes('service me error') ||
    lower.includes('service error') ||
    lower.startsWith('groq service') ||
    lower.startsWith('gemini service') ||
    lower.startsWith('nvidia service') ||
    lower.startsWith('openrouter service') ||
    lower.startsWith('cerebras error') ||
    lower.startsWith('openai error') ||
    lower.includes('404 page not found') ||
    lower.includes('chat client disconnected') ||
    lower.includes('rate_limit_exceeded') ||
    lower.includes('groq_rate_limited') ||
    lower.includes('gemini_rate_limited') ||
    lower.includes('gemini_circuit_open') ||
    lower.includes('nvidia_rate_limited') ||
    lower.includes('nvidia_circuit_open') ||
    lower.includes('openrouter_rate_limited') ||
    lower.includes('credit_balance_exhausted') ||
    lower.includes('circuit breaker open') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota exceeded') ||
    lower.includes('request too large') ||
    lower.includes('tool choice is none')
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
    // 1. Try preferred model or adaptive route first
    if (preferredModel && preferredModel !== 'auto') {
      try {
        if (preferredModel === 'reasoning') {
          // Adaptive reasoning route: prioritize DeepSeek / Gemini reasoning capabilities
          if (process.env.DEEPSEEK_API_KEY || customKeys?.deepseek) {
            try {
              const resp = await DeepSeekService.chat(prompt, history, customKeys?.deepseek);
              if (!isErrorResponse(resp)) {
                logger.info('[AgentCascade] Handled by DeepSeek (adaptive reasoning route)');
                return resp;
              }
            } catch (_) {}
          }
          try {
            const resp = await GeminiService.chat(prompt, history, null, mode, customKeys?.gemini);
            if (!isErrorResponse(resp)) {
              logger.info('[AgentCascade] Handled by Gemini (adaptive reasoning route)');
              return resp;
            }
          } catch (_) {}
        } else if (preferredModel === 'fast') {
          // Adaptive fast route: prioritize Groq ultra-low-latency provider
          try {
            const resp = await GroqService.chat(prompt, history, mode, customKeys?.groq);
            if (!isErrorResponse(resp)) {
              logger.info('[AgentCascade] Handled by Groq (adaptive fast route)');
              return resp;
            }
          } catch (_) {}
        } else if (preferredModel === 'gemini') {
          const resp = await GeminiService.chat(prompt, history, null, mode, customKeys?.gemini);
          if (!isErrorResponse(resp)) return resp;
        } else if (preferredModel === 'groq') {
          const resp = await GroqService.chat(prompt, history, mode, customKeys?.groq);
          if (!isErrorResponse(resp)) return resp;
        } else if (preferredModel === 'ollama') {
          // P12.6: the UI picker offers Ollama but this cascade had no branch
          // for it â€” "Ollama first" silently degraded to Groqâ†’Geminiâ†’OpenRouterâ†’â€¦
          // (every dead tier walked first). Same call shape as tier 5 below.
          const ollamaRes = await fetch(`${ollamaBaseUrl()}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b', prompt, stream: false, keep_alive: '2h' }),
            // P12.7 (E2E run #13): warm qwen2.5-coder:7b took 140â€“150s for a
            // long plan JSON at ~14 tok/s â€” the old 150s limit timed out twice
            // ("All AI providers in cascade failed") and only squeaked through
            // at 149s on the third try. 240s = cold load (115s) + long
            // generation with real headroom.
            signal: AbortSignal.timeout(240000),
          });
          if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            if (data.response && data.response.trim()) {
              logger.info('[AgentCascade] Handled by preferred Local Ollama');
              return data.response.trim();
            }
          }
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

    // 4. Cascade Tier 3: NVIDIA NIM
    if (process.env.NVIDIA_API_KEY || customKeys?.nvidia) {
      try {
        const resp = await NvidiaService.chat(prompt, history, customKeys?.nvidia, mode);
        if (!isErrorResponse(resp)) {
          logger.info('[AgentCascade] Handled by NVIDIA');
          return resp;
        }
      } catch (e) {
        logger.info(`[AgentCascade] NVIDIA failed: ${e.message}`);
      }
    }

    // 5. Cascade Tier 4: DeepSeek
    if (process.env.DEEPSEEK_API_KEY || customKeys?.deepseek) {
      try {
        const resp = await DeepSeekService.chat(prompt, history, customKeys?.deepseek);
        if (!isErrorResponse(resp)) {
          logger.info('[AgentCascade] Handled by DeepSeek');
          return resp;
        }
      } catch (e) {
        logger.info(`[AgentCascade] DeepSeek failed: ${e.message}`);
      }
    }

    // 6. Cascade Tier 5: Mistral
    if (process.env.MISTRAL_API_KEY || customKeys?.mistral) {
      try {
        const resp = await MistralService.chat(prompt, history, customKeys?.mistral, mode);
        if (!isErrorResponse(resp)) {
          logger.info('[AgentCascade] Handled by Mistral');
          return resp;
        }
      } catch (e) {
        logger.info(`[AgentCascade] Mistral failed: ${e.message}`);
      }
    }

    // 7. Cascade Tier 6: Together AI
    if (process.env.TOGETHER_API_KEY || customKeys?.together) {
      try {
        const resp = await TogetherService.chat(prompt, history, customKeys?.together);
        if (!isErrorResponse(resp)) {
          logger.info('[AgentCascade] Handled by Together');
          return resp;
        }
      } catch (e) {
        logger.info(`[AgentCascade] Together failed: ${e.message}`);
      }
    }

    // 8. Cascade Tier 7: OpenRouter (multiple verified free models)
    try {
      const resp = await OpenRouterService.chat(prompt, history, customKeys?.openrouter, mode);
      if (!isErrorResponse(resp)) {
        logger.info('[AgentCascade] Handled by OpenRouter');
        return resp;
      }
    } catch (e) {
      logger.info(`[AgentCascade] OpenRouter failed: ${e.message}`);
    }

    // 9. Cascade Tier 8: Cerebras
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
    //   keep_alive pins the model after a successful load (default unload is
    //   5min â€” a cold 4.7GB reload takes ~115s). 240s (P12.7) covers that cold
    //   load PLUS a long warm generation: run #13 measured 140â€“150s for plan
    //   JSON at ~14 tok/s, so the old 150s limit was an edge-flake. When the
    //   daemon is DOWN this fetch fails instantly (ECONNREFUSED), so no wait
    //   is added on that path.
    try {
      const ollamaRes = await fetch(`${ollamaBaseUrl()}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b', prompt, stream: false, keep_alive: '2h' }),
        signal: AbortSignal.timeout(240000),
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
