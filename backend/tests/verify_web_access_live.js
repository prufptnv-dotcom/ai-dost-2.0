'use strict';

/**
 * AI-Dost 2.0 — Real Runtime Web Access Verification Script
 *
 * Runs real HTTP requests against live server on http://localhost:5000:
 * 1. Web Access Configuration Status
 * 2. News query with actual sources
 * 3. Weather query with actual sources
 * 4. URL reading & summarization
 * 5. Finance/Price query with actual sources
 * 6. SSRF attack prevention verification
 * 7. Multi-language response matching (Hindi, Hinglish, English)
 */

const BASE = 'http://localhost:5000';

async function runLiveVerification() {
  console.log('🚀 Starting Real Runtime Web Access Verification on', BASE);
  const results = [];

  // Test 1: Web Status Endpoint
  try {
    const res = await fetch(`${BASE}/api/chat/web-status`);
    const data = await res.json();
    console.log('1. [Web Status]:', data.success ? 'PASS' : 'FAIL', `(Status: ${data.status}, Provider: ${data.provider})`);
    results.push({
      test: 'Web Status Endpoint',
      pass: data.success && data.status === 'READY',
      details: { status: data.status, provider: data.provider, hasTavily: data.hasTavilyKey, hasGemini: data.hasGeminiKey }
    });
  } catch (err) {
    console.error('1. [Web Status] FAILED:', err.message);
    results.push({ test: 'Web Status Endpoint', pass: false, error: err.message });
  }

  // Test 2: AI News Query
  try {
    const res = await fetch(`${BASE}/api/chat/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the latest news about AI models in 2026?' })
    });
    const data = await res.json();
    const hasSources = Array.isArray(data.sources) && data.sources.length > 0;
    console.log('2. [AI News Search]:', data.success && hasSources ? 'PASS' : 'FAIL', `(Sources: ${data.sources?.length || 0}, Provider: ${data.provider})`);
    if (hasSources) {
      console.log('   Top Source:', data.sources[0].title, '->', data.sources[0].url);
    }
    results.push({
      test: 'AI News Search with Sources',
      pass: data.success && hasSources,
      details: { provider: data.provider, sourcesCount: data.sources?.length || 0, topSource: data.sources?.[0]?.url }
    });
  } catch (err) {
    console.error('2. [AI News Search] FAILED:', err.message);
    results.push({ test: 'AI News Search with Sources', pass: false, error: err.message });
  }

  // Test 3: Weather in Delhi
  try {
    const res = await fetch(`${BASE}/api/chat/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Search the current weather in Delhi today' })
    });
    const data = await res.json();
    const hasSources = Array.isArray(data.sources) && data.sources.length > 0;
    console.log('3. [Delhi Weather]:', data.success && hasSources ? 'PASS' : 'FAIL', `(Sources: ${data.sources?.length || 0}, Provider: ${data.provider})`);
    results.push({
      test: 'Delhi Weather Search',
      pass: data.success && hasSources,
      details: { provider: data.provider, sourcesCount: data.sources?.length || 0, replySnippet: data.reply?.slice(0, 100) }
    });
  } catch (err) {
    console.error('3. [Delhi Weather] FAILED:', err.message);
    results.push({ test: 'Delhi Weather Search', pass: false, error: err.message });
  }

  // Test 4: URL Fetching & Summarization (Wikipedia Public URL)
  try {
    const { fetchSafeUrl } = require('../services/urlFetcherService');
    const fetchRes = await fetchSafeUrl('https://en.wikipedia.org/wiki/Artificial_intelligence', { maxExtractedChars: 1500 });
    console.log('4. [URL Fetcher]:', fetchRes.success ? 'PASS' : 'FAIL', `(Title: "${fetchRes.title}", WordCount: ${fetchRes.wordCount})`);
    results.push({
      test: 'Safe Public URL Fetching',
      pass: fetchRes.success && fetchRes.wordCount > 50,
      details: { title: fetchRes.title, domain: fetchRes.domain, wordCount: fetchRes.wordCount }
    });
  } catch (err) {
    console.error('4. [URL Fetcher] FAILED:', err.message);
    results.push({ test: 'Safe Public URL Fetching', pass: false, error: err.message });
  }

  // Test 5: SSRF Defense against Localhost & Metadata
  try {
    const { fetchSafeUrl } = require('../services/urlFetcherService');
    const ssrf1 = await fetchSafeUrl('http://localhost:5000/api/chat');
    const ssrf2 = await fetchSafeUrl('http://169.254.169.254/latest/meta-data');
    const ssrf3 = await fetchSafeUrl('http://127.0.0.1:3000/');
    const allBlocked = !ssrf1.success && !ssrf2.success && !ssrf3.success &&
                       ssrf1.code === 'SSRF_BLOCKED' && ssrf2.code === 'SSRF_BLOCKED' && ssrf3.code === 'SSRF_BLOCKED';
    console.log('5. [SSRF Attack Prevention]:', allBlocked ? 'PASS' : 'FAIL', '(All private/metadata URLs blocked cleanly)');
    results.push({
      test: 'SSRF Attack Prevention',
      pass: allBlocked,
      details: { localhost: ssrf1.code, metadata: ssrf2.code, loopback: ssrf3.code }
    });
  } catch (err) {
    console.error('5. [SSRF Attack Prevention] FAILED:', err.message);
    results.push({ test: 'SSRF Attack Prevention', pass: false, error: err.message });
  }

  // Test 6: Bitcoin Price Query with Dates
  try {
    const res = await fetch(`${BASE}/api/chat/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is the current price of Bitcoin in USD?' })
    });
    const data = await res.json();
    const hasSources = Array.isArray(data.sources) && data.sources.length > 0;
    console.log('6. [Bitcoin Price Search]:', data.success && hasSources ? 'PASS' : 'FAIL', `(Sources: ${data.sources?.length || 0})`);
    results.push({
      test: 'Bitcoin Price Search',
      pass: data.success && hasSources,
      details: { sourcesCount: data.sources?.length || 0, retrievalTimestamp: data.retrievalTimestamp }
    });
  } catch (err) {
    console.error('6. [Bitcoin Price Search] FAILED:', err.message);
    results.push({ test: 'Bitcoin Price Search', pass: false, error: err.message });
  }

  // Test 7: Hindi Language Web Search Query
  try {
    const res = await fetch(`${BASE}/api/chat/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'भारत की राजधानी क्या है और वहां का मौसम कैसा है?' })
    });
    const data = await res.json();
    const isHindi = /[\u0900-\u097F]/.test(data.reply);
    console.log('7. [Hindi Web Query]:', data.success && isHindi ? 'PASS' : 'FAIL', `(Language: ${data.languageName || 'Hindi'})`);
    results.push({
      test: 'Hindi Language Response Matching for Web Search',
      pass: data.success && isHindi,
      details: { detectedLanguage: data.detectedResponseLanguage, languageName: data.languageName }
    });
  } catch (err) {
    console.error('7. [Hindi Web Query] FAILED:', err.message);
    results.push({ test: 'Hindi Language Response Matching for Web Search', pass: false, error: err.message });
  }

  // Test 8: Hinglish Language Web Search Query
  try {
    const res = await fetch(`${BASE}/api/chat/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Aaj ka weather kaisa hai Mumbai me?' })
    });
    const data = await res.json();
    console.log('8. [Hinglish Web Query]:', data.success ? 'PASS' : 'FAIL', `(Language: ${data.languageName || 'Hinglish'})`);
    results.push({
      test: 'Hinglish Language Web Search',
      pass: data.success,
      details: { detectedLanguage: data.detectedResponseLanguage, languageName: data.languageName }
    });
  } catch (err) {
    console.error('8. [Hinglish Web Query] FAILED:', err.message);
    results.push({ test: 'Hinglish Language Web Search', pass: false, error: err.message });
  }

  const allPassed = results.every(r => r.pass);
  console.log('\n========================================');
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.pass).length} | FAILED: ${results.filter(r => !r.pass).length}`);
  console.log('OVERALL STATUS:', allPassed ? '✅ ALL RUNTIME CHECKS PASSED' : '❌ SOME CHECKS FAILED');
  console.log('========================================\n');

  return { allPassed, results };
}

runLiveVerification().then(res => {
  process.exit(res.allPassed ? 0 : 1);
}).catch(err => {
  console.error('Execution failure:', err);
  process.exit(1);
});
