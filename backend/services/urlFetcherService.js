'use strict';

/**
 * AI-Dost 2.0 — Production-Grade Safe URL Fetcher & SSRF Guard
 *
 * Implements strict SSRF protection:
 * - Protocol whitelisting (HTTP/HTTPS only)
 * - DNS pre-resolution and IP blocklist checking (RFC1918, loopback, link-local, cloud metadata)
 * - Manual redirect loop with revalidation on every redirect hop
 * - Content-Type validation and response size limits (2MB cap)
 * - HTML text extraction & markdown conversion without code execution
 */

const dns = require('dns').promises;
const net = require('net');
const logger = require('../logger');
const { config } = require('../config/webAccessConfig');

// Comprehensive private & reserved IPv4 CIDR blocks
const IPV4_BLOCKED_RANGES = [
  { prefix: '0.0.0.0', mask: 8 },         // Current network
  { prefix: '10.0.0.0', mask: 8 },        // Private Class A
  { prefix: '100.64.0.0', mask: 10 },     // Carrier NAT / Shared address
  { prefix: '127.0.0.0', mask: 8 },       // Loopback (127.0.0.1 - 127.255.255.255)
  { prefix: '169.254.0.0', mask: 16 },    // Link-local & Cloud Metadata (169.254.169.254)
  { prefix: '172.16.0.0', mask: 12 },     // Private Class B
  { prefix: '192.0.0.0', mask: 24 },      // IETF Protocol Assignments
  { prefix: '192.0.2.0', mask: 24 },      // TEST-NET-1
  { prefix: '192.88.99.0', mask: 24 },    // 6to4 relay anycast
  { prefix: '192.168.0.0', mask: 16 },    // Private Class C
  { prefix: '198.18.0.0', mask: 15 },     // Network benchmark
  { prefix: '198.51.100.0', mask: 24 },   // TEST-NET-2
  { prefix: '203.0.113.0', mask: 24 },    // TEST-NET-3
  { prefix: '224.0.0.0', mask: 4 },       // Multicast
  { prefix: '240.0.0.0', mask: 4 },       // Reserved / Future
  { prefix: '255.255.255.255', mask: 32 } // Broadcast
];

// Blocked hostnames known for cloud metadata or internal service discovery
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
  'kubernetes.default.svc',
  'localhost.localdomain'
]);

// Convert IPv4 string to integer
function ip4ToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// Check if an IPv4 falls within a CIDR range
function isIpInCidr(ip, prefix, mask) {
  const ipLong = ip4ToLong(ip);
  const prefixLong = ip4ToLong(prefix);
  const maskLong = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
  return (ipLong & maskLong) === (prefixLong & maskLong);
}

/**
 * Checks if an IP address (IPv4 or IPv6) is a private, loopback, link-local,
 * cloud metadata, or reserved address.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;

  const cleanIp = ip.trim().replace(/^\[|\]$/g, '');

  // Handle IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1)
  if (cleanIp.startsWith('::ffff:') || cleanIp.startsWith('0:0:0:0:0:ffff:')) {
    const mappedIpv4 = cleanIp.split(':').pop();
    if (net.isIPv4(mappedIpv4)) {
      return isPrivateOrReservedIp(mappedIpv4);
    }
  }

  // Check IPv4
  if (net.isIPv4(cleanIp)) {
    for (const range of IPV4_BLOCKED_RANGES) {
      if (isIpInCidr(cleanIp, range.prefix, range.mask)) {
        return true;
      }
    }
    return false;
  }

  // Check IPv6
  if (net.isIPv6(cleanIp)) {
    const lower = cleanIp.toLowerCase();
    // Loopback
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified
    if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
    // Unique Local Addresses (fc00::/7)
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
    // Link-Local Addresses (fe80::/10)
    if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
    // Multicast (ff00::/8)
    if (lower.startsWith('ff')) return true;
    return false;
  }

  // Unknown format — default to blocking
  return true;
}

/**
 * Validates a target URL against SSRF rules.
 * Resolves DNS hostname to IP addresses and checks every IP against the blocklist.
 * @param {string} targetUrl
 * @returns {Promise<{ valid: boolean, parsedUrl?: URL, resolvedIps?: string[], reason?: string }>}
 */
