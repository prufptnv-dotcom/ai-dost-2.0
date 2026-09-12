'use strict';

/**
 * AI-Dost 2.0 — Web Capability & Intent Classifier
 *
 * Classifies incoming user queries into web-access categories:
 * - CURRENT_INFO: Latest developments, current dates/facts
 * - NEWS: Breaking news, headlines, current events
 * - WEATHER: Temperature, forecasts, rain, regional climate
 * - FINANCE: Stock prices, cryptocurrency, market indices, commodity rates
 * - PRODUCT_PRICES: Hardware, gadgets, commercial goods pricing
 * - WEB_SEARCH: Search queries, websites, company/person discovery
 * - DOCS_LOOKUP: Official library, API, framework documentation
 * - URL_FETCH: User provided explicit HTTP/HTTPS link to read/summarize
 * - GENERAL_KNOWLEDGE: Coding, math, greetings, general reasoning (NO WEB NEEDED)
 *
 * Avoids unnecessary web requests when offline / model knowledge suffices.
 */

const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/gi;

const PATTERNS = {
  NEWS: /\b(news|khabar|samachar|breaking news|headline|headlines|latest updates?|aaj ki khabar)\b/i,
  WEATHER: /\b(weather|temperature|mausam|forecast|humidity|barish|rainfall|wind speed|climate today)\b/i,
  FINANCE: /\b(stock price|share price|crypto|cryptocurrency|bitcoin|btc|eth|ethereum|nifty|sensex|dow jones|nasdaq|gold rate|gold price|silver rate|bhav|market price|pe ratio)\b/i,
  PRODUCT_PRICES: /\b(price of|cost of|kitne ka hai|rate of|market cost|discount on|buying price|launch price)\b/i,
  DOCS_LOOKUP: /\b(documentation|official docs|api reference|docs for|changelog of|release notes of|spec sheet)\b/i,
  CURRENT_INFO: /\b(latest|current|recent|today'?s|yesterday'?s|this week|this month|this year|right now|currently|aaj ka|aaj ki|abhi ka|haal hi me|nay?a update)\b/i,
  WEB_SEARCH: /\b(search web|search online|google karo|google pe dhundho|internet par|find online|search the web|pata karo|dhundho internet pe)\b/i
};

// Explicit non-web keywords to guard against false triggers (pure coding, math, general chat)
const NON_WEB_TRIGGERS = [
  /\b(write code|write a function|debug this|refactor|fix syntax|write regex|create component)\b/i,
  /\b(solve equation|calculate|derive|differentiate|integrate|step by step math)\b/i,
  /\b(translate to|anuvad karo|say in hindi|say in english)\b/i,
  /\b(write a poem|write a story|kavita likho|kahani sunao|write essay)\b/i,
  /^(hi|hello|hey|namaste|kese ho|how are you|who are you|kya haal|good morning|good night)[\s!.]*$/i
];

/**
 * Classifies a user message to determine if live web access is necessary.
 *
 * @param {string} message
 * @param {object} [options]
 * @returns {{
 *   needsWeb: boolean,
 *   intent: 'URL_FETCH' | 'NEWS' | 'WEATHER' | 'FINANCE' | 'PRODUCT_PRICES' | 'DOCS_LOOKUP' | 'CURRENT_INFO' | 'WEB_SEARCH' | 'GENERAL_KNOWLEDGE',
 *   query: string,
 *   extractedUrls: string[],
 *   reason: string
 * }}
 */
