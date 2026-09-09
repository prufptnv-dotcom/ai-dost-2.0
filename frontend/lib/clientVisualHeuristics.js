/*
 * Zero-Cost Client-Side Visual Self-Healing
 *
 * Collects deterministic DOM/layout signals without screenshots or visual LLMs.
 * It is intentionally conservative: diagnostics only recommend fixes; an agent
 * can apply a code diff after reviewing the structured findings.
 */

const DEFAULT_OPTIONS = {
  minTextSize: 10,
  overlapTolerance: 1,
  maxFindings: 80,
};

function isVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0 && r.width > 0 && r.height > 0;
}

function selectorFor(el) {
  if (!el || !el.tagName) return '';
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 4) {
    let part = node.tagName.toLowerCase();
    if (node.classList?.length) part += '.' + [...node.classList].slice(0, 2).map(c => CSS.escape(c)).join('.');
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(' > ');
}

function rect(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function intersects(a, b, tolerance = 1) {
  return a.left < b.right - tolerance && a.right > b.left + tolerance && a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;
}

function meaningfulElements(root) {
  const all = root.querySelectorAll('*');
  return [...all].filter(isVisible).filter(el => {
    const tag = el.tagName.toLowerCase();
    return ['button', 'a', 'input', 'textarea', 'select', 'img', 'nav', 'main', 'section', 'header', 'footer', 'p', 'h1', 'h2', 'h3', 'h4', 'label'].includes(tag) || el.children.length === 0;
  });
}

function detectOverflow(el) {
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const issues = [];
  if (el.scrollWidth > el.clientWidth + 1 && ['visible', 'clip'].includes(style.overflowX)) {
    issues.push({ type: 'horizontal-overflow', selector: selectorFor(el), severity: 'medium', evidence: { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } });
  }
  if (el.scrollHeight > el.clientHeight + 1 && ['visible', 'clip'].includes(style.overflowY)) {
    issues.push({ type: 'vertical-overflow', selector: selectorFor(el), severity: 'medium', evidence: { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight } });
  }
  if (r.right > window.innerWidth + 1 || r.left < -1) {
    issues.push({ type: 'viewport-overflow', selector: selectorFor(el), severity: 'high', evidence: rect(el) });
  }
  return issues;
}

function detectClippedText(el, minTextSize) {
  const text = (el.textContent || '').trim();
  if (!text || el.children.length > 0) return null;
  const style = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const lineHeight = parseFloat(style.lineHeight);
  const fontSize = parseFloat(style.fontSize);
  if (!Number.isFinite(fontSize) || fontSize < minTextSize) return null;
  const clipped = (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && (style.overflow === 'hidden' || style.textOverflow === 'ellipsis' || style.whiteSpace === 'nowrap');
  if (!clipped) return null;
  return { type: 'clipped-text', selector: selectorFor(el), severity: 'medium', evidence: { text: text.slice(0, 120), width: r.width, height: r.height, fontSize, lineHeight } };
}

function detectOverlaps(elements, tolerance) {
  const findings = [];
  const candidates = elements.filter(el => ['button', 'a', 'input', 'textarea', 'select', 'img'].includes(el.tagName.toLowerCase()) || el.children.length === 0);
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    const ar = a.getBoundingClientRect();
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (a.contains(b) || b.contains(a)) continue;
      const br = b.getBoundingClientRect();
      if (!intersects(ar, br, tolerance)) continue;
      const as = getComputedStyle(a);
      const bs = getComputedStyle(b);
      const positioned = ['absolute', 'fixed', 'sticky'].includes(as.position) || ['absolute', 'fixed', 'sticky'].includes(bs.position);
      const interactive = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) || ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(b.tagName);
      if (positioned || interactive) {
        findings.push({ type: 'element-overlap', selector: selectorFor(a), relatedSelector: selectorFor(b), severity: interactive ? 'high' : 'medium', evidence: { a: rect(a), b: rect(b), positioned } });
      }
    }
  }
  return findings;
}

function detectResponsiveBreakage(elements) {
  const findings = [];
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (r.width > viewport.width + 1 || r.left < -1 || r.right > viewport.width + 1) {
      findings.push({ type: 'responsive-overflow', selector: selectorFor(el), severity: 'high', evidence: { viewport, rect: rect(el), display: style.display, position: style.position } });
    }
    if (['button', 'a'].includes(el.tagName.toLowerCase()) && r.width < 24 && r.height < 24) {
      findings.push({ type: 'tiny-interactive-target', selector: selectorFor(el), severity: 'low', evidence: { width: r.width, height: r.height } });
    }
  }
  return findings;
}

export function inspectClientVisualDom(root = document, options = {}) {
  if (typeof window === 'undefined' || !root) return { ok: true, findings: [], metrics: {} };
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const elements = meaningfulElements(root);
  const findings = [];
  for (const el of elements) {
    findings.push(...detectOverflow(el));
    const clipped = detectClippedText(el, opts.minTextSize);
    if (clipped) findings.push(clipped);
  }
  findings.push(...detectOverlaps(elements, opts.overlapTolerance));
  findings.push(...detectResponsiveBreakage(elements));

  const unique = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.type}|${finding.selector}|${finding.relatedSelector || ''}`;
    if (!seen.has(key)) { seen.add(key); unique.push(finding); }
    if (unique.length >= opts.maxFindings) break;
  }
  return {
    ok: unique.length === 0,
    findings: unique,
    metrics: { viewport: { width: window.innerWidth, height: window.innerHeight }, elementsScanned: elements.length, findingCount: unique.length },
  };
}

export function createClientVisualListener({ root = document, onDiagnostics, debounceMs = 250 } = {}) {
  if (typeof window === 'undefined') return () => {};
  let timer;
  let lastPayload = '';
  const emit = (reason) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const payload = inspectClientVisualDom(root);
      const serialized = JSON.stringify(payload);
      if (serialized === lastPayload) return;
      lastPayload = serialized;
      onDiagnostics?.({ reason, ...payload });
    }, debounceMs);
  };

  const observer = new MutationObserver(() => emit('dom-mutation'));
  observer.observe(root.documentElement || root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
  const onResize = () => emit('viewport-resize');
  window.addEventListener('resize', onResize, { passive: true });
  emit('initial-scan');

  return () => {
    clearTimeout(timer);
    observer.disconnect();
    window.removeEventListener('resize', onResize);
  };
}

export function createClientErrorListener({ onError } = {}) {
  if (typeof window === 'undefined') return () => {};
  const handleError = (event) => onError?.({ type: 'runtime-error', message: String(event.message || event.error?.message || 'Unknown runtime error'), source: event.filename || '', line: event.lineno || 0, column: event.colno || 0, stack: event.error?.stack || '' });
  const handleRejection = (event) => onError?.({ type: 'unhandled-rejection', message: String(event.reason?.message || event.reason || 'Unhandled promise rejection'), stack: event.reason?.stack || '' });
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