async function validateUrlForSsrf(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, reason: 'URL must be a non-empty string' };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (err) {
    return { valid: false, reason: `Invalid URL syntax: ${err.message}` };
  }

  // 1. Protocol check: only http and https allowed
  if (!config.allowedProtocols.includes(parsed.protocol.toLowerCase())) {
    return {
      valid: false,
      reason: `Protocol '${parsed.protocol}' is not allowed. Only HTTP and HTTPS are permitted.`
    };
  }

  // 2. Credentials in URL check (e.g., http://user:pass@host)
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs containing embedded credentials are forbidden.' };
  }

  // 3. Port check: allow standard HTTP/HTTPS and standard public web ports
  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
  if (isNaN(port) || port <= 0 || port > 65535) {
    return { valid: false, reason: 'Invalid port specification.' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // 4. Hostname check against known cloud metadata & loopback aliases
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { valid: false, reason: `Target host '${hostname}' is prohibited (internal / metadata host).` };
  }

  // 5. If hostname is an IP literal, validate directly
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, reason: `Target IP '${hostname}' is in a private, loopback, or cloud metadata range.` };
    }
    return { valid: true, parsedUrl: parsed, resolvedIps: [hostname] };
  }

  // 6. DNS resolution check (resolve all A and AAAA records)
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, reason: `Could not resolve hostname: ${hostname}` };
    }

    const resolvedIps = addresses.map(a => a.address);
    for (const addr of addresses) {
      if (isPrivateOrReservedIp(addr.address)) {
        return {
          valid: false,
          reason: `Host '${hostname}' resolved to blocked private/metadata IP '${addr.address}'.`
        };
      }
    }

    return { valid: true, parsedUrl: parsed, resolvedIps };
  } catch (dnsErr) {
    return { valid: false, reason: `DNS lookup failed for '${hostname}': ${dnsErr.message}` };
  }
}

/**
 * Extracts readable text/markdown from raw HTML.
 * Strips scripts, styles, forms, iframes, and noisy UI markup.
 * @param {string} html
 * @returns {{ title: string, text: string }}
 */
function extractReadableContent(html) {
  if (!html || typeof html !== 'string') {
    return { title: '', text: '' };
  }

  // Extract page title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

  // Remove scripts, styles, comments, noscript, svg, canvas, iframe
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(header|footer|nav|aside|form)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, ' ');

  // Convert headings to markdown
  cleaned = cleaned.replace(/<h[1-2][^>]*>([\s\S]*?)<\/h[1-2]>/gi, '\n\n## $1\n\n');
  cleaned = cleaned.replace(/<h[3-6][^>]*>([\s\S]*?)<\/h[3-6]>/gi, '\n\n### $1\n\n');

  // Convert paragraphs and line breaks
  cleaned = cleaned.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n\n$1\n\n');
  cleaned = cleaned.replace(/<br\s*[\/]?>/gi, '\n');
  cleaned = cleaned.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Normalize whitespace
  cleaned = cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();

  return { title, text: cleaned };
}

/**
 * Safely fetches a URL with SSRF protection, manual redirect revalidation,
 * size capping, and content sanitization.
 *
 * @param {string} targetUrl
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxSizeBytes]
 * @param {number} [options.maxRedirects]
 * @param {number} [options.maxExtractedChars]
 * @returns {Promise<{ success: boolean, url: string, finalUrl: string, title: string, content: string, domain: string, wordCount: number, error?: string, code?: string }>}
 */
