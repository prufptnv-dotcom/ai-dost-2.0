'use strict';

/**
 * AI-Dost 2.0 — WebSearchTool
 *
 * Canonical Tool for autonomous agents to search the live web.
 * Mapped to capability: 'autonomy.web_acquisition'
 */

const Tool = require('../runtime/Tool');
const webSearchService = require('../../services/webSearchService');

class WebSearchTool extends Tool {
  constructor() {
    super({
      name: 'web_search',
      description: 'Searches the live web for real-time information, news, weather, stock prices, or documentation.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'The search query to look up on the web' },
          maxResults: { type: 'number', description: 'Maximum number of results to return (1-10)' }
        }
      },
      permissions: ['network:external']
    });
    this.capabilityId = 'autonomy.web_acquisition';
  }

  async execute(context, input) {
    this.validateInput(input);
    const { query, maxResults = 5 } = input;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return { success: false, error: 'Query is required for web search.' };
    }

    try {
      const searchRes = await webSearchService.search(query.trim(), { maxResults });
      if (!searchRes.success) {
        return {
          success: false,
          code: searchRes.status || 'SEARCH_FAILED',
          error: searchRes.error || 'No live results found for query.'
        };
      }

      return {
        success: true,
        query: searchRes.query,
        provider: searchRes.provider,
        totalResults: searchRes.totalResults,
        results: searchRes.results.map((r, i) => ({
          citationId: i + 1,
          title: r.title,
          url: r.url,
          domain: r.domain,
          snippet: r.snippet,
          publishedDate: r.publishedDate,
          retrievalTimestamp: r.retrievalTimestamp
        }))
      };
    } catch (err) {
      return {
        success: false,
        code: 'EXECUTION_ERROR',
        error: `Web search failed: ${err.message}`
      };
    }
  }
}

module.exports = WebSearchTool;
