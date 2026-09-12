'use strict';

/**
 * AI-Dost 2.0 — Pluggable Web Search Service
 *
 * Provider Abstraction supporting:
 * - Tavily Search API (Primary with key)
 * - Google Gemini Grounded Search (Secondary with key)
 * - DuckDuckGo Instant Answer / HTML Search (Keyless fallback)
 * - Wikipedia Knowledge Search (Keyless fallback)
 *
 * Enforces:
 * - Result normalization (title, url, domain, snippet, date, timestamp, reliability)
 * - Secret redaction
 * - Honest error & empty state handling (NO fabricated citations)
 */

const logger = require('../logger');
const { config, redactSensitive, getPublicConfig } = require('../config/webAccessConfig');

class BaseSearchProvider {
  constructor(name) {
    this.name = name;
  }

  async search(query, options = {}) {
    throw new Error(`search() must be implemented by provider '${this.name}'`);
  }

  extractDomain(rawUrl) {
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch (_) {
      return 'web-source';
    }
  }

  normalizeItem({ title, url, snippet, publishedDate = null, reliability = 'standard' }) {
    return {
      title: (title || 'Web Source').trim(),
      url: (url || '').trim(),
      domain: this.extractDomain(url),
      snippet: (snippet || '').replace(/<[^>]+>/g, '').trim(),
      publishedDate: publishedDate || null,
      retrievalTimestamp: new Date().toISOString(),
      reliability
    };
  }
}

/**
 * Tavily Search Provider
 */
class TavilySearchProvider extends BaseSearchProvider {
  constructor() {
    super('tavily');
  }

  isConfigured() {
    return !!(config.tavilyApiKey && !config.tavilyApiKey.includes('your_') && !config.tavilyApiKey.includes('here'));
  }

  async search(query, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, code: 'CONFIGURATION_REQUIRED', error: 'Tavily API key is not configured in .env' };
    }

    const maxResults = options.maxResults || config.maxSearchResults;
    const timeoutMs = options.timeoutMs || config.searchTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: config.tavilyApiKey,
          query: query,
          search_depth: options.depth || 'basic',
          include_answer: true,
          include_images: false,
          max_results: maxResults
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (resp.status === 401 || resp.status === 403) {
        return { success: false, code: 'INVALID_API_KEY', error: 'Tavily API key is invalid or unauthorized.' };
      }

      if (resp.status === 429) {
        return { success: false, code: 'RATE_LIMITED', error: 'Tavily search rate limit reached.' };
      }

      if (!resp.ok) {
        return { success: false, code: `HTTP_${resp.status}`, error: `Tavily API returned status ${resp.status}` };
      }

      const data = await resp.json();
      const rawResults = data.results || [];
      const normalized = rawResults
        .filter(r => r && r.url)
        .map(r => this.normalizeItem({
          title: r.title,
          url: r.url,
          snippet: r.content || r.snippet,
          publishedDate: r.published_date,
          reliability: r.score && r.score > 0.8 ? 'high' : 'standard'
        }));

      return {
        success: true,
        provider: this.name,
        answer: data.answer || null,
        results: normalized,
        totalResults: normalized.length
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError' || err.message.includes('aborted');
      return {
        success: false,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
        error: isTimeout ? `Tavily search timed out after ${timeoutMs}ms.` : redactSensitive(err.message)
      };
    }
  }
}

/**
 * Gemini Grounding Search Provider
 */
class GeminiGroundingProvider extends BaseSearchProvider {
  constructor() {
    super('gemini-grounding');
  }

  isConfigured() {
    return !!(config.geminiApiKey && !config.geminiApiKey.includes('your_'));
  }

  async search(query, options = {}) {
    if (!this.isConfigured()) {
      return { success: false, code: 'CONFIGURATION_REQUIRED', error: 'Gemini API key is not configured.' };
    }

    const timeoutMs = options.timeoutMs || config.searchTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${config.geminiApiKey}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2 }
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (resp.status === 429) {
        return { success: false, code: 'RATE_LIMITED', error: 'Gemini search quota exceeded.' };
      }

      if (!resp.ok) {
        return { success: false, code: `HTTP_${resp.status}`, error: `Gemini API returned status ${resp.status}` };
      }

