'use strict';

/**
 * AI-Dost 2.0 — Web Access & Search Configuration
 * 
 * Secure configuration module for Web Access capability.
 * Loads environment variables, validates boundaries, and provides key redaction.
 * Sensitive keys are never returned to client bundles or logged in plaintext.
 */

require('dotenv').config();

const config = {
  // Master toggle for web search & access
  enabled: process.env.WEB_SEARCH_ENABLED !== 'false',

  // Configured primary provider: 'auto' | 'tavily' | 'duckduckgo' | 'gemini' | 'wikipedia'
  provider: (process.env.WEB_SEARCH_PROVIDER || 'auto').toLowerCase(),

  // Provider credentials (loaded securely from .env)
  tavilyApiKey: process.env.TAVILY_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Network & Safety Limits
  searchTimeoutMs: parseInt(process.env.WEB_SEARCH_TIMEOUT_MS, 10) || 15000,
  maxSearchResults: Math.min(Math.max(parseInt(process.env.WEB_SEARCH_MAX_RESULTS, 10) || 6, 1), 15),

  // URL Fetcher Limits (SSRF & DoS Protection)
  urlFetchTimeoutMs: parseInt(process.env.URL_FETCH_TIMEOUT_MS, 10) || 10000,
  urlFetchMaxSizeBytes: parseInt(process.env.URL_FETCH_MAX_SIZE_BYTES, 10) || (2 * 1024 * 1024), // 2 MB
  urlFetchMaxRedirects: parseInt(process.env.URL_FETCH_MAX_REDIRECTS, 10) || 5,
  maxExtractedChars: parseInt(process.env.URL_FETCH_MAX_EXTRACTED_CHARS, 10) || 10000,

  // Allowed protocols
  allowedProtocols: ['http:', 'https:'],

  // Disallowed hosts / patterns for SSRF
  blockedHostPatterns: [
    /^localhost$/i,
    /^127\./,
    /^0\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^metadata\.google\.internal$/i,
    /^instance-data$/i,
    /^\[::1\]$/,
    /^\[0:0:0:0:0:0:0:1\]$/,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i
  ]
};

/**
 * Redacts any detected API keys or sensitive strings from text/logs.
 * @param {string} text
 * @returns {string}
 */
function redactSensitive(text) {
  if (!text || typeof text !== 'string') return text;
  let sanitized = text;

  const secrets = [
    config.tavilyApiKey,
    config.geminiApiKey,
    process.env.OPENAI_API_KEY,
    process.env.GROQ_API_KEY,
    process.env.NVIDIA_API_KEY
  ].filter(s => s && s.length > 5 && !s.includes('your_') && !s.includes('here'));

  for (const secret of secrets) {
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitized = sanitized.replace(new RegExp(escaped, 'g'), '[REDACTED_SECRET]');
  }

  return sanitized;
}

/**
 * Returns safe public configuration without leaking secret keys.
 */
function getPublicConfig() {
  const hasTavily = !!(config.tavilyApiKey && !config.tavilyApiKey.includes('your_'));
  const hasGemini = !!(config.geminiApiKey && !config.geminiApiKey.includes('your_'));

  let effectiveProvider = config.provider;
  let status = 'READY';

  if (!config.enabled) {
    status = 'DISABLED';
  } else if (effectiveProvider === 'tavily' && !hasTavily) {
    status = 'CONFIGURATION_REQUIRED';
  } else if (effectiveProvider === 'gemini' && !hasGemini) {
    status = 'CONFIGURATION_REQUIRED';
  }

  return {
    enabled: config.enabled,
    provider: config.provider,
    status,
    hasTavilyKey: hasTavily,
    hasGeminiKey: hasGemini,
    searchTimeoutMs: config.searchTimeoutMs,
    maxSearchResults: config.maxSearchResults,
    urlFetchTimeoutMs: config.urlFetchTimeoutMs,
    maxExtractedChars: config.maxExtractedChars
  };
}

module.exports = {
  config,
  redactSensitive,
  getPublicConfig
};
