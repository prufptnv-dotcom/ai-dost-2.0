'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: VisualGeometryInspector
 * 
 * Autonomous visual verification engine executing real local Playwright + Chromium
 * with strict loopback/file-only route interception and static AST fallback.
 * 
 * Enforces precise defect classification:
 * - Normal vertical page scrolling is allowed.
 * - Intentional horizontal scroll containers (overflow-x: auto/scroll) are allowed.
 * - Element-from-point occlusion and 44x44px interactive target sizing.
 * - Missing accessible names on interactive elements.
 */

const fs = require('fs');
const path = require('path');
const { VisualVerificationPlan } = require('./VisualVerificationPlan');

class VisualGeometryInspector {
  constructor(plan = null) {
    this.plan = plan instanceof VisualVerificationPlan ? plan : new VisualVerificationPlan(plan || {});
    this.blockedRequests = [];
  }

  /**
   * Main inspection entrypoint. Evaluates an HTML file or HTML string across all plan viewports.
   * 
   * @param {Object} options
   * @param {string} [options.htmlContent] - Raw HTML markup to inspect
   * @param {string} [options.filePath] - Local file path to load via file://
   * @param {string} [options.cssContent] - Additional CSS markup to inject
   * @param {string} [options.serverUrl] - Localhost URL if testing a live local dev server
   * @returns {Promise<Object>} Inspection report
   */
  async inspect(options = {}) {
    this.blockedRequests = [];
    const mode = this.plan.mode;

    // If static-only mode is configured, run static fallback directly
    if (mode === 'static-only') {
      return this._inspectStatic(options);
    }

    // Try real Playwright execution
    try {
      return await this._inspectWithPlaywright(options);
    } catch (err) {
      if (mode === 'browser-only') {
        return {
          status: 'SKIPPED_MISSING_BROWSER',
          isRealBrowser: false,
          error: err.message,
          viewportsEvaluated: [],
          defects: [],
          blockedRequests: this.blockedRequests
        };
      }
      // Fallback to static analysis
      const staticResult = this._inspectStatic(options);
      staticResult.fallbackReason = `Playwright inspection unavailable: ${err.message}`;
      return staticResult;
    }
  }