      const data = await resp.json();
      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map(p => p.text).filter(Boolean).join('\n');

      const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks
        .filter(c => c && c.web && c.web.uri)
        .map(c => this.normalizeItem({
          title: c.web.title || c.web.uri,
          url: c.web.uri,
          snippet: text ? text.slice(0, 300) : '',
          reliability: 'high'
        }))
        .slice(0, options.maxResults || config.maxSearchResults);

      return {
        success: true,
        provider: this.name,
        answer: text || null,
        results: sources,
        totalResults: sources.length
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError' || err.message.includes('aborted');
      return {
        success: false,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
        error: isTimeout ? `Gemini search timed out after ${timeoutMs}ms.` : redactSensitive(err.message)
      };
    }
  }
}

/**
 * DuckDuckGo Search Provider (Keyless)
 */
class DuckDuckGoProvider extends BaseSearchProvider {
  constructor() {
    super('duckduckgo');
  }

  async search(query, options = {}) {
    const timeoutMs = options.timeoutMs || 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // DuckDuckGo Instant Answer API
      const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Dost/2.0'
        }
      });

      clearTimeout(timer);

      if (!resp.ok) {
        return { success: false, code: `HTTP_${resp.status}`, error: `DuckDuckGo returned ${resp.status}` };
      }

      const data = await resp.json();
      const results = [];

      if (data.AbstractURL && data.AbstractText) {
        results.push(this.normalizeItem({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
          reliability: 'standard'
        }));
      }

      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (topic.FirstURL && topic.Text) {
            results.push(this.normalizeItem({
              title: topic.Text.slice(0, 80),
              url: topic.FirstURL,
              snippet: topic.Text,
              reliability: 'standard'
            }));
          }
        }
      }

      const capped = results.slice(0, options.maxResults || config.maxSearchResults);
      return {
        success: true,
        provider: this.name,
        answer: data.AbstractText || null,
        results: capped,
        totalResults: capped.length
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError';
      return {
        success: false,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
        error: isTimeout ? 'DuckDuckGo search timed out.' : err.message
      };
    }
  }
}

/**
 * Wikipedia Search Provider (Keyless, fast, high factual density)
 */
class WikipediaSearchProvider extends BaseSearchProvider {
  constructor() {
    super('wikipedia');
  }

