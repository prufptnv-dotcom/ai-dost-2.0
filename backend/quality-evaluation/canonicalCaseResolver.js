'use strict';

/**
 * AI-Dost Authoritative Canonical Case Resolver
 * Deterministically maps user requests and workspace context to real IDs defined in canonicalCases.json.
 * 
 * Rules:
 * - Resolves ONLY to IDs present in canonicalCases.json.
 * - If unsupported or unmatched, returns NOT_EVALUATED with an explicit reason.
 * - Never returns nonexistent case IDs (such as 'landing_page').
 */

const path = require('path');
const canonicalCasesData = require('./canonicalCases.json');

const CANONICAL_CASES = canonicalCasesData.cases || [];
const CANONICAL_CASE_MAP = new Map(CANONICAL_CASES.map((c) => [c.id, c]));
const CANONICAL_CASE_IDS = Array.from(CANONICAL_CASE_MAP.keys());

/**
 * Canonical matchers with strict, deterministic keyword and semantic signal sets.
 */
const CANONICAL_MATCHERS = [
  {
    id: 'landing-page-hero-features-cta',
    matcher: (text) => {
      // Must have landing page, hero, product landing signals, or pricing toggle with features
      if (/\blanding\s+page\b/i.test(text)) return true;
      if (/\bhero\s+(?:section|banner|headline)\b/i.test(text) && /\b(?:features?|pricing|cta|call\s+to\s+action)\b/i.test(text)) return true;
      if (/\bproduct\s+landing\b/i.test(text)) return true;
      if (/\b(?:pricing\s+toggle|newsletter\s+form)\b/i.test(text) && /\b(?:hero|features?)\b/i.test(text)) return true;
      return false;
    }
  },
  {
    id: 'dashboard-search-charts-csv',
    matcher: (text) => {
      // Analytics or finance dashboard with charts, search, metrics, or csv export
      if (/\b(?:analytics|metrics|finance|admin)\s+dashboard\b/i.test(text)) return true;
      if (/\bdashboard\b/i.test(text) && /\b(?:charts?|data\s+table|csv\s+export|search\s+across)\b/i.test(text)) return true;
      if (/\bcsv\s+export\b/i.test(text) && /\b(?:charts?|dashboard|table)\b/i.test(text)) return true;
      return false;
    }
  },
  {
    id: 'ecommerce-cart-checkout',
    matcher: (text) => {
      // E-commerce store, product catalog with cart, promo code, checkout
      if (/\b(?:e-?commerce|online\s+store|shopping\s+catalog)\b/i.test(text)) return true;
      if (/\b(?:product\s+catalog|product\s+detail\s+modal)\b/i.test(text) && /\b(?:cart|checkout)\b/i.test(text)) return true;
      if (/\b(?:cart\s+drawer|shopping\s+cart)\b/i.test(text) && /\b(?:checkout|promo\s+code)\b/i.test(text)) return true;
      if (/\badd-to-cart\b/i.test(text) && /\bcheckout\b/i.test(text)) return true;
      return false;
    }
  },
  {
    id: 'education-quiz-progress',
    matcher: (text) => {
      // Educational quiz, trivia, timed questions with progress and score
      if (/\b(?:education(?:al)?\s+quiz|quiz\s+application|quiz\s+app|trivia\s+app)\b/i.test(text)) return true;
      if (/\bquiz\b/i.test(text) && /\b(?:timed\s+questions|high\s+scores?|progress\s+bar)\b/i.test(text)) return true;
      return false;
    }
  },
  {
    id: 'api-backed-crud',
    matcher: (text) => {
      // Full-stack REST API with Express and React CRUD
      if (/\b(?:api-backed\s+crud|full-?stack\s+(?:api-backed\s+)?crud)\b/i.test(text)) return true;
      if (/\b(?:express\s+backend|rest\s+api)\b/i.test(text) && /\bcrud\b/i.test(text)) return true;
      if (/\b\/api\/items\b/i.test(text)) return true;
      if (/\bcrud\s+mutations?\b/i.test(text) && /\b(?:express|react|rest)\b/i.test(text)) return true;
      return false;
    }
  },
  {
    id: 'multi-step-repair',
    matcher: (text) => {
      // Code repair, surgical diff, unhandled runtime exception fix
      if (/\b(?:multi-?step\s+(?:code\s+)?repair|surgical\s+diffs?)\b/i.test(text)) return true;
      if (/\b(?:fix\s+syntax\s+error|unhandled\s+runtime\s+exception)\b/i.test(text) && /\b(?:repair|root\s+cause)\b/i.test(text)) return true;
      return false;
    }
  }
];

/**
 * Resolves request and optional workspace files to an authoritative canonical case.
 * @param {string} request
 * @param {Object} [workspaceFiles]
 * @returns {{ canonicalCase: string|null, caseDef: Object|null, status: 'EVALUABLE'|'NOT_EVALUATED', reason: string|null }}
 */
function resolveCanonicalCase(request = '', workspaceFiles = {}) {
  const text = String(request || '').trim();
  if (!text) {
    return {
      canonicalCase: null,
      caseDef: null,
      status: 'NOT_EVALUATED',
      reason: 'Empty request provided'
    };
  }

  // 1. Direct ID check
  for (const caseId of CANONICAL_CASE_IDS) {
    if (text === caseId || text.toLowerCase() === caseId.toLowerCase()) {
      const caseDef = CANONICAL_CASE_MAP.get(caseId);
      return {
        canonicalCase: caseId,
        caseDef,
        status: 'EVALUABLE',
        reason: null
      };
    }
  }

  // 2. Deterministic matcher check
  for (const { id, matcher } of CANONICAL_MATCHERS) {
    if (matcher(text)) {
      const caseDef = CANONICAL_CASE_MAP.get(id);
      return {
        canonicalCase: id,
        caseDef,
        status: 'EVALUABLE',
        reason: null
      };
    }
  }

  // 3. Fallback: Request does not match any of the 6 canonical benchmarks
  return {
    canonicalCase: null,
    caseDef: null,
    status: 'NOT_EVALUATED',
    reason: `Request does not match any of the 6 canonical evaluation benchmark cases (${CANONICAL_CASE_IDS.join(', ')})`
  };
}

function getCanonicalCase(caseId) {
  if (!caseId || typeof caseId !== 'string') return null;
  return CANONICAL_CASE_MAP.get(caseId) || null;
}

module.exports = {
  resolveCanonicalCase,
  getCanonicalCase,
  CANONICAL_CASES,
  CANONICAL_CASE_IDS
};