async function fetchSafeUrl(targetUrl, options = {}) {
  const timeoutMs = options.timeoutMs || config.urlFetchTimeoutMs;
  const maxBytes = options.maxSizeBytes || config.urlFetchMaxSizeBytes;
  const maxRedirects = options.maxRedirects || config.urlFetchMaxRedirects;
  const maxChars = options.maxExtractedChars || config.maxExtractedChars;

  let currentUrl = targetUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    // 1. SSRF Pre-flight validation on current URL
    const ssrfCheck = await validateUrlForSsrf(currentUrl);
    if (!ssrfCheck.valid) {
      logger.warn(`🛡️ [SSRF Guard] Blocked request to: "${currentUrl}". Reason: ${ssrfCheck.reason}`);
      return {
        success: false,
        url: targetUrl,
        finalUrl: currentUrl,
        title: '',
        content: '',
        domain: '',
        wordCount: 0,
        code: 'SSRF_BLOCKED',
        error: `Security Policy Block: Access to target URL is prohibited (${ssrfCheck.reason})`
      };
    }

    const domain = ssrfCheck.parsedUrl.hostname;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 2. Fetch with manual redirect control
      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 AI-Dost-Bot/2.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
        },
        redirect: 'manual',
        signal: controller.signal
      });

      clearTimeout(timeoutTimer);

      // 3. Handle Redirects (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            success: false,
            url: targetUrl,
            finalUrl: currentUrl,
            code: 'INVALID_REDIRECT',
            error: `Redirect status ${response.status} received without Location header.`
          };
        }

        redirectsCount++;
        if (redirectsCount > maxRedirects) {
          return {
            success: false,
            url: targetUrl,
            finalUrl: currentUrl,
            code: 'REDIRECT_LIMIT_EXCEEDED',
            error: `Exceeded maximum redirect limit of ${maxRedirects}.`
          };
        }

        // Resolve relative redirects safely
        currentUrl = new URL(location, currentUrl).toString();
        logger.info(`🔄 [Safe Fetcher] Following redirect (${redirectsCount}/${maxRedirects}) to: ${currentUrl}`);
        continue;
      }

      // 4. HTTP Status Check
      if (!response.ok) {
        return {
          success: false,
          url: targetUrl,
          finalUrl: currentUrl,
          title: '',
          content: '',
          domain,
          wordCount: 0,
          code: `HTTP_${response.status}`,
          error: `HTTP Error ${response.status}: ${response.statusText || 'Failed to fetch webpage'}`
        };
      }

      // 5. Content-Type Check (Block executable, binary, audio, video)
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
      const isText = isHtml || contentType.includes('text/plain') || contentType.includes('application/json') || contentType.includes('application/xml');

      if (!isText && contentType) {
        return {
          success: false,
          url: targetUrl,
          finalUrl: currentUrl,
          title: '',
          content: '',
          domain,
          wordCount: 0,
          code: 'UNSUPPORTED_CONTENT_TYPE',
          error: `Unsupported content type '${contentType}'. Only text/html, text/plain, and XML/JSON documents can be read.`
        };
      }

      // 6. Read body with safety byte cap (stream truncated gracefully at maxBytes)
      const reader = response.body.getReader();
      const chunks = [];
      let totalBytesReceived = 0;
      let truncatedStream = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytesReceived += value.length;
        chunks.push(value);
        if (totalBytesReceived >= maxBytes) {
          truncatedStream = true;
          try { await reader.cancel(); } catch (_) {}
          break;
        }
      }

      const rawBuffer = Buffer.concat(chunks);
      const rawText = rawBuffer.toString('utf-8');

      // 7. Extract clean text / markdown
      const extracted = isHtml ? extractReadableContent(rawText) : { title: domain, text: rawText };
      let cleanContent = extracted.text;

      if (cleanContent.length > maxChars) {
        cleanContent = cleanContent.slice(0, maxChars) + '\n\n[... Content truncated for length ...]';
      } else if (truncatedStream) {
        cleanContent += '\n\n[... Remaining page content truncated at safety limit ...]';
      }

      const wordCount = cleanContent.split(/\s+/).filter(Boolean).length;

      return {
        success: true,
        url: targetUrl,
        finalUrl: currentUrl,
        title: extracted.title || domain,
        content: cleanContent,
        domain,
        wordCount,
        fetchedAt: new Date().toISOString()
      };
    } catch (fetchErr) {
      clearTimeout(timeoutTimer);
      const isTimeout = fetchErr.name === 'AbortError' || fetchErr.message.includes('timeout') || fetchErr.message.includes('aborted');
      return {
        success: false,
        url: targetUrl,
        finalUrl: currentUrl,
        title: '',
        content: '',
        domain: '',
        wordCount: 0,
        code: isTimeout ? 'TIMEOUT' : 'FETCH_FAILED',
        error: isTimeout ? `Request timed out after ${timeoutMs}ms.` : `Failed to fetch webpage: ${fetchErr.message}`
      };
    }
  }

  return {
    success: false,
    url: targetUrl,
    finalUrl: currentUrl,
    code: 'REDIRECT_LIMIT_EXCEEDED',
    error: `Exceeded maximum redirect limit of ${maxRedirects}.`
  };
}

module.exports = {
  validateUrlForSsrf,
  isPrivateOrReservedIp,
  extractReadableContent,
  fetchSafeUrl,
  IPV4_BLOCKED_RANGES,
  BLOCKED_HOSTNAMES
};
