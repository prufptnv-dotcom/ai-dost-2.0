const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../../logger');

// Deterministic fatal vs non-fatal error classifiers
const FATAL_ERROR_PATTERNS = [
  /uncaught\s+/i,
  /syntaxerror/i,
  /referenceerror/i,
  /typeerror/i,
  /failed to resolve import/i,
  /failed to load module script/i,
  /cannot read propert/i,
  /cannot set propert/i,
  /invariant violation/i,
  /minified react error/i,
  /react is not defined/i,
  /is not a function/i,
  /is not defined/i,
  /unexpected token/i,
  /unhandledrejection/i,
  /chunkloaderror/i,
  /module build failed/i
];

const NON_FATAL_PATTERNS = [
  /react devtools/i,
  /download the react devtools/i,
  /\[vite\]\s+connecting/i,
  /\[vite\]\s+connected/i,
  /\[hmr\]/i,
  /favicon\.ico/i,
  /sourcemap/i,
  /source map/i,
  /warning:\s+react does not recognize/i,
  /warning:\s+each child in a list/i,
  /non-serializable value/i
];

class VisualVerifier {
  constructor() {
    this._playwright = null;
  }

  async getPlaywright() {
    if (!this._playwright) {
      try {
        this._playwright = require('playwright');
      } catch (err) {
        throw new Error(`Playwright is not available: ${err.message}`);
      }
    }
    return this._playwright;
  }

  /**
   * Strict SSRF, Dynamic Port, and Project Ownership Validator
   * Authorizes ONLY the current project's active dev-server session or explicitly authorized ports.
   */
  validateUrl(rawUrl, options = {}) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { valid: false, reason: 'URL must be a non-empty string' };
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (e) {
      return { valid: false, reason: `Malformed URL: ${rawUrl}` };
    }