  /**
   * Real Playwright Chromium inspection across viewports
   */
  async _inspectWithPlaywright(options) {
    let playwright;
    try {
      playwright = require('playwright');
    } catch (e) {
      throw new Error(`Playwright module not found: ${e.message}`);
    }

    let browser = null;
    const viewportsEvaluated = [];
    const defects = [];

    try {
      browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const context = await browser.newContext({
        bypassCSP: true,
        ignoreHTTPSErrors: true
      });

      const page = await context.newPage();

      // Setup strict route interception
      await page.route('**/*', (route) => {
        const req = route.request();
        const urlStr = req.url();
        let parsed;
        try {
          parsed = new URL(urlStr);
        } catch {
          // If URL parsing fails and it's not data: or file:, abort
          this.blockedRequests.push({ url: urlStr, method: req.method(), reason: 'INVALID_URL' });
          return route.abort();
        }

        const isAllowedProtocol = parsed.protocol === 'file:' || parsed.protocol === 'data:' || parsed.protocol === 'about:';
        const isLoopbackHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';

        if (isAllowedProtocol || isLoopbackHost) {
          return route.continue();
        }

        // Block external domains, remote fonts, CDNs, cloud metadata
        this.blockedRequests.push({
          url: urlStr,
          method: req.method(),
          host: parsed.hostname,
          reason: 'BLOCKED_EXTERNAL_HOST'
        });
        return route.abort('blockedbyclient');
      });

      // Prepare target content or URL
      let targetHtml = options.htmlContent;
      if (!targetHtml && options.filePath && fs.existsSync(options.filePath)) {
        targetHtml = fs.readFileSync(options.filePath, 'utf8');
      }

      // Inject extra CSS if provided
      if (options.cssContent && targetHtml) {
        const styleTag = `<style id="ai-dost-injected-css">\n${options.cssContent}\n</style>`;
        if (targetHtml.includes('</head>')) {
          targetHtml = targetHtml.replace('</head>', `${styleTag}</head>`);
        } else if (targetHtml.includes('<body>')) {
          targetHtml = targetHtml.replace('<body>', `<head>${styleTag}</head><body>`);
        } else {
          targetHtml = `${styleTag}${targetHtml}`;
        }
      }

      // Evaluate each viewport
      for (const vp of this.plan.viewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        if (options.serverUrl) {
          await page.goto(options.serverUrl, { waitUntil: 'domcontentloaded', timeout: this.plan.timeoutMs });
        } else if (targetHtml) {
          await page.setContent(targetHtml, { waitUntil: 'domcontentloaded', timeout: this.plan.timeoutMs });
        } else {
          throw new Error('No htmlContent, filePath, or serverUrl provided for visual verification');
        }

        // Execute browser-side geometry inspection script
        const vpDefects = await page.evaluate(
          ({ tolerance, minTargetSize, viewportName, viewportWidth, viewportHeight }) => {
            const results = [];

            // Helper to generate consistent selector
            function getSelector(el) {
              if (!el || el === document.body) return 'body';
              if (el === document.documentElement) return 'html';
              if (el.id) return `#${el.id}`;
              let sel = el.tagName.toLowerCase();
              if (el.className && typeof el.className === 'string') {
                const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 2);
                if (classes.length) sel += `.${classes.join('.')}`;
              }
              return sel;
            }

            // 1. Precise Horizontal Overflow
            const allElements = document.querySelectorAll('body *');
            let foundChildOverflow = false;

            for (const el of allElements) {
              // Ignore script, style, svg contents
              const tag = el.tagName.toLowerCase();
              if (['script', 'style', 'svg', 'path', 'defs'].includes(tag)) continue;

              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden') continue;

              // Rule: Intentional horizontal scroll containers (overflow-x: auto/scroll) are NOT defects!
              const isScrollContainer = style.overflowX === 'auto' || style.overflowX === 'scroll';
              const rect = el.getBoundingClientRect();

              // Element horizontal overflow: element boundaries exceed viewport or inner scroll width exceeds client width
              const isOverflownChild = rect.right > viewportWidth + tolerance || rect.left < -tolerance;
              const hasInnerOverflow = el.scrollWidth > el.clientWidth + tolerance && el.clientWidth > 0;

              if (!isScrollContainer && (isOverflownChild || (hasInnerOverflow && style.overflowX === 'visible'))) {
                foundChildOverflow = true;
                results.push({
                  defectType: 'OVERFLOW_HORIZONTAL',
                  viewport: viewportName,
                  selector: getSelector(el),
                  message: `Element '${getSelector(el)}' exceeds viewport boundary horizontally (width=${Math.round(rect.width)}px, right=${Math.round(rect.right)}px > ${viewportWidth}px)`,
                  metrics: { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, rectRight: rect.right, viewportWidth }
                });
              }

              // 2. Unexpected Vertical Clipping
              // Flag ONLY when element has rigid fixed height, scrollHeight > clientHeight + tolerance,
              // and overflow-y is hidden (cutting off text/elements without scrolling).
              // Normal vertical document scrolling or containers with overflow-y: auto/scroll are NOT defects!
              const isVerticalScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll';
              if (!isVerticalScrollable && style.overflowY === 'hidden') {
                const hasFixedHeight = (style.height && style.height.endsWith('px')) || (style.maxHeight && style.maxHeight.endsWith('px'));
                if (hasFixedHeight && el.scrollHeight > el.clientHeight + tolerance && el.clientHeight > 0) {
                  results.push({
                    defectType: 'UNEXPECTED_VERTICAL_CLIPPING',
                    viewport: viewportName,
                    selector: getSelector(el),
                    message: `Element '${getSelector(el)}' clips overflowing vertical content due to fixed height with overflow:hidden`,
                    metrics: { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, delta: el.scrollHeight - el.clientHeight }
                  });
                }
              }
            }

            // Only flag root documentElement if it overflows and no specific child was identified
            const docScrollW = document.documentElement.scrollWidth;
            const winInnerW = window.innerWidth;
            if (!foundChildOverflow && docScrollW > winInnerW + tolerance) {
              results.push({
                defectType: 'OVERFLOW_HORIZONTAL',
                viewport: viewportName,
                selector: 'html',
                message: `Document root overflows viewport width horizontally: scrollWidth=${docScrollW}px > innerWidth=${winInnerW}px`,
                metrics: { scrollWidth: docScrollW, clientWidth: winInnerW, delta: docScrollW - winInnerW }
              });
            }

            // 3. Interactive Element Occlusion & Hit-testing
            const interactiveSelectors = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
            const interactiveEls = document.querySelectorAll(interactiveSelectors);

            for (const el of interactiveEls) {
              const style = window.getComputedStyle(el);
              if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none' || Number(style.opacity) === 0) {
                continue;
              }

              const rect = el.getBoundingClientRect();
              // Element must be inside current viewport to be occluded
              if (rect.width <= 0 || rect.height <= 0) continue;
              if (rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth) continue;

              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;

              if (centerX >= 0 && centerX <= viewportWidth && centerY >= 0 && centerY <= viewportHeight) {
                const topEl = document.elementFromPoint(centerX, centerY);
                if (topEl && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) {
                  // Element is occluded by an unrelated element
                  const topSel = getSelector(topEl);
                  results.push({
                    defectType: 'INTERACTIVE_ELEMENT_OCCLUDED',
                    viewport: viewportName,
                    selector: getSelector(el),
                    message: `Interactive element '${getSelector(el)}' is occluded at (${Math.round(centerX)}, ${Math.round(centerY)}) by '${topSel}'`,
                    metrics: { occludedBy: topSel, x: centerX, y: centerY }
                  });
                }
              }

              // 4. Interactive Target Undersized (44x44px rule)
              // Only check real standalone interactive buttons/inputs (not inline links inside running text paragraphs)
              const isInlineLink = el.tagName.toLowerCase() === 'a' && el.parentElement && ['p', 'span', 'li', 'td'].includes(el.parentElement.tagName.toLowerCase());
              if (!isInlineLink && (rect.width < minTargetSize - tolerance || rect.height < minTargetSize - tolerance)) {
                results.push({
                  defectType: 'TARGET_UNDERSIZED',
                  viewport: viewportName,
                  selector: getSelector(el),
                  message: `Interactive element '${getSelector(el)}' has undersized hit target: ${Math.round(rect.width)}x${Math.round(rect.height)}px (min ${minTargetSize}x${minTargetSize}px required)`,
                  metrics: { width: Math.round(rect.width), height: Math.round(rect.height), minRequired: minTargetSize }
                });
              }

              // 5. Missing Accessible Name
              const tag = el.tagName.toLowerCase();
              if (['button', 'input'].includes(tag) || el.getAttribute('role') === 'button') {
                const hasAriaLabel = el.getAttribute('aria-label') && el.getAttribute('aria-label').trim().length > 0;
                const hasAriaLabelledBy = el.getAttribute('aria-labelledby') && el.getAttribute('aria-labelledby').trim().length > 0;
                const hasTitle = el.getAttribute('title') && el.getAttribute('title').trim().length > 0;
                const hasText = el.innerText && el.innerText.trim().length > 0;
                const hasValue = el.value && String(el.value).trim().length > 0;

                if (!hasAriaLabel && !hasAriaLabelledBy && !hasTitle && !hasText && !hasValue) {
                  results.push({
                    defectType: 'MISSING_ACCESSIBLE_NAME',
                    viewport: viewportName,
                    selector: getSelector(el),
                    message: `Interactive element '${getSelector(el)}' has no accessible name (missing aria-label, title, or inner text)`,
                    metrics: { tag, selector: getSelector(el) }
                  });
                }
              }
            }

            return results;
          },
          {
            tolerance: this.plan.overflowTolerancePx,
            minTargetSize: this.plan.minTargetSizePx,
            viewportName: vp.name,
            viewportWidth: vp.width,
            viewportHeight: vp.height
          }
        );

        viewportsEvaluated.push({
          name: vp.name,
          width: vp.width,
          height: vp.height,
          defectCount: vpDefects.length
        });

        defects.push(...vpDefects);
      }

