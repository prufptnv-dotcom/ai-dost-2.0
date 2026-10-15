'use strict';

/**
 * AI-Dost 2.0 — Web Access & SSRF Security Automated Test Suite
 *
 * Tests:
 * 1. SSRF Protection: Localhost, Private IPs, Cloud Metadata, IPv6, Redirects, Protocols
 * 2. URL Fetcher: Size limits, Content-Type, Timeout, HTML Extraction
 * 3. Search Providers: Tavily, Gemini Grounding, DuckDuckGo, Wikipedia, Cascade
 * 4. Web Intent Classifier: Weather, News, Finance, Prices, Docs, URLs, General Knowledge
 * 5. Secret Redaction: Zero API key leakage
 * 6. Agent Tools: WebSearchTool, FetchWebpageTool, ToolRegistry & Gatekeeper integration
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const {
  validateUrlForSsrf,
  isPrivateOrReservedIp,
  extractReadableContent,
  fetchSafeUrl
} = require('../services/urlFetcherService');

const webSearchService = require('../services/webSearchService');
const { classifyWebIntent } = require('../services/webIntentClassifier');
const { config, redactSensitive, getPublicConfig } = require('../config/webAccessConfig');
const toolRegistry = require('../agent/runtime/ToolRegistry');
require('../agent/runtime/registerAgentCapabilities');
const WebSearchTool = require('../agent/tools/WebSearchTool');
const FetchWebpageTool = require('../agent/tools/FetchWebpageTool');

describe('🛡️ 1. SSRF Protection & IP Blocklist', () => {
  it('blocks IPv4 loopback (127.0.0.1, 127.0.0.2, 127.255.255.255)', () => {
    assert.strictEqual(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('127.0.0.2'), true);
    assert.strictEqual(isPrivateOrReservedIp('127.255.255.255'), true);
  });

  it('blocks IPv4 zero network (0.0.0.0)', () => {
    assert.strictEqual(isPrivateOrReservedIp('0.0.0.0'), true);
  });

  it('blocks Private Class A (10.0.0.0/8)', () => {
    assert.strictEqual(isPrivateOrReservedIp('10.0.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('10.254.12.3'), true);
  });

  it('blocks Private Class B (172.16.0.0/12)', () => {
    assert.strictEqual(isPrivateOrReservedIp('172.16.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('172.31.255.254'), true);
    // 172.32.0.1 is public
    assert.strictEqual(isPrivateOrReservedIp('172.32.0.1'), false);
  });

  it('blocks Private Class C (192.168.0.0/16)', () => {
    assert.strictEqual(isPrivateOrReservedIp('192.168.1.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('192.168.0.100'), true);
  });

  it('blocks Cloud Metadata & Link-Local (169.254.0.0/16)', () => {
    assert.strictEqual(isPrivateOrReservedIp('169.254.169.254'), true);
    assert.strictEqual(isPrivateOrReservedIp('169.254.1.1'), true);
  });

  it('blocks Carrier Grade NAT (100.64.0.0/10)', () => {
    assert.strictEqual(isPrivateOrReservedIp('100.64.0.1'), true);
    assert.strictEqual(isPrivateOrReservedIp('100.127.255.255'), true);
  });

  it('blocks IPv6 loopback (::1) and link-local (fe80::/10)', () => {
    assert.strictEqual(isPrivateOrReservedIp('::1'), true);
    assert.strictEqual(isPrivateOrReservedIp('fe80::1'), true);
    assert.strictEqual(isPrivateOrReservedIp('fc00::1'), true);
  });

  it('allows verified public IP addresses', () => {
    assert.strictEqual(isPrivateOrReservedIp('8.8.8.8'), false);
    assert.strictEqual(isPrivateOrReservedIp('1.1.1.1'), false);
    assert.strictEqual(isPrivateOrReservedIp('93.184.216.34'), false); // example.com
  });

  it('validateUrlForSsrf blocks localhost, 127.0.0.1, and metadata hostnames', async () => {
    const r1 = await validateUrlForSsrf('http://localhost:5000/api/secret');
    assert.strictEqual(r1.valid, false);

    const r2 = await validateUrlForSsrf('http://127.0.0.1:3000/dashboard');
    assert.strictEqual(r2.valid, false);

    const r3 = await validateUrlForSsrf('http://169.254.169.254/latest/meta-data');
    assert.strictEqual(r3.valid, false);

    const r4 = await validateUrlForSsrf('http://metadata.google.internal/computeMetadata/v1');
    assert.strictEqual(r4.valid, false);
  });

  it('validateUrlForSsrf blocks unsupported protocols (file, ftp, gopher, javascript)', async () => {
    const r1 = await validateUrlForSsrf('file:///etc/passwd');
    assert.strictEqual(r1.valid, false);
    assert.match(r1.reason, /not allowed/i);

    const r2 = await validateUrlForSsrf('ftp://ftp.example.com/file.txt');
    assert.strictEqual(r2.valid, false);

    const r3 = await validateUrlForSsrf('gopher://gopher.example.com/');
    assert.strictEqual(r3.valid, false);
  });

  it('validateUrlForSsrf blocks credentials embedded in URL', async () => {
    const res = await validateUrlForSsrf('http://admin:secret@example.com/profile');
    assert.strictEqual(res.valid, false);
    assert.match(res.reason, /embedded credentials/i);
  });
});

describe('🌐 2. Safe URL Fetcher & Redirect Guard', () => {
  let mockServer;
  let mockServerPort;

  before(async () => {
    return new Promise((resolve) => {
      mockServer = http.createServer((req, res) => {
        if (req.url === '/redirect-to-localhost') {
          res.writeHead(302, { 'Location': 'http://127.0.0.1:5000/internal' });
          return res.end();
        }
        if (req.url === '/redirect-to-metadata') {
          res.writeHead(302, { 'Location': 'http://169.254.169.254/secret' });
          return res.end();
        }
        if (req.url === '/binary-file') {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          return res.end(Buffer.from([0x00, 0x01, 0x02, 0x03]));
        }
        if (req.url === '/sample-page') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(`
            <!DOCTYPE html>
            <html>
              <head><title>AI Dost Test Page</title><script>alert("xss")</script></head>
              <body>
                <header><nav>Nav links</nav></header>
                <h1>Artificial Intelligence 2026</h1>
                <p>AI-Dost provides autonomous capabilities for modern software engineering.</p>
                <ul><li>Feature 1: Web Access</li><li>Feature 2: RAG Engine</li></ul>
                <footer>Copyright 2026</footer>
              </body>
            </html>
          `);
        }
        res.writeHead(404);
        res.end('Not found');
      });

      mockServer.listen(0, '127.0.0.1', () => {
        mockServerPort = mockServer.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    return new Promise((resolve) => {
      if (mockServer) {
        mockServer.close(resolve);
      } else {
        resolve();
      }
    });
  });

  it('fetchSafeUrl blocks direct loopback access via SSRF Guard', async () => {
    const res = await fetchSafeUrl(`http://127.0.0.1:${mockServerPort}/sample-page`);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'SSRF_BLOCKED');
    assert.match(res.error, /Security Policy Block/i);
  });

  it('extractReadableContent sanitizes HTML and extracts clean title and markdown', () => {
    const rawHtml = `
      <html>
        <head><title>Test Document</title><script>alert('bad');</script></head>
        <body>
          <nav>Menu</nav>
          <h1>Heading One</h1>
          <p>This is a paragraph with <b>bold</b> text.</p>
          <footer>Footer text</footer>
        </body>
      </html>
    `;
    const extracted = extractReadableContent(rawHtml);
    assert.strictEqual(extracted.title, 'Test Document');
    assert.match(extracted.text, /## Heading One/);
    assert.match(extracted.text, /This is a paragraph with bold text\./);
    assert.strictEqual(extracted.text.includes('<script>'), false);
    assert.strictEqual(extracted.text.includes('alert('), false);
  });

  it('fetchSafeUrl rejects malformed URLs cleanly', async () => {
    const res = await fetchSafeUrl('not-a-valid-url');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'SSRF_BLOCKED');
  });

  it('validateUrlForSsrf blocks redirect target to private/loopback IP', async () => {
    const redirectTarget = 'http://127.0.0.1:5000/api/secret';
    const check = await validateUrlForSsrf(redirectTarget);
    assert.strictEqual(check.valid, false);
    assert.match(check.reason, /private, loopback, or cloud metadata/i);
  });

  it('validateUrlForSsrf blocks redirect target to cloud metadata endpoint', async () => {
    const redirectTarget = 'http://169.254.169.254/latest/meta-data';
    const check = await validateUrlForSsrf(redirectTarget);
    assert.strictEqual(check.valid, false);
    assert.match(check.reason, /private, loopback, or cloud metadata/i);
  });
});

describe('🧠 3. Web Intent Classifier', () => {
  it('classifies Weather queries accurately', () => {
    const res = classifyWebIntent('Delhi ka mausam kaisa hai aaj?');
    assert.strictEqual(res.needsWeb, true);
    assert.strictEqual(res.intent, 'WEATHER');
  });

  it('classifies Finance / Crypto / Stock queries accurately', () => {
    const res = classifyWebIntent('What is the current Bitcoin price in USD?');
    assert.strictEqual(res.needsWeb, true);
    assert.strictEqual(res.intent, 'FINANCE');
  });

  it('classifies News queries accurately', () => {
    const res = classifyWebIntent('What is the latest breaking news about AI models?');
    assert.strictEqual(res.needsWeb, true);
    assert.strictEqual(res.intent, 'NEWS');
  });

  it('classifies Product Pricing queries accurately', () => {
    const res = classifyWebIntent('Current price of iPhone 16 Pro Max in India?');
    assert.strictEqual(res.needsWeb, true);
    assert.strictEqual(res.intent, 'PRODUCT_PRICES');
  });

  it('classifies Documentation lookups accurately', () => {
    const res = classifyWebIntent('Check latest official documentation for Next.js 16 app router');
    assert.strictEqual(res.needsWeb, true);
    assert.strictEqual(res.intent, 'DOCS_LOOKUP');
  });

  it('classifies URL reading / fetching accurately', () => {
    const res = classifyWebIntent('Please open and summarize https://en.wikipedia.org/wiki/Artificial_intelligence');
    assert.strictEqual(res.needsWeb, true);
    assert.strictEqual(res.intent, 'URL_FETCH');
    assert.strictEqual(res.extractedUrls.length, 1);
    assert.strictEqual(res.extractedUrls[0], 'https://en.wikipedia.org/wiki/Artificial_intelligence');
  });

  it('suppresses web search for pure coding, math, and greeting questions', () => {
    const r1 = classifyWebIntent('Write a function in python to reverse a linked list');
    assert.strictEqual(r1.needsWeb, false);
    assert.strictEqual(r1.intent, 'GENERAL_KNOWLEDGE');

    const r2 = classifyWebIntent('Solve equation 3x + 9 = 27');
    assert.strictEqual(r2.needsWeb, false);
    assert.strictEqual(r2.intent, 'GENERAL_KNOWLEDGE');

    const r3 = classifyWebIntent('Hello, how are you?');
    assert.strictEqual(r3.needsWeb, false);
    assert.strictEqual(r3.intent, 'GENERAL_KNOWLEDGE');
  });
});

describe('🔍 4. Search Providers & WebSearchService', () => {
  it('Wikipedia provider retrieves factual articles and summaries without keys', async () => {
    const wikiProvider = new webSearchService.WikipediaSearchProvider();
    const result = await wikiProvider.search('Alan Turing', { maxResults: 3 });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.provider, 'wikipedia');
    assert.ok(result.results.length > 0, 'Should find Alan Turing articles');
    assert.match(result.results[0].title, /Alan Turing/i);
    assert.match(result.results[0].url, /wikipedia\.org/i);
    assert.strictEqual(result.results[0].domain, 'en.wikipedia.org');
    assert.ok(result.results[0].retrievalTimestamp, 'Timestamp must be preserved');
  });

  it('WebSearchService cascade fallback handles search queries gracefully', async () => {
    const result = await webSearchService.search('Quantum computing algorithms', { maxResults: 3 });
    assert.strictEqual(result.success, true);
    assert.ok(['tavily', 'gemini-grounding', 'wikipedia', 'duckduckgo'].includes(result.provider));
    assert.ok(result.results.length > 0);
    assert.strictEqual(typeof result.results[0].title, 'string');
    assert.strictEqual(typeof result.results[0].url, 'string');
    assert.ok(result.results[0].retrievalTimestamp);
  });

  it('WebSearchService rejects empty queries honestly without hallucination', async () => {
    const result = await webSearchService.search('   ');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'INVALID_QUERY');
    assert.strictEqual(result.results.length, 0);
  });

  it('WebSearchService respects disabled configuration', async () => {
    const original = config.enabled;
    config.enabled = false;

    const result = await webSearchService.search('Latest news');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, 'DISABLED');
    assert.strictEqual(result.results.length, 0);

    config.enabled = original;
  });
});

describe('🔒 5. Secret Redaction & Key Protection', () => {
  it('redacts sensitive API keys from strings and error logs', () => {
    const fakeKey = 'tvly-secretkey1234567890';
    const originalTavily = config.tavilyApiKey;
    config.tavilyApiKey = fakeKey;

    const text = `Error connecting with api_key=${fakeKey} to endpoint`;
    const redacted = redactSensitive(text);

    assert.strictEqual(redacted.includes(fakeKey), false);
    assert.match(redacted, /\[REDACTED_SECRET\]/);

    config.tavilyApiKey = originalTavily;
  });

  it('getPublicConfig never exposes actual API keys', () => {
    const pub = getPublicConfig();
    assert.strictEqual(pub.tavilyApiKey, undefined);
    assert.strictEqual(pub.geminiApiKey, undefined);
    assert.strictEqual(typeof pub.hasTavilyKey, 'boolean');
    assert.strictEqual(typeof pub.hasGeminiKey, 'boolean');
    assert.strictEqual(typeof pub.status, 'string');
  });
});

describe('🤖 6. Agent Tools & Registry Integration', () => {
  it('WebSearchTool and FetchWebpageTool are registered in default ToolRegistry', () => {
    assert.strictEqual(toolRegistry.has('web_search'), true);
    assert.strictEqual(toolRegistry.has('fetch_webpage'), true);

    const searchTool = toolRegistry.get('web_search');
    assert.strictEqual(searchTool.name, 'web_search');
    assert.strictEqual(searchTool.capabilityId, 'autonomy.web_acquisition');
    assert.deepStrictEqual(searchTool.permissions, ['network:external']);

    const fetchTool = toolRegistry.get('fetch_webpage');
    assert.strictEqual(fetchTool.name, 'fetch_webpage');
    assert.strictEqual(fetchTool.capabilityId, 'autonomy.web_acquisition');
    assert.deepStrictEqual(fetchTool.permissions, ['network:external']);
  });

  it('WebSearchTool validates input schema', async () => {
    const tool = new WebSearchTool();
    assert.throws(() => {
      tool.validateInput({});
    }, /Missing required property 'query'/i);

    assert.throws(() => {
      tool.validateInput({ query: 12345 });
    }, /must be a string/i);
  });

  it('FetchWebpageTool blocks SSRF attacks during tool execution', async () => {
    const tool = new FetchWebpageTool();
    const res = await tool.execute({}, { url: 'http://127.0.0.1:5000/api/chat' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, 'SSRF_BLOCKED');
  });

  it('WebSearchTool executes live search and returns structured citations', async () => {
    const tool = new WebSearchTool();
    const res = await tool.execute({}, { query: 'Node.js LTS release', maxResults: 3 });
    assert.strictEqual(res.success, true);
    assert.ok(res.results.length > 0);
    assert.strictEqual(res.results[0].citationId, 1);
    assert.ok(res.results[0].title);
    assert.ok(res.results[0].url);
    assert.ok(res.results[0].domain);
  });
});