function classifyWebIntent(message, options = {}) {
  if (!message || typeof message !== 'string') {
    return {
      needsWeb: false,
      intent: 'GENERAL_KNOWLEDGE',
      query: '',
      extractedUrls: [],
      reason: 'Empty message'
    };
  }

  const text = message.trim();

  // 1. Check for explicit URL in message -> URL_FETCH
  const extractedUrls = text.match(URL_REGEX) || [];
  if (extractedUrls.length > 0) {
    const isFetchInstruction = /\b(open|read|summarize|summary|extract|parse|kholo|padho|batao|dekho|check)\b/i.test(text) || text.length < 150;
    if (isFetchInstruction || extractedUrls.length === 1) {
      return {
        needsWeb: true,
        intent: 'URL_FETCH',
        query: text,
        extractedUrls,
        reason: 'User provided one or more URLs to inspect/read.'
      };
    }
  }

  // 2. Check if this is an explicit non-web task (pure code, math, greetings)
  for (const nonWebRe of NON_WEB_TRIGGERS) {
    if (nonWebRe.test(text)) {
      // Only suppress if there are NO explicit current-event overrides (e.g. "latest node 22 release notes")
      if (!PATTERNS.CURRENT_INFO.test(text) && !PATTERNS.NEWS.test(text)) {
        return {
          needsWeb: false,
          intent: 'GENERAL_KNOWLEDGE',
          query: text,
          extractedUrls: [],
          reason: 'Classified as local/coding/math/greeting where web access is unneeded.'
        };
      }
    }
  }

  // 3. Match against specific real-time web access categories
  if (PATTERNS.WEATHER.test(text)) {
    return {
      needsWeb: true,
      intent: 'WEATHER',
      query: cleanQueryForSearch(text, 'weather'),
      extractedUrls: [],
      reason: 'Live weather or atmospheric conditions requested.'
    };
  }

  if (PATTERNS.FINANCE.test(text)) {
    return {
      needsWeb: true,
      intent: 'FINANCE',
      query: cleanQueryForSearch(text, 'finance'),
      extractedUrls: [],
      reason: 'Live stock, crypto, index, or commodity prices requested.'
    };
  }

  if (PATTERNS.NEWS.test(text)) {
    return {
      needsWeb: true,
      intent: 'NEWS',
      query: cleanQueryForSearch(text, 'news'),
      extractedUrls: [],
      reason: 'Breaking news or current event updates requested.'
    };
  }

  if (PATTERNS.PRODUCT_PRICES.test(text)) {
    return {
      needsWeb: true,
      intent: 'PRODUCT_PRICES',
      query: cleanQueryForSearch(text, 'product_prices'),
      extractedUrls: [],
      reason: 'Current commercial product pricing requested.'
    };
  }

  if (PATTERNS.DOCS_LOOKUP.test(text)) {
    return {
      needsWeb: true,
      intent: 'DOCS_LOOKUP',
      query: cleanQueryForSearch(text, 'docs'),
      extractedUrls: [],
      reason: 'Latest software documentation or API specification requested.'
    };
  }

  if (PATTERNS.CURRENT_INFO.test(text)) {
    return {
      needsWeb: true,
      intent: 'CURRENT_INFO',
      query: cleanQueryForSearch(text, 'current_info'),
      extractedUrls: [],
      reason: 'Time-sensitive or current factual information requested.'
    };
  }

  if (PATTERNS.WEB_SEARCH.test(text)) {
    return {
      needsWeb: true,
      intent: 'WEB_SEARCH',
      query: cleanQueryForSearch(text, 'web_search'),
      extractedUrls: [],
      reason: 'Explicit user request to search the web.'
    };
  }

  // Default: General knowledge, no unnecessary web request
  return {
    needsWeb: false,
    intent: 'GENERAL_KNOWLEDGE',
    query: text,
    extractedUrls: [],
    reason: 'General knowledge query; web access not required.'
  };
}

/**
 * Cleans user prompt into an effective search engine query.
 */
function cleanQueryForSearch(text, category) {
  let cleaned = text
    .replace(/\b(search|search the web|google|google it|pata karo|dhundho|batao|kya hai|tell me|please|mujhe)\b/gi, ' ')
    .replace(/\b(karo|kar ke do|do|karke|dikhao|bata)\b/gi, ' ')
    .replace(/[?!,;:'"()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If cleaning resulted in too short query, fallback to trimmed original
  if (cleaned.length < 3) {
    cleaned = text.trim();
  }

  return cleaned;
}

module.exports = {
  classifyWebIntent,
  cleanQueryForSearch,
  PATTERNS
};