      await page.close();
      await context.close();

      return {
        status: defects.length === 0 ? 'VERIFIED_CLEAN' : 'DEFECTS_DETECTED',
        isRealBrowser: true,
        viewportsEvaluated,
        defects,
        blockedRequests: this.blockedRequests
      };
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  /**
   * Static analysis fallback when Chromium is missing or static mode is forced.
   * Crucially returns PARTIAL_STATIC_ANALYSIS and never claims real browser layout verification!
   */
  _inspectStatic(options) {
    const defects = [];
    let html = options.htmlContent || '';
    if (!html && options.filePath && fs.existsSync(options.filePath)) {
      try {
        html = fs.readFileSync(options.filePath, 'utf8');
      } catch (err) {
        return {
          status: 'PARTIAL_STATIC_ANALYSIS',
          isRealBrowser: false,
          error: `Failed to read file: ${err.message}`,
          viewportsEvaluated: [],
          defects: [],
          blockedRequests: []
        };
      }
    }

    const css = options.cssContent || '';
    const combined = `${html}\n${css}`;

    // Static check 1: Large rigid fixed widths (e.g. width: 800px; without responsive max-width)
    const fixedWidthRegex = /width\s*:\s*([6-9]\d{2,}|[1-9]\d{3,})px/gi;
    let match;
    while ((match = fixedWidthRegex.exec(combined)) !== null) {
      defects.push({
        defectType: 'OVERFLOW_HORIZONTAL',
        viewport: 'static',
        selector: 'css-rule',
        message: `Static detection: Rigid fixed width '${match[0]}' may overflow mobile viewports without max-width: 100%`,
        metrics: { rawRule: match[0], declaredWidth: parseInt(match[1], 10) }
      });
    }

    // Static check 2: Buttons with no content or accessible label
    const emptyButtonRegex = /<button\b([^>]*)>(?:\s*|\s*<svg[^>]*>.*?<\/svg>\s*)<\/button>/gis;
    while ((match = emptyButtonRegex.exec(html)) !== null) {
      const attrs = match[1];
      if (!attrs.includes('aria-label') && !attrs.includes('title')) {
        defects.push({
          defectType: 'MISSING_ACCESSIBLE_NAME',
          viewport: 'static',
          selector: 'button',
          message: 'Static detection: <button> contains only whitespace or SVG without aria-label or title attribute',
          metrics: { tag: 'button', attrs: attrs.trim() }
        });
      }
    }

    // Static check 3: Undersized fixed dimensions on buttons
    const tinyButtonRegex = /button[^{]*\{[^}]*(?:width|height)\s*:\s*([1-3]\d)px/gi;
    while ((match = tinyButtonRegex.exec(combined)) !== null) {
      defects.push({
        defectType: 'TARGET_UNDERSIZED',
        viewport: 'static',
        selector: 'button',
        message: `Static detection: Button CSS specifies undersized dimension (${match[1]}px < 44px)`,
        metrics: { dimensionPx: parseInt(match[1], 10), minRequired: 44 }
      });
    }

    return {
      status: 'PARTIAL_STATIC_ANALYSIS',
      isRealBrowser: false,
      disclaimer: 'Static analysis fallback only. Real layout geometry, occlusion, responsive viewports, and hit-testing were NOT verified.',
      viewportsEvaluated: [],
      defects,
      blockedRequests: []
    };
  }
}

module.exports = {
  VisualGeometryInspector
};
