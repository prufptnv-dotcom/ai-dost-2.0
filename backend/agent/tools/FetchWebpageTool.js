'use strict';

/**
 * AI-Dost 2.0 — FetchWebpageTool
 *
 * Canonical Tool for autonomous agents to open and read public webpages.
 * Enforces strict SSRF protection and sanitization via urlFetcherService.
 * Mapped to capability: 'autonomy.web_acquisition'
 */

const Tool = require('../runtime/Tool');
const { fetchSafeUrl } = require('../../services/urlFetcherService');

class FetchWebpageTool extends Tool {
  constructor() {
    super({
      name: 'fetch_webpage',
      description: 'Safely opens and reads the readable text content of a public URL with strict SSRF defense.',
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'The public HTTP/HTTPS URL to fetch and read' },
          maxLength: { type: 'number', description: 'Maximum extracted characters to return (default 8000)' }
        }
      },
      permissions: ['network:external']
    });
    this.capabilityId = 'autonomy.web_acquisition';
  }

  async execute(context, input) {
    this.validateInput(input);
    const { url, maxLength = 8000 } = input;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return { success: false, error: 'Valid URL is required.' };
    }

    try {
      const result = await fetchSafeUrl(url.trim(), { maxExtractedChars: maxLength });
      if (!result.success) {
        return {
          success: false,
          code: result.code || 'FETCH_FAILED',
          error: result.error || 'Failed to safely fetch webpage.'
        };
      }

      return {
        success: true,
        url: result.url,
        finalUrl: result.finalUrl,
        title: result.title,
        domain: result.domain,
        content: result.content,
        wordCount: result.wordCount,
        fetchedAt: result.fetchedAt
      };
    } catch (err) {
      return {
        success: false,
        code: 'EXECUTION_ERROR',
        error: `URL fetcher error: ${err.message}`
      };
    }
  }
}

module.exports = FetchWebpageTool;