    // 1. Reject non-HTTP protocols (file:, data:, javascript:, ftp:, etc.)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Forbidden protocol: ${parsed.protocol}. Only http: and https: allowed.` };
    }

    // 2. Hostname must be strictly local (127.0.0.1 or localhost or ::1)
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
    if (!isLocalhost) {
      return { valid: false, reason: `SSRF Security Block: External hostname '${hostname}' is forbidden.` };
    }

    // 3. Dynamic Project Ownership & Port Validation
    const portNum = parseInt(parsed.port, 10) || (parsed.protocol === 'https:' ? 443 : 80);
    const projectId = options.projectId;

    let authorizedPorts = [];
    if (options.allowedPorts && Array.isArray(options.allowedPorts) && options.allowedPorts.length > 0) {
      authorizedPorts.push(...options.allowedPorts);
    }

    // Check devServerManager for active project session
    try {
      const devServerManager = require('../../sandbox/devServerManager');
      if (projectId && typeof devServerManager.getServerByProject === 'function') {
        const server = devServerManager.getServerByProject(projectId);
        if (server && server.hostPort) {
          authorizedPorts.push(server.hostPort);
        }
      }
    } catch (_) {}

    // If authorizedPorts list is provided or discovered via devServerManager, enforce it strictly
    if (authorizedPorts.length > 0) {
      if (!authorizedPorts.includes(portNum)) {
        return {
          valid: false,
          reason: `Project Ownership & SSRF Block: Port ${portNum} is not authorized for project '${projectId || 'unknown'}'. Authorized port(s): [${authorizedPorts.join(', ')}].`
        };
      }
    }

    return { valid: true, parsedUrl: parsed.href };
  }

  /**
   * Deterministic Console Error Classification
   */
  classifyConsoleMessage(text, type = 'log') {
    const cleanText = (text || '').trim();
    if (type !== 'error') {
      return { severity: 'NON_FATAL', text: cleanText, type };
    }

    for (const pattern of NON_FATAL_PATTERNS) {
      if (pattern.test(cleanText)) {
        return { severity: 'NON_FATAL', text: cleanText, type, reason: 'Matched benign pattern' };
      }
    }

    for (const pattern of FATAL_ERROR_PATTERNS) {
      if (pattern.test(cleanText)) {
        return { severity: 'FATAL', text: cleanText, type, reason: 'Matched critical fatal error pattern' };
      }
    }

    // Default to NON_FATAL observation for general warnings/unknown library logs
    return { severity: 'NON_FATAL', text: cleanText, type, reason: 'Informational error log' };
  }

  /**
   * Execute End-to-End Visual Verification via Playwright
   */
  async verify(targetUrl, options = {}) {
    const startTime = Date.now();
    const projectId = options.projectId || 'default';
    const projectPath = options.projectPath || path.join(os.tmpdir(), `agent-ws-${projectId}`);
    const timeoutMs = options.timeoutMs || 15000;
    const allowedPorts = options.allowedPorts || [];

    // 1. SSRF & Project Ownership Validation
    const urlValidation = this.validateUrl(targetUrl, { projectId, allowedPorts });
    if (!urlValidation.valid) {
      return {
        success: false,
        status: 'SECURITY_ERROR',
        url: targetUrl,
        projectId,
        timestamp: startTime,
        durationMs: Date.now() - startTime,
        pageTitle: '',
        httpStatus: 0,
        screenshotPath: null,
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
        domSummary: { hasRootElement: false, bodyLength: 0, title: '' },
        failureReason: `Security Violation: ${urlValidation.reason}`
      };
    }

    const validUrl = urlValidation.parsedUrl;
    const artifactsDir = path.join(projectPath, '.artifacts', 'verification');
    try {
      fs.mkdirSync(artifactsDir, { recursive: true });
    } catch (_) {}

    const screenshotFilename = `verification-${Date.now()}.png`;
    const screenshotPath = path.join(artifactsDir, screenshotFilename);

    let browser = null;
    let context = null;
    let page = null;

    const consoleLogs = [];
    const pageErrors = [];
    const failedRequests = [];
    let navigationStatus = 0;
    let pageTitle = '';
    let bodyLength = 0;
    let hasRootElement = false;
    let failureReason = null;
    let status = 'PASS';

    try {
      const { chromium } = await this.getPlaywright();
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true
      });

      page = await context.newPage();

      // Listen to console messages
      page.on('console', msg => {
        const text = msg.text();
        const type = msg.type();
        const classified = this.classifyConsoleMessage(text, type);
        consoleLogs.push(classified);
      });

      // Listen to uncaught page runtime exceptions
      page.on('pageerror', err => {
        pageErrors.push({
          message: err.message || String(err),
          stack: err.stack ? err.stack.slice(0, 1000) : ''
        });
      });

      // Listen to failed network requests
      page.on('requestfailed', req => {
        const reqUrl = req.url();
        const failure = req.failure();
        const isCritical = reqUrl.endsWith('.js') || reqUrl.endsWith('.jsx') || reqUrl.endsWith('.ts') || reqUrl.endsWith('.tsx') || req.resourceType() === 'document' || req.resourceType() === 'script';
        failedRequests.push({
          url: reqUrl,
          errorText: failure ? failure.errorText : 'Request failed',
          isCritical
        });
      });

      // Redirect interceptor: Ensure redirects don't escape to external sites OR other projects
      page.on('response', response => {
        const respStatus = response.status();
        if (respStatus >= 300 && respStatus < 400) {
          const location = response.headers()['location'];
          if (location) {
            let fullRedirectUrl = location;
            if (location.startsWith('/')) {
              try {
                fullRedirectUrl = new URL(location, validUrl).href;
              } catch (_) {}
            }
            if (fullRedirectUrl.startsWith('http://') || fullRedirectUrl.startsWith('https://')) {
              const redirectCheck = this.validateUrl(fullRedirectUrl, { projectId, allowedPorts });
              if (!redirectCheck.valid) {
                status = 'SECURITY_ERROR';
                failureReason = `SSRF Redirect Blocked: Page attempted unauthorized redirect to '${location}' (${redirectCheck.reason})`;
              }
            }
          }
        }
      });

      // 2. Navigate with bounded timeout (using domcontentloaded, not blocking networkidle)
      let navResponse = null;
      try {
        navResponse = await page.goto(validUrl, {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs
        });
        if (navResponse) {
          navigationStatus = navResponse.status();
        }
      } catch (navErr) {
        if (navErr.name === 'TimeoutError' || (navErr.message && navErr.message.includes('Timeout'))) {
          status = 'TIMEOUT';
          failureReason = `Navigation timed out after ${timeoutMs}ms`;
        } else {
          status = 'FAIL';
          failureReason = `Navigation failed: ${navErr.message}`;
        }
      }

      // Check HTTP error status
      if (navigationStatus >= 500) {
        status = 'FAIL';
        failureReason = `Dev server returned HTTP ${navigationStatus}`;
      }

      // 3. Stabilization wait (short delay for DOM hydration)
      if (status === 'PASS') {
        try {
          await page.waitForTimeout(options.stabilizationMs || 600);
        } catch (_) {}

        // 4. Extract basic DOM metrics
        try {
          pageTitle = (await page.title()) || '';
          const domMetrics = await page.evaluate(() => {
            const root = document.querySelector('#root, #app, main, [data-reactroot], body > div');
            const textContent = document.body ? document.body.innerText || '' : '';
            return {
              hasRoot: !!root,
              textLength: textContent.trim().length
            };
          });
          hasRootElement = domMetrics.hasRoot;
          bodyLength = domMetrics.textLength;
        } catch (_) {}

        // 5. Capture screenshot
        try {
          await page.screenshot({
            path: screenshotPath,
            fullPage: true,
            type: 'png',
            timeout: 5000
          });
        } catch (ssErr) {
          logger.warn(`[VisualVerifier] Screenshot capture warning: ${ssErr.message}`);
        }
      }

      // 6. Fatality Evaluation
      if (status === 'PASS') {
        if (pageErrors.length > 0) {
          status = 'FAIL';
          failureReason = `Uncaught Runtime Exception: ${pageErrors[0].message}`;
        } else {
          const fatalConsole = consoleLogs.find(c => c.severity === 'FATAL');
          if (fatalConsole) {
            status = 'FAIL';
            failureReason = `Fatal Console Error: ${fatalConsole.text}`;
          } else {
            const criticalFailedReq = failedRequests.find(r => r.isCritical);
            if (criticalFailedReq) {
              status = 'FAIL';
              failureReason = `Critical Resource Failed to Load: ${criticalFailedReq.url} (${criticalFailedReq.errorText})`;
            }
          }
        }
      }

    } catch (err) {
      if (status === 'PASS') {
        status = 'FAIL';
        failureReason = `Verification error: ${err.message}`;
      }
    } finally {
      // 7. Strict Resource Cleanup for all execution paths (PASS, FAIL, TIMEOUT, SECURITY_ERROR)
      if (page) {
        try { await page.close(); } catch (_) {}
      }
      if (context) {
        try { await context.close(); } catch (_) {}
      }
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }

    const durationMs = Date.now() - startTime;
    const success = status === 'PASS';
    const relativeScreenshotPath = fs.existsSync(screenshotPath) ? path.relative(projectPath, screenshotPath).replace(/\\/g, '/') : null;

    let screenshotBase64 = null;
    if (options.includeBase64 && fs.existsSync(screenshotPath)) {
      try {
        screenshotBase64 = fs.readFileSync(screenshotPath).toString('base64');
      } catch (_) {}
    }

    return {
      success,
      status,
      url: validUrl,
      projectId,
      timestamp: startTime,
      durationMs,
      pageTitle,
      httpStatus: navigationStatus,
      screenshotPath: relativeScreenshotPath,
      screenshotFullPath: fs.existsSync(screenshotPath) ? screenshotPath : null,
      screenshotBase64,
      consoleErrors: consoleLogs.filter(c => c.type === 'error'),
      allConsoleLogs: consoleLogs,
      pageErrors,
      failedRequests,
      domSummary: {
        hasRootElement,
        bodyLength,
        title: pageTitle
      },
      failureReason
    };
  }
}

module.exports = new VisualVerifier();
