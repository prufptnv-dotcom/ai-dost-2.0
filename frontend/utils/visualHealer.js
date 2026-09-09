// Zero-token DOM diagnostics. This module reports issues; it never replaces user DOM.
const DEBOUNCE_MS = 200;
const MAX_FINDINGS = 40;
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"], [tabindex]';
const escapeCss = (value) => {
  const escape = typeof CSS !== 'undefined' && CSS.escape;
  return escape ? escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
};

function selectorFor(element) {
  if (!element || !element.tagName) return '';
  if (element.id) return `#${escapeCss(element.id)}`;
  const parts = [];
  let current = element;
  while (current && current.nodeType === 1 && parts.length < 4) {
    let part = current.tagName.toLowerCase();
    if (current.classList?.length) part += `.${Array.from(current.classList).slice(0, 2).map(escapeCss).join('.')}`;
    const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName) : [];
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

function isVisible(element, style, rect) {
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
}

function issue(type, element, message, severity = 'warning', extra = {}) {
  return {
    type,
    severity,
    selector: selectorFor(element),
    tag: element.tagName.toLowerCase(),
    message,
    ...extra,
  };
}

export function analyzeDocument(targetDocument, options = {}) {
  if (!targetDocument?.body) return { success: false, findings: [], error: 'Document is not accessible' };
  const win = targetDocument.defaultView || (typeof window !== 'undefined' ? window : null);
  const viewport = {
    width: options.viewportWidth || win?.innerWidth || 0,
    height: options.viewportHeight || win?.innerHeight || 0,
  };
  const findings = [];
  const elements = Array.from(targetDocument.body.querySelectorAll('*'));
  const visible = [];

  elements.forEach((element) => {
    const style = win?.getComputedStyle ? win.getComputedStyle(element) : getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (isVisible(element, style, rect)) visible.push({ element, style, rect });

    if (rect.right > viewport.width + 4 || rect.left < -4) {
      findings.push(issue('viewport-overflow', element, 'Element extends beyond the preview viewport.', 'error', { overflow: 'horizontal' }));
    }
    if (element.parentElement) {
      const parentRect = element.parentElement.getBoundingClientRect();
      const clips = ['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX);
      if (clips && rect.right > parentRect.right + 4) {
        findings.push(issue('clipped-content', element, 'Content overflows a clipping parent.', 'error'));
      }
    }
    if (element.matches(INTERACTIVE_SELECTOR) && !isVisible(element, style, rect)) {
      findings.push(issue('invisible-interactive', element, 'Interactive control is hidden or has zero size.', 'error'));
    }
    if (element.matches('button, a, [role="button"]') && !element.textContent.trim() && !element.getAttribute('aria-label') && !element.querySelector('img, svg')) {
      findings.push(issue('unnamed-interactive', element, 'Interactive control has no accessible name.', 'warning'));
    }
  });

  for (let i = 0; i < visible.length && findings.length < MAX_FINDINGS; i += 1) {
    const first = visible[i];
    if (!first.element.matches('p, span, h1, h2, h3, h4, h5, h6, label')) continue;
    for (let j = i + 1; j < visible.length; j += 1) {
      const second = visible[j];
      if (!second.element.matches('p, span, h1, h2, h3, h4, h5, h6, label')) continue;
      const overlap = first.rect.left < second.rect.right && first.rect.right > second.rect.left && first.rect.top < second.rect.bottom && first.rect.bottom > second.rect.top;
      if (overlap && first.element !== second.element && !first.element.contains(second.element) && !second.element.contains(first.element)) {
        findings.push(issue('text-overlap', second.element, 'Text boxes overlap another visible text element.', 'error', { with: selectorFor(first.element) }));
        break;
      }
    }
  }

  return {
    success: true,
    source: 'client-dom-heuristics',
    viewport,
    findings: findings.slice(0, MAX_FINDINGS),
    scannedElements: elements.length,
    timestamp: Date.now(),
  };
}

export function formatVisualRepairPrompt(report) {
  if (!report?.success) return 'Inspect the preview for visual layout and responsive issues.';
  const findings = report.findings || [];
  const details = findings.length ? findings.map((finding) => `${finding.type} at ${finding.selector}: ${finding.message}`).join('\n') : 'No deterministic DOM anomalies were found.';
  return `Repair the preview using this zero-token client-side DOM report. Do not request a screenshot or visual API.\nViewport: ${report.viewport.width}x${report.viewport.height}\nFindings:\n${details}\nPreserve behavior and accessibility; fix the source files, not the preview DOM.`;
}

export function initVisualHealer(targetDocument = typeof document !== 'undefined' ? document : null, onReport = () => {}) {
  if (!targetDocument?.body || typeof MutationObserver === 'undefined') return () => {};
  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => onReport(analyzeDocument(targetDocument)), DEBOUNCE_MS);
  });
  observer.observe(targetDocument.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'role', 'tabindex', 'hidden'] });
  onReport(analyzeDocument(targetDocument));
  return () => {
    observer.disconnect();
    clearTimeout(debounceTimer);
  };
}

export function applySafeFixes(targetDocument, report) {
  if (!targetDocument || !report?.findings) return { applied: 0 };
  let applied = 0;
  report.findings.filter((finding) => finding.type === 'viewport-overflow').forEach((finding) => {
    const element = targetDocument.querySelector(finding.selector);
    if (element && element.style.maxWidth !== '100%') {
      element.style.maxWidth = '100%';
      applied += 1;
    }
  });
  return { applied };
}

export const getPendingSuggestions = () => [];

if (typeof window !== 'undefined' && process?.env?.NODE_ENV !== 'production') {
  window.visualHealer = { analyze: analyzeDocument, init: initVisualHealer };
}