  async search(query, options = {}) {
    const timeoutMs = options.timeoutMs || 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=5&utf8=1`;
      const resp = await fetch(wikiUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AI-Dost/2.0 (education/research bot)' }
      });

      clearTimeout(timer);

      if (!resp.ok) {
        return { success: false, code: `HTTP_${resp.status}`, error: `Wikipedia API returned ${resp.status}` };
      }

      const data = await resp.json();
      const hits = data?.query?.search || [];

      if (hits.length === 0) {
        return { success: true, provider: this.name, results: [], totalResults: 0, answer: null };
      }

      const results = hits.map(hit => this.normalizeItem({
        title: hit.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        snippet: hit.snippet ? hit.snippet.replace(/<[^>]+>/g, '') : '',
        publishedDate: hit.timestamp || null,
        reliability: 'high'
      }));

      // Fetch summary of top hit for answer text
      let topExtract = null;
      try {
        const sumResp = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hits[0].title.replace(/ /g, '_'))}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (sumResp.ok) {
          const sumData = await sumResp.json();
          topExtract = sumData.extract || null;
        }
      } catch (_) {}

      return {
        success: true,
        provider: this.name,
        answer: topExtract,
        results: results.slice(0, options.maxResults || config.maxSearchResults),
        totalResults: results.length
      };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err.name === 'AbortError';
      return {
        success: false,
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
        error: isTimeout ? 'Wikipedia search timed out.' : err.message
      };
    }
  }
}

/**
 * Unified Web Search Service Orchestrator
 */
class WebSearchService {
  constructor() {
    this.providers = {
      tavily: new TavilySearchProvider(),
      gemini: new GeminiGroundingProvider(),
      duckduckgo: new DuckDuckGoProvider(),
      wikipedia: new WikipediaSearchProvider()
    };
  }

  /**
   * Search the web using the configured provider or automatic failover cascade.
   *
   * Cascade priority:
   * 1. Tavily (if configured)
   * 2. Gemini Grounding (if configured)
   * 3. Wikipedia
   * 4. DuckDuckGo
   *
   * @param {string} query
   * @param {object} [options]
   * @returns {Promise<{ success: boolean, query: string, provider: string, answer: string|null, results: Array, totalResults: number, status: string, error?: string }>}
   */
  async search(query, options = {}) {
    if (!config.enabled) {
      logger.info('🌐 [WebSearchService] Web search is disabled by configuration.');
      return {
        success: false,
        query,
        provider: 'disabled',
        answer: null,
        results: [],
        totalResults: 0,
        status: 'DISABLED',
        error: 'Web search capability is currently disabled in system settings.'
      };
    }

    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        success: false,
        query: '',
        provider: 'none',
        answer: null,
        results: [],
        totalResults: 0,
        status: 'INVALID_QUERY',
        error: 'Search query must be a non-empty string.'
      };
    }

    const cleanQuery = query.trim();
    const requestedProvider = (options.provider || config.provider).toLowerCase();

    // 1. Direct provider request (if explicitly configured and not 'auto')
    if (requestedProvider !== 'auto' && this.providers[requestedProvider]) {
      const providerInstance = this.providers[requestedProvider];
      logger.info(`🌐 [WebSearchService] Querying explicit provider '${requestedProvider}' for: "${cleanQuery}"`);
      const res = await providerInstance.search(cleanQuery, options);
      if (res.success) {
        return {
          success: true,
          query: cleanQuery,
          provider: res.provider,
          answer: res.answer || null,
          results: res.results || [],
          totalResults: res.totalResults || 0,
          status: (res.results && res.results.length > 0) ? 'SUCCESS' : 'NO_RESULTS'
        };
      }
      logger.warn(`🌐 [WebSearchService] Provider '${requestedProvider}' failed (${res.code}): ${res.error}. Falling back to cascade.`);
    }

    // 2. Cascade Search
    const cascadeOrder = ['tavily', 'gemini', 'wikipedia', 'duckduckgo'];
    let lastError = null;

    for (const provName of cascadeOrder) {
      const prov = this.providers[provName];
      if (!prov) continue;

      if (typeof prov.isConfigured === 'function' && !prov.isConfigured()) {
        continue;
      }

      try {
        logger.info(`🌐 [WebSearchService] Cascade trying provider: ${provName}`);
        const result = await prov.search(cleanQuery, options);
        if (result.success && Array.isArray(result.results) && result.results.length > 0) {
          logger.info(`✅ [WebSearchService] Provider '${provName}' succeeded with ${result.results.length} sources.`);
          return {
            success: true,
            query: cleanQuery,
            provider: result.provider,
            answer: result.answer || null,
            results: result.results,
            totalResults: result.totalResults,
            status: 'SUCCESS'
          };
        }
        if (result.success && result.results && result.results.length === 0) {
          logger.info(`ℹ️ [WebSearchService] Provider '${provName}' returned 0 results. Trying next.`);
        } else {
          lastError = result.error || 'Provider failed';
        }
      } catch (err) {
        lastError = err.message;
        logger.warn(`🌐 [WebSearchService] Provider '${provName}' exception: ${err.message}`);
      }
    }

    // If all providers exhausted and returned 0 results or failed
    logger.warn(`⚠️ [WebSearchService] All providers exhausted for query: "${cleanQuery}". Last error: ${lastError}`);
    return {
      success: false,
      query: cleanQuery,
      provider: 'all_failed',
      answer: null,
      results: [],
      totalResults: 0,
      status: 'NO_RESULTS',
      error: lastError || 'Could not find verified live web results for this query.'
    };
  }
}

const defaultWebSearchService = new WebSearchService();
defaultWebSearchService.WebSearchService = WebSearchService;
defaultWebSearchService.TavilySearchProvider = TavilySearchProvider;
defaultWebSearchService.GeminiGroundingProvider = GeminiGroundingProvider;
defaultWebSearchService.DuckDuckGoProvider = DuckDuckGoProvider;
defaultWebSearchService.WikipediaSearchProvider = WikipediaSearchProvider;

module.exports = defaultWebSearchService;
